require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const path = require('path')
const multer = require('multer')
const fs = require('fs')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { MessageMedia } = require('whatsapp-web.js')

const connectDB = require('./config/db')
const authMiddleware = require('./middleware/auth')
const Message = require('./models/Message')

// Routes
const authRoutes = require('./routes/auth')
const contactRoutes = require('./routes/contacts')
const messageRoutes = require('./routes/messages')
const globalRuleRoutes = require('./routes/globalRules')
const analyticsRoutes = require('./routes/analytics')

// WhatsApp module — per-user session architecture
const {
	sessions,
	getSession,
	setIO,
	createClient,
	safeInitialize,
	destroyClientAndWipeSession,
	normalizeToChatId,
	isDetachedFrameError,
	sendWithRecovery,
} = require('./whatsapp/client')

// Process guards
process.on('unhandledRejection', err => {
	console.error('[proc] unhandledRejection', err)
})
process.on('uncaughtException', err => {
	console.error('[proc] uncaughtException', err)
})

// Express + HTTP + Socket.IO
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

// Inject io into WA module so client.js can emit to user rooms
setIO(io)

app.use(express.json())
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))

// Static frontend (for production; dev uses Vite on port 5173)
const frontendDir = path.join(__dirname, '..', 'frontend')
app.use(express.static(frontendDir))

// Static uploads (for rule images/attachments)
const uploadsPath = path.resolve(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsPath))

// ── Public routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── Protected routes ───────────────────────────────────────────────────────────
app.use('/api/contacts', authMiddleware, contactRoutes)
app.use('/api/messages', authMiddleware, messageRoutes)
app.use('/api/global-rules', authMiddleware, globalRuleRoutes)
app.use('/api/analytics', authMiddleware, analyticsRoutes)

// ── WhatsApp connection control — per user ─────────────────────────────────────

app.post('/api/connect', authMiddleware, async (req, res) => {
	try {
		const userId = req.user.userId
		await createClient(userId)
		safeInitialize(userId)
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.get('/api/connect', authMiddleware, async (req, res) => {
	try {
		const userId = req.user.userId
		await createClient(userId)
		safeInitialize(userId)
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.post('/api/disconnect', authMiddleware, async (req, res) => {
	try {
		await destroyClientAndWipeSession(req.user.userId)
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.get('/api/disconnect', authMiddleware, async (req, res) => {
	try {
		await destroyClientAndWipeSession(req.user.userId)
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

// ── Send message ───────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads')
try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }
const sendStorage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadsDir),
	filename: (_req, file, cb) => {
		const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
		cb(null, Date.now() + '-' + safe)
	}
})
const upload = multer({ storage: sendStorage, limits: { fileSize: 25 * 1024 * 1024 } })

app.post('/api/send', authMiddleware, upload.any(), async (req, res) => {
	const userId = req.user.userId
	const userSession = getSession(userId)

	if (!userSession.isClientReady || !userSession.client) {
		return res.status(503).json({ ok: false, error: 'WhatsApp client not ready. Please connect first.' })
	}

	const { number, numbers } = req.body || {}
	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''

	let targetNumbers = []
	if (numbers) {
		try {
			targetNumbers = JSON.parse(numbers)
		} catch (e) {
			targetNumbers = []
		}
	} else if (number) {
		targetNumbers = [number]
	}

	if (targetNumbers.length === 0) return res.status(400).json({ ok: false, error: 'Missing recipients (number or numbers)' })

	const files = Array.isArray(req.files) ? req.files : []
	const hasFiles = files.length > 0
	if (!hasFiles && !message) return res.status(400).json({ ok: false, error: 'Provide message or attachment' })

	try {
		const isSingleImage =
			files.length === 1 &&
			(files[0].mimetype || '').startsWith('image/')

		for (const num of targetNumbers) {
			const chatId = normalizeToChatId(num)

			if (isSingleImage) {
				const media = MessageMedia.fromFilePath(files[0].path)
				if (files[0].originalname) media.filename = files[0].originalname
				await sendWithRecovery(() =>
					userSession.client.sendMessage(chatId, media, { caption: message || undefined }),
					userId)
			} else {
				if (message) {
					await sendWithRecovery(() => userSession.client.sendMessage(chatId, message), userId)
				}
				for (const file of files) {
					if (!file.path) continue
					const media = MessageMedia.fromFilePath(file.path)
					if (file.originalname) media.filename = file.originalname
					await sendWithRecovery(() => userSession.client.sendMessage(chatId, media), userId)
					if (files.indexOf(file) < files.length - 1) {
						await new Promise(r => setTimeout(r, 300))
					}
				}
			}

			// Delay between recipients to prevent spam-blocking
			if (targetNumbers.indexOf(num) < targetNumbers.length - 1) {
				await new Promise(r => setTimeout(r, 1500))
			}
		}

		// Cleanup files after sending to all recipients
		for (const file of files) {
			if (file.path) {
				fs.promises.unlink(file.path).catch(() => { })
			}
		}

		return res.json({ ok: true })
	} catch (err) {
		// Ensure cleanup happens even on error
		for (const file of files) {
			if (file.path) fs.promises.unlink(file.path).catch(() => { })
		}
		const statusCode = isDetachedFrameError(err) ? 503 : 500
		return res.status(statusCode).json({ ok: false, error: String(err.message || err) })
	}
})

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.use((socket, next) => {
	const token = socket.handshake.auth?.token
	if (!token) return next(new Error('Authentication error'))
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET)
		socket.userId = decoded.userId
		socket.username = decoded.username
		next()
	} catch {
		next(new Error('Authentication error'))
	}
})

io.on('connection', async socket => {
	const userId = socket.userId
	console.log('[io] client connected', socket.id, socket.username)

	// Join this user's private room — all WA events go only to this room
	socket.join(`user:${userId}`)

	// Get this user's WA session state
	const userSession = getSession(userId)

	// Send current WA status for this user
	socket.emit('wa:status', { isReady: userSession.isClientReady })

	// Replay last 100 messages from DB for this user
	try {
		const history = await Message.find({ userId })
			.sort({ timestamp: -1 })
			.limit(100)
			.lean()
		socket.emit('wa:history', history.reverse())
	} catch (_) { }

	// Replay pending QR if still waiting for scan (for this user)
	if (!userSession.isClientReady && userSession.lastQrDataUrl) {
		socket.emit('wa:qr', { dataUrl: userSession.lastQrDataUrl })
	}
})

// 404 handler
app.use((req, res) => {
	res.status(404).json({ ok: false, error: 'Not found' })
})

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
(async () => {
	await connectDB()
	server.listen(PORT, () => {
		console.log(`Server listening on http://localhost:${PORT}`)
		// No auto-start — each user's session starts on /api/connect
	})
})()
