const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { Server } = require('socket.io')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const multer = require('multer')

// Guard the process from crashing on puppeteer/wa-web errors; log instead
process.on('unhandledRejection', err => {
	console.error('[proc] unhandledRejection', err)
})
process.on('uncaughtException', err => {
	console.error('[proc] uncaughtException', err)
})

// In-memory state
let client = null
let isClientReady = false
let isInitializing = false
let lastQrDataUrl = null
const messages = []
// In-memory contacts: key = chatId (e.g., 123@c.us)
const contacts = new Map()

// Express + HTTP + Socket.IO
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.use(express.json())

// Simple CORS for cross-origin dev setups
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	if (req.method === 'OPTIONS') return res.sendStatus(200)
	next()
})

// Static frontend
const frontendDir = path.join(__dirname, '..', 'frontend')
app.use(express.static(frontendDir))

// Uploads directory for contact attachments
const uploadsDir = path.join(__dirname, 'uploads')
try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadsDir),
	filename: (_req, file, cb) => {
		const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
		cb(null, Date.now() + '-' + safe)
	}
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// Helpers
function getAuthDir() {
	// Default LocalAuth path when not customized
	return path.join(process.cwd(), '.wwebjs_auth')
}

function broadcastStatus() {
	io.emit('wa:status', { isReady: isClientReady })
}

function normalizeToChatId(numberOrChatId) {
	if (!numberOrChatId) return ''
	const value = String(numberOrChatId).trim()
	return value.endsWith('@c.us') ? value : `${value.replace(/\D/g, '')}@c.us`
}

