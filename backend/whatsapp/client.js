const path = require('path')
const fs = require('fs')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const Message = require('../models/Message')
const { getAutoReply } = require('./automation')

// Shared state — exported so server.js and routes can read them
const state = {
    client: null,
    isClientReady: false,
    isInitializing: false,
    lastQrDataUrl: null,
    currentAccountId: null,   // WA phone number of logged-in account
    currentUserId: null,      // DB userId of the dashboard user who connected WA
    io: null,                 // Socket.IO server instance — injected after init
}

function getAuthDir() {
    return path.join(process.cwd(), '.wwebjs_auth')
}

function broadcastStatus() {
    if (state.io) state.io.emit('wa:status', { isReady: state.isClientReady })
}

function normalizeToChatId(numberOrChatId) {
    if (!numberOrChatId) return ''
    const value = String(numberOrChatId).trim()
    return value.endsWith('@c.us') ? value : `${value.replace(/\D/g, '')}@c.us`
}

// Detached frame / dead session detection
function isDetachedFrameError(err) {
    if (!err) return false
    const msg = String(err.message || err).toLowerCase()
    return (
        msg.includes('detached frame') ||
        msg.includes('session closed') ||
        msg.includes('target closed') ||
        msg.includes('execution context was destroyed') ||
        msg.includes('page has been closed')
    )
}

async function sendWithRecovery(fn) {
    try {
        return await fn()
    } catch (err) {
        if (isDetachedFrameError(err)) {
            console.warn('[wa] detached frame — triggering reconnect')
            if (state.io) state.io.emit('wa:error', { message: 'WhatsApp session lost, reconnecting…' })
            state.isClientReady = false
            broadcastStatus()
                ; (async () => {
                    try { await destroyClientAndWipeSession(); await createClient(); safeInitialize() } catch (_) { }
                })()
            throw new Error('WhatsApp session lost — reconnecting, please try again in ~10 seconds')
        }
        throw err
    }
}

