require('dotenv').config()

const express = require('express')
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

// WhatsApp module
const {
	state: waState,
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

// Inject io into WA state so client.js can broadcast
waState.io = io

app.use(express.json())

// CORS
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
	if (req.method === 'OPTIONS') return res.sendStatus(200)
	next()
})

// Static frontend (for production; dev uses Vite on port 5173)
const frontendDir = path.join(__dirname, '..', 'frontend')
app.use(express.static(frontendDir))

// ── Public routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── Protected routes ───────────────────────────────────────────────────────────
app.use('/api/contacts', authMiddleware, contactRoutes)
app.use('/api/messages', authMiddleware, messageRoutes)
app.use('/api/global-rules', authMiddleware, globalRuleRoutes)
app.use('/api/analytics', authMiddleware, analyticsRoutes)

// ── WhatsApp connection control ────────────────────────────────────────────────
// These endpoints set the userId on the WA state so messages are saved under the right user

app.post('/api/connect', authMiddleware, async (req, res) => {
	try {
		waState.currentUserId = req.user.userId
		await createClient()
		safeInitialize()
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.get('/api/connect', authMiddleware, async (req, res) => {
	try {
		waState.currentUserId = req.user.userId
		await createClient()
		safeInitialize()
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.post('/api/disconnect', authMiddleware, async (req, res) => {
	try {
		await destroyClientAndWipeSession()
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

app.get('/api/disconnect', authMiddleware, async (req, res) => {
	try {
		await destroyClientAndWipeSession()
		return res.json({ ok: true })
	} catch (err) {
		return res.status(500).json({ ok: false, error: String(err) })
	}
})

// ── Send message ───────────────────────────────────────────────────────────────
// Multer for send-form file uploads
const uploadsDir = path.join(__dirname, 'uploads')
try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }
const sendStorage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadsDir),
	filename: (_req, file, cb) => {
		const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
		cb(null, Date.now() + '-' + safe)
	}
})
const upload = multer({ storage: sendStorage, limits: { fileSize: 10 * 1024 * 1024 } })

app.post('/api/send', authMiddleware, upload.single('attachment'), async (req, res) => {
	if (!waState.isClientReady || !waState.client) {
		return res.status(503).json({ ok: false, error: 'WhatsApp client not ready' })
	}
	const { number } = req.body || {}
	const message = typeof req.body?.message === 'string' ? req.body.message : ''
	const caption = typeof req.body?.caption === 'string' ? req.body.caption : ''
	if (!number) return res.status(400).json({ ok: false, error: 'Missing number' })
	const chatId = normalizeToChatId(number)
	const hasFile = Boolean(req.file && req.file.path)
	if (!hasFile && !message) return res.status(400).json({ ok: false, error: 'Provide message or attachment' })
	try {
		if (hasFile) {
			const media = MessageMedia.fromFilePath(req.file.path)
			await sendWithRecovery(() => waState.client.sendMessage(chatId, media, { caption: caption || undefined }))
			try { await fs.promises.unlink(req.file.path) } catch (_) { }
			if (message) {
				await new Promise(r => setTimeout(r, 250))
				await sendWithRecovery(() => waState.client.sendMessage(chatId, message))
			}
		} else {
			await sendWithRecovery(() => waState.client.sendMessage(chatId, message))
		}
		return res.json({ ok: true })
	} catch (err) {
		const statusCode = isDetachedFrameError(err) ? 503 : 500
		return res.status(statusCode).json({ ok: false, error: String(err.message || err) })
	}
})

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.use((socket, next) => {
	// Verify JWT token on socket handshake
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
	console.log('[io] client connected', socket.id, socket.username)

	// If WA started at boot with no userId, associate the first authenticated socket user
	if (!waState.currentUserId) {
		waState.currentUserId = socket.userId
		console.log('[io] auto-associated userId', socket.userId, 'with running WA session')
	}

	// Sync current WA status
	socket.emit('wa:status', { isReady: waState.isClientReady })
	// Replay last 100 messages from DB for this user
	try {
		const history = await Message.find({ userId: socket.userId })
			.sort({ timestamp: -1 })
			.limit(100)
			.lean()
		socket.emit('wa:history', history.reverse())
	} catch (_) { }
	// Replay pending QR if still waiting for scan
	if (!waState.isClientReady && waState.lastQrDataUrl) {
		socket.emit('wa:qr', { dataUrl: waState.lastQrDataUrl })
	}
})

// 404 handler (last)
app.use((req, res) => {
	res.status(404).json({ ok: false, error: 'Not found' })
})

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
	; (async () => {
		await connectDB()
		server.listen(PORT, () => {
			console.log(`Server listening on http://localhost:${PORT}`)
			// Auto-start WA client (userId will be set properly when user logs in via /api/connect)
			createClient().then(() => safeInitialize())
		})
	})()