function attachClientEvents(newClient) {
	newClient.on('qr', async qr => {
		console.log('[wa] qr received')
		try {
			lastQrDataUrl = await qrcode.toDataURL(qr, { width: 256 })
			io.emit('wa:qr', { dataUrl: lastQrDataUrl })
			// Ensure UI reflects disconnected state while waiting for scan
			isClientReady = false
			broadcastStatus()
		} catch (err) {
			console.error('[wa] qr error', err)
			io.emit('wa:error', { message: 'Failed generating QR', details: String(err) })
		}
	})

	newClient.on('ready', () => {
		console.log('[wa] ready')
		isClientReady = true
		lastQrDataUrl = null
		broadcastStatus()
		// Keep original logic: send initial greeting
		newClient.sendMessage('919558804843@c.us', 'Hello, This is the great Vraj')
	})

	newClient.on('authenticated', () => {
		console.log('[wa] authenticated')
		io.emit('wa:authenticated')
		// Flip UI to connected immediately after successful auth; 'ready' will follow
		isClientReady = true
		broadcastStatus()
		lastQrDataUrl = null
	})

	newClient.on('auth_failure', msg => {
		console.warn('[wa] auth_failure', msg)
		isClientReady = false
		broadcastStatus()
		io.emit('wa:error', { message: 'Authentication failed', details: msg })
			// Recover by wiping session and re-initializing to get a fresh QR
			; (async () => {
				try {
					await destroyClientAndWipeSession()
					await createClient()
					safeInitialize()
				} catch (e) {
					console.error('[wa] reinit after auth_failure error', e)
				}
			})()
	})

	newClient.on('disconnected', reason => {
		console.warn('[wa] disconnected', reason)
		isClientReady = false
		broadcastStatus()
		io.emit('wa:disconnected', { reason })
			// Auto recover on disconnect (including logout) by resetting session and initializing
			; (async () => {
				try {
					await destroyClientAndWipeSession()
					await createClient()
					safeInitialize()
				} catch (e) {
					console.error('[wa] reinit after disconnect error', e)
				}
			})()
	})

	newClient.on('message_create', async message => {
		// Handle media messages properly
		let messageBody = message.body || ''
		let mediaInfo = null

		// Check if message has media
		if (message.hasMedia) {
			try {
				const media = await message.downloadMedia()
				if (media && media.data) {
					mediaInfo = {
						mimetype: media.mimetype || 'application/octet-stream',
						filename: media.filename || `media_${Date.now()}`,
						data: media.data, // base64 data
						type: message.type
					}
					// For media messages, preserve the original caption/body from the user
					// Only use fallback if no caption was provided
					if (message.caption) {
						messageBody = message.caption
					} else if (message.body) {
						messageBody = message.body
					} else {
						// Only use filename as fallback if no user caption
						messageBody = media.filename || `[${message.type}]`
					}
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
			mediaInfo: mediaInfo,
			type: message.type
		}
		messages.push(record)
		io.emit('wa:message', record)

		// Only auto-respond to incoming messages
		if (!message.fromMe) {
			// Priority: custom contact message if sender matches a stored contact
			const contact = contacts.get(message.from)
			if (contact) {
				try {
					if (contact.attachmentPath) {
						const media = MessageMedia.fromFilePath(contact.attachmentPath)
						await newClient.sendMessage(message.from, media, { caption: contact.customMessage || undefined })
						return
					}
					if (contact.customMessage) {
						await newClient.sendMessage(message.from, contact.customMessage)
						return
					}
				} catch (e) {
					console.error('[wa] auto-reply error', e)
				}
			}

			// Preserve existing greeting triggers
			const triggers = ['Hi', 'Hello', 'Good Morning', 'Good Afternoon', 'Good Evening']
			if (triggers.includes(message.body)) newClient.sendMessage(message.from, 'Hello, This is the great Vraj')
		}
	})
}

async function createClient() {
	if (client) return client
	client = new Client({
		authStrategy: new LocalAuth(),
		webVersionCache: {
			type: 'remote',
			remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
		}
	})
	attachClientEvents(client)
	return client
}

function safeInitialize() {
	if (!client) return
	if (isInitializing) return
	isInitializing = true
	try {
		const p = client.initialize()
		if (p && typeof p.then === 'function') p
			.then(() => { isInitializing = false })
			.catch(async err => {
				console.error('[wa] initialize error', err)
				io.emit('wa:error', { message: 'Initialize failed', details: String(err) })
				isInitializing = false
				// Backoff and try full reset to force fresh QR
				await destroyClientAndWipeSession()
				await new Promise(r => setTimeout(r, 500))
				await createClient()
				setTimeout(() => safeInitialize(), 200)
			})
	} catch (err) {
		console.error('[wa] initialize threw', err)
		io.emit('wa:error', { message: 'Initialize threw', details: String(err) })
		isInitializing = false
		setTimeout(() => safeInitialize(), 300)
	}
}

async function destroyClientAndWipeSession() {
	try {
		if (client) {
			try { await client.logout() } catch (_) { }
			try { await client.destroy() } catch (_) { }
		}
	} finally {
		client = null
		isClientReady = false
		lastQrDataUrl = null
		broadcastStatus()
	}
	// Remove LocalAuth folder to force new QR next time
	const authDir = getAuthDir()
	await fs.promises.rm(authDir, { recursive: true, force: true })
}

// API
app.post('/api/connect', async (_req, res) => {
	try {
		console.log('[api] /api/connect')
		await createClient()
		safeInitialize()
		return res.json({ ok: true })
	} catch (err) {
		console.error('[api] connect error', err)
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

// Also support GET for easier manual testing
app.get('/api/connect', async (_req, res) => {
	try {
		console.log('[api] GET /api/connect')
		await createClient()
		safeInitialize()
		return res.json({ ok: true })
	} catch (err) {
		console.error('[api] GET connect error', err)
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.post('/api/disconnect', async (_req, res) => {
	try {
		console.log('[api] /api/disconnect')
		await destroyClientAndWipeSession()
		return res.json({ ok: true })
	} catch (err) {
		console.error('[api] disconnect error', err)
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

// Also support GET for easier manual testing
app.get('/api/disconnect', async (_req, res) => {
	try {
		console.log('[api] GET /api/disconnect')
		await destroyClientAndWipeSession()
		return res.json({ ok: true })
	} catch (err) {
		console.error('[api] GET disconnect error', err)
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.post('/api/send', upload.single('attachment'), async (req, res) => {
	if (!isClientReady || !client) return res.status(503).json({ ok: false, error: 'WhatsApp client not ready' })
	const { number } = req.body || {}
	const message = typeof req.body?.message === 'string' ? req.body.message : ''
	const caption = typeof req.body?.caption === 'string' ? req.body.caption : ''
	if (!number) return res.status(400).json({ ok: false, error: 'Missing number' })
	const chatId = normalizeToChatId(number)
	const hasFile = Boolean(req.file && req.file.path)
	const text = message
	if (!hasFile && !text) return res.status(400).json({ ok: false, error: 'Provide message or attachment' })
	try {
		if (hasFile) {
			const media = MessageMedia.fromFilePath(req.file.path)
			await client.sendMessage(chatId, media, { caption: caption || undefined })
			try { await fs.promises.unlink(req.file.path) } catch (_) { }
			// Small delay improves reliability when sending a second message after media
			if (text) {
				await new Promise(r => setTimeout(r, 250))
				await client.sendMessage(chatId, text)
			}
		} else {
			await client.sendMessage(chatId, text)
		}
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

// Contacts APIs (in-memory)
app.get('/api/contacts', (_req, res) => {
	const list = Array.from(contacts.values())
	return res.json({ ok: true, contacts: list })
})

app.post('/api/contacts', upload.single('attachment'), async (req, res) => {
	const { name, number, customMessage } = req.body || {}
	if (!name || !number) return res.status(400).json({ ok: false, error: 'Missing name or number' })
	const chatId = normalizeToChatId(number)
	const prev = contacts.get(chatId)
	let attachmentPath = prev?.attachmentPath || ''
	let attachmentMimetype = prev?.attachmentMimetype || ''
	let attachmentOriginalName = prev?.attachmentOriginalName || ''
	if (req.file) {
		if (attachmentPath) {
			try { await fs.promises.unlink(attachmentPath) } catch (_) { }
		}
		attachmentPath = req.file.path
		attachmentMimetype = req.file.mimetype || ''
		attachmentOriginalName = req.file.originalname || ''
	}
	const entry = { name: String(name), number: chatId.replace('@c.us', ''), chatId, customMessage: String(customMessage || '').trim(), attachmentPath, attachmentMimetype, attachmentOriginalName }
	contacts.set(chatId, entry)
	return res.json({ ok: true, contact: entry })
})

app.delete('/api/contacts/:number', (req, res) => {
	const chatId = normalizeToChatId(req.params.number)
	const existedEntry = contacts.get(chatId)
	const existed = contacts.delete(chatId)
	if (existedEntry?.attachmentPath) {
		fs.promises.unlink(existedEntry.attachmentPath).catch(() => { })
	}
	return res.json({ ok: true, removed: existed })
})

// 404 logger (must be last)
app.use((req, res) => {
	console.warn('[api] 404', req.method, req.url)
	res.status(404).json({ ok: false, error: 'Not found' })
})

// Socket.IO
io.on('connection', socket => {
	console.log('[io] client connected', socket.id)
	socket.emit('wa:status', { isReady: isClientReady })
	const recent = messages.slice(-100)
	socket.emit('wa:history', recent)
	if (!isClientReady && lastQrDataUrl) socket.emit('wa:qr', { dataUrl: lastQrDataUrl })
})

// Boot
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`)
	// Auto initialize client on boot
	createClient().then(() => safeInitialize())
})