function attachClientEvents(newClient) {
    newClient.on('qr', async qr => {
        console.log('[wa] qr received')
        try {
            state.lastQrDataUrl = await qrcode.toDataURL(qr, { width: 256 })
            if (state.io) state.io.emit('wa:qr', { dataUrl: state.lastQrDataUrl })
            state.isClientReady = false
            broadcastStatus()
        } catch (err) {
            console.error('[wa] qr error', err)
            if (state.io) state.io.emit('wa:error', { message: 'Failed generating QR', details: String(err) })
        }
    })

    newClient.on('ready', () => {
        console.log('[wa] ready')
        state.isClientReady = true
        state.lastQrDataUrl = null
        // Capture account phone number for message scoping
        try { state.currentAccountId = newClient.info?.wid?.user || null } catch (_) { }
        broadcastStatus()
        // NO hardcoded startup message
    })

    newClient.on('authenticated', () => {
        console.log('[wa] authenticated')
        if (state.io) state.io.emit('wa:authenticated')
        state.isClientReady = true
        state.lastQrDataUrl = null
        broadcastStatus()
    })

    newClient.on('auth_failure', msg => {
        console.warn('[wa] auth_failure', msg)
        state.isClientReady = false
        broadcastStatus()
        if (state.io) state.io.emit('wa:error', { message: 'Authentication failed', details: msg })
            ; (async () => {
                try { await destroyClientAndWipeSession(); await createClient(); safeInitialize() } catch (e) {
                    console.error('[wa] reinit after auth_failure error', e)
                }
            })()
    })

    newClient.on('disconnected', reason => {
        console.warn('[wa] disconnected', reason)
        state.isClientReady = false
        broadcastStatus()
        if (state.io) state.io.emit('wa:disconnected', { reason })
            ; (async () => {
                try { await destroyClientAndWipeSession(); await createClient(); safeInitialize() } catch (e) {
                    console.error('[wa] reinit after disconnect error', e)
                }
            })()
    })

    newClient.on('message_create', async message => {
        let messageBody = message.body || ''
        let mediaInfo = null

        // Download media if present
        if (message.hasMedia) {
            try {
                const media = await message.downloadMedia()
                if (media && media.data) {
                    mediaInfo = { mimetype: media.mimetype || 'application/octet-stream', filename: media.filename || `media_${Date.now()}`, data: media.data, type: message.type }
                    messageBody = message.caption || message.body || media.filename || `[${message.type}]`
                } else {
                    messageBody = `[${message.type} - no data]`
                }
            } catch (err) {
                console.error('[wa] media download error', err)
                messageBody = `[${message.type} - download failed]`
            }
        }

        const record = {
            id: message.id?._serialized || String(Date.now()),
            from: message.from,
            to: message.to,
            body: messageBody,
            fromMe: Boolean(message.fromMe),
            timestamp: Date.now(),
            hasMedia: Boolean(message.hasMedia),
            mediaInfo,
            type: message.type
        }

        // Broadcast to all connected dashboard UIs
        if (state.io) state.io.emit('wa:message', record)

        // Persist to MongoDB (if a user is associated with this WA session)
        if (state.currentUserId && state.currentAccountId) {
            try {
                await Message.create({
                    userId: state.currentUserId,
                    accountId: state.currentAccountId,
                    chatId: message.fromMe ? message.to : message.from,
                    from: message.from,
                    to: message.to,
                    body: messageBody,
                    fromMe: Boolean(message.fromMe),
                    hasMedia: Boolean(message.hasMedia),
                    mediaInfo,
                    type: message.type,
                    direction: message.fromMe ? 'outbound' : 'inbound',
                    timestamp: new Date(),
                })
            } catch (e) {
                console.error('[wa] message save error', e)
            }
        }

        // Auto-reply: only for incoming messages
        if (!message.fromMe && state.currentUserId) {
            try {
                const rule = await getAutoReply(state.currentUserId, message.from, messageBody)
                if (rule) {
                    // 1. Send text reply if present
                    if (rule.responseText) {
                        await sendWithRecovery(() => newClient.sendMessage(message.from, rule.responseText))
                    }
                    // 2. Send image if present (with its own caption)
                    if (rule.responseType === 'image' && rule.imagePath) {
                        const media = MessageMedia.fromFilePath(rule.imagePath)
                        await sendWithRecovery(() =>
                            newClient.sendMessage(message.from, media, { caption: rule.caption || undefined })
                        )
                    }
                }
            } catch (e) {
                console.error('[wa] auto-reply error', e)
            }
        }
    })
}

async function createClient() {
    if (state.client) return state.client
    state.client = new Client({
        authStrategy: new LocalAuth(),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    })
    attachClientEvents(state.client)
    return state.client
}

function safeInitialize() {
    if (!state.client) return
    if (state.isInitializing) return
    state.isInitializing = true
    try {
        const p = state.client.initialize()
        if (p && typeof p.then === 'function') p
            .then(() => { state.isInitializing = false })
            .catch(async err => {
                console.error('[wa] initialize error', err)
                if (state.io) state.io.emit('wa:error', { message: 'Initialize failed', details: String(err) })
                state.isInitializing = false
                await destroyClientAndWipeSession()
                await new Promise(r => setTimeout(r, 500))
                await createClient()
                setTimeout(() => safeInitialize(), 200)
            })
    } catch (err) {
        console.error('[wa] initialize threw', err)
        if (state.io) state.io.emit('wa:error', { message: 'Initialize threw', details: String(err) })
        state.isInitializing = false
        setTimeout(() => safeInitialize(), 300)
    }
}

async function destroyClientAndWipeSession() {
    try {
        if (state.client) {
            try { await state.client.logout() } catch (_) { }
            try { await state.client.destroy() } catch (_) { }
        }
    } finally {
        state.client = null
        state.isClientReady = false
        state.lastQrDataUrl = null
        state.currentAccountId = null
        broadcastStatus()
    }
    const authDir = getAuthDir()
    await fs.promises.rm(authDir, { recursive: true, force: true })
}

module.exports = {
    state,
    createClient,
    safeInitialize,
    destroyClientAndWipeSession,
    normalizeToChatId,
    isDetachedFrameError,
    sendWithRecovery,
}
