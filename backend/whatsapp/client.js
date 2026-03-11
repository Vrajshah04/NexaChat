const path = require('path')
const fs = require('fs')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const Message = require('../models/Message')
const Contact = require('../models/Contact')
const { getAutoReply } = require('./automation')

// ── Per-user session store ───────────────────────────────────────────────────
// Map<userId (string), UserState>
const sessions = new Map()

// Global io reference — injected from server.js
let _io = null
function setIO(io) { _io = io }

function emitToUser(userId, event, data) {
    if (_io) _io.to(`user:${userId}`).emit(event, data)
}

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            client: null,
            isClientReady: false,
            isInitializing: false,
            lastQrDataUrl: null,
            currentAccountId: null,
        })
    }
    return sessions.get(userId)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeToChatId(numberOrChatId) {
    if (!numberOrChatId) return ''
    const value = String(numberOrChatId).trim()
    return value.endsWith('@c.us') ? value : `${value.replace(/\D/g, '')}@c.us`
}

function getSessionDir(userId) {
    return path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`)
}

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

async function sendWithRecovery(fn, userId) {
    try {
        return await fn()
    } catch (err) {
        if (isDetachedFrameError(err)) {
            console.warn(`[wa:${userId}] detached frame — triggering reconnect`)
            emitToUser(userId, 'wa:error', { message: 'WhatsApp session lost, reconnecting…' })
            const s = getSession(userId)
            s.isClientReady = false
            emitToUser(userId, 'wa:status', { isReady: false });
            (async () => {
                try {
                    await destroyClientAndWipeSession(userId)
                    await createClient(userId)
                    safeInitialize(userId)
                } catch (_) { }
            })()
            throw new Error('WhatsApp session lost — reconnecting, please try again in ~10 seconds')
        }
        throw err
    }
}

// ── Client lifecycle ─────────────────────────────────────────────────────────

function attachClientEvents(newClient, userId) {
    const s = getSession(userId)

    newClient.on('qr', async qr => {
        console.log(`[wa:${userId}] qr received`)
        try {
            s.lastQrDataUrl = await qrcode.toDataURL(qr, { width: 256 })
            emitToUser(userId, 'wa:qr', { dataUrl: s.lastQrDataUrl })
            s.isClientReady = false
            emitToUser(userId, 'wa:status', { isReady: false })
        } catch (err) {
            console.error(`[wa:${userId}] qr error`, err)
            emitToUser(userId, 'wa:error', { message: 'Failed generating QR', details: String(err) })
        }
    })

    newClient.on('ready', () => {
        console.log(`[wa:${userId}] ready`)
        s.isClientReady = true
        s.lastQrDataUrl = null
        try { s.currentAccountId = newClient.info?.wid?.user || null } catch (_) { }
        emitToUser(userId, 'wa:status', { isReady: true })
    })

    newClient.on('authenticated', () => {
        console.log(`[wa:${userId}] authenticated`)
        emitToUser(userId, 'wa:authenticated')
        s.isClientReady = true
        s.lastQrDataUrl = null
        emitToUser(userId, 'wa:status', { isReady: true })
    })

    newClient.on('auth_failure', msg => {
        console.warn(`[wa:${userId}] auth_failure`, msg)
        s.isClientReady = false
        emitToUser(userId, 'wa:status', { isReady: false })
        emitToUser(userId, 'wa:error', { message: 'Authentication failed', details: msg });
        (async () => {
            try {
                await destroyClientAndWipeSession(userId)
                await createClient(userId)
                safeInitialize(userId)
            } catch (e) {
                console.error(`[wa:${userId}] reinit after auth_failure error`, e)
            }
        })()
    })

    newClient.on('disconnected', reason => {
        console.warn(`[wa:${userId}] disconnected`, reason)
        s.isClientReady = false
        emitToUser(userId, 'wa:status', { isReady: false })
        emitToUser(userId, 'wa:disconnected', { reason });
        (async () => {
            try {
                await destroyClientAndWipeSession(userId)
                await createClient(userId)
                safeInitialize(userId)
            } catch (e) {
                console.error(`[wa:${userId}] reinit after disconnect error`, e)
            }
        })()
    })

    newClient.on('message_create', async message => {
        let messageBody = message.body || ''
        let mediaInfo = null

        if (message.hasMedia) {
            try {
                const media = await message.downloadMedia()
                if (media && media.data) {
                    mediaInfo = {
                        mimetype: media.mimetype || 'application/octet-stream',
                        filename: media.filename || `media_${Date.now()}`,
                        data: media.data,
                        type: message.type,
                    }
                    messageBody = message.caption || message.body || media.filename || `[${message.type}]`
                } else {
                    messageBody = `[${message.type} - no data]`
                }
            } catch (err) {
                console.error(`[wa:${userId}] media download error`, err)
                messageBody = `[${message.type} - download failed]`
            }
        }

        // Partner name: DB first, then group name, then raw number
        const partnerId = message.fromMe ? message.to : message.from
        let resolvedPartnerName = ''
        try {
            if (userId && partnerId) {
                const dbContact = await Contact.findOne({ userId, chatId: partnerId })
                if (dbContact) resolvedPartnerName = dbContact.name
            }
            if (!resolvedPartnerName && partnerId) {
                const chat = await message.getChat().catch(() => null)
                if (chat?.isGroup) resolvedPartnerName = chat.name || chat.id?.user || 'Group'
            }
        } catch (err) {
            console.error(`[wa:${userId}] partner resolution error`, err)
        }
        if (!resolvedPartnerName && partnerId) {
            resolvedPartnerName = partnerId.split('@')[0]
        }

        const record = {
            id: message.id?._serialized || String(Date.now()),
            from: message.from,
            to: message.to,
            senderName: resolvedPartnerName || 'Contact',
            body: messageBody,
            fromMe: Boolean(message.fromMe),
            timestamp: Date.now(),
            hasMedia: Boolean(message.hasMedia),
            mediaInfo,
            type: message.type,
        }

        // Emit ONLY to this user's socket room
        emitToUser(userId, 'wa:message', record)

        // Persist to MongoDB
        if (userId && s.currentAccountId) {
            try {
                await Message.create({
                    userId,
                    accountId: s.currentAccountId,
                    chatId: message.fromMe ? message.to : message.from,
                    from: message.from,
                    to: message.to,
                    senderName: resolvedPartnerName,
                    body: messageBody,
                    fromMe: Boolean(message.fromMe),
                    hasMedia: Boolean(message.hasMedia),
                    mediaInfo,
                    type: message.type,
                    direction: message.fromMe ? 'outbound' : 'inbound',
                    timestamp: new Date(),
                })
            } catch (e) {
                console.error(`[wa:${userId}] message save error`, e)
            }
        }

        // Auto-reply: incoming only
        if (!message.fromMe && userId) {
            try {
                const rule = await getAutoReply(userId, message.from, messageBody)
                if (rule) {
                    const attachments = Array.isArray(rule.attachments) ? rule.attachments : []
                    const isSingleImage =
                        attachments.length === 1 &&
                        (attachments[0].mimetype || '').startsWith('image/')

                    if (isSingleImage) {
                        const media = MessageMedia.fromFilePath(attachments[0].filePath)
                        await sendWithRecovery(() =>
                            newClient.sendMessage(message.from, media, {
                                caption: rule.responseText || undefined,
                            }), userId)
                    } else {
                        if (rule.responseText) {
                            await sendWithRecovery(() =>
                                newClient.sendMessage(message.from, rule.responseText), userId)
                        }
                        for (const att of attachments) {
                            if (!att.filePath) continue
                            const media = MessageMedia.fromFilePath(att.filePath)
                            await sendWithRecovery(() =>
                                newClient.sendMessage(message.from, media), userId)
                        }
                    }
                }
            } catch (e) {
                console.error(`[wa:${userId}] auto-reply error`, e)
            }
        }
    })
}

async function createClient(userId) {
    const s = getSession(userId)
    if (s.client) return s.client

    s.client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
    })
    attachClientEvents(s.client, userId)
    return s.client
}

function safeInitialize(userId) {
    const s = getSession(userId)
    if (!s.client) return
    if (s.isInitializing) return
    s.isInitializing = true
    try {
        const p = s.client.initialize()
        if (p && typeof p.then === 'function') p
            .then(() => { s.isInitializing = false })
            .catch(async err => {
                console.error(`[wa:${userId}] initialize error`, err)
                emitToUser(userId, 'wa:error', { message: 'Initialize failed', details: String(err) })
                s.isInitializing = false
                await destroyClientAndWipeSession(userId)
                await new Promise(r => setTimeout(r, 500))
                await createClient(userId)
                setTimeout(() => safeInitialize(userId), 200)
            })
    } catch (err) {
        console.error(`[wa:${userId}] initialize threw`, err)
        emitToUser(userId, 'wa:error', { message: 'Initialize threw', details: String(err) })
        s.isInitializing = false
        setTimeout(() => safeInitialize(userId), 300)
    }
}

async function destroyClientAndWipeSession(userId) {
    const s = getSession(userId)
    try {
        if (s.client) {
            try { await s.client.logout() } catch (_) { }
            try { await s.client.destroy() } catch (_) { }
        }
    } finally {
        s.client = null
        s.isClientReady = false
        s.lastQrDataUrl = null
        s.currentAccountId = null
        emitToUser(userId, 'wa:status', { isReady: false })
    }
    const sessionDir = getSessionDir(userId)
    await fs.promises.rm(sessionDir, { recursive: true, force: true })
    console.log(`[wa:${userId}] session destroyed`)
}

module.exports = {
    sessions,
    getSession,
    setIO,
    createClient,
    safeInitialize,
    destroyClientAndWipeSession,
    normalizeToChatId,
    isDetachedFrameError,
    sendWithRecovery,
}
