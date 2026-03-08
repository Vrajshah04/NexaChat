const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const Contact = require('../models/Contact')

const router = express.Router()

// Multer setup for contact attachments
const uploadsDir = path.join(__dirname, '..', 'uploads')
try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
        cb(null, Date.now() + '-' + safe)
    }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// GET /api/contacts
router.get('/', async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user.userId }).sort({ name: 1 }).lean()
        return res.json({ ok: true, contacts })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/contacts — add or update a contact
router.post('/', upload.single('attachment'), async (req, res) => {
    const { name, number, customMessage, autoReplyEnabled } = req.body || {}
    if (!name || !number) return res.status(400).json({ ok: false, error: 'Missing name or number' })
    const cleanNumber = String(number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const prev = await Contact.findOne({ userId: req.user.userId, chatId })
        let attachmentPath = prev?.attachmentPath || ''
        let attachmentMimetype = prev?.attachmentMimetype || ''
        let attachmentOriginalName = prev?.attachmentOriginalName || ''
        if (req.file) {
            if (attachmentPath) { try { await fs.promises.unlink(attachmentPath) } catch (_) { } }
            attachmentPath = req.file.path
            attachmentMimetype = req.file.mimetype || ''
            attachmentOriginalName = req.file.originalname || ''
        }
        const update = {
            name: String(name).trim(),
            number: cleanNumber,
            attachmentPath,
            attachmentMimetype,
            attachmentOriginalName,
            ...(autoReplyEnabled !== undefined && { autoReplyEnabled: autoReplyEnabled === 'true' || autoReplyEnabled === true }),
        }
        // Handle legacy customMessage as a single rule for backwards compatibility
        if (customMessage !== undefined) {
            const trimmed = String(customMessage).trim()
            if (trimmed && !prev) {
                update.autoReplyRules = [{ trigger: '', reply: trimmed }]
            }
        }
        const contact = await Contact.findOneAndUpdate(
            { userId: req.user.userId, chatId },
            { $set: { userId: req.user.userId, chatId, ...update } },
            { upsert: true, new: true, runValidators: true }
        )
        return res.json({ ok: true, contact })
    } catch (err) {
        console.error('[contacts] save error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// DELETE /api/contacts/:number
router.delete('/:number', async (req, res) => {
    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const contact = await Contact.findOneAndDelete({ userId: req.user.userId, chatId })
        if (contact?.attachmentPath) {
            fs.promises.unlink(contact.attachmentPath).catch(() => { })
        }
        return res.json({ ok: true, removed: Boolean(contact) })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/contacts/:number/rules — add an auto-reply rule to a contact
router.post('/:number/rules', async (req, res) => {
    const { trigger, reply } = req.body || {}
    if (!trigger || !reply) return res.status(400).json({ ok: false, error: 'trigger and reply required' })
    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const contact = await Contact.findOneAndUpdate(
            { userId: req.user.userId, chatId },
            { $push: { autoReplyRules: { trigger: trigger.trim(), reply: reply.trim() } } },
            { new: true }
        )
        if (!contact) return res.status(404).json({ ok: false, error: 'Contact not found' })
        return res.json({ ok: true, contact })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// DELETE /api/contacts/:number/rules/:ruleId
router.delete('/:number/rules/:ruleId', async (req, res) => {
    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const contact = await Contact.findOneAndUpdate(
            { userId: req.user.userId, chatId },
            { $pull: { autoReplyRules: { _id: req.params.ruleId } } },
            { new: true }
        )
        if (!contact) return res.status(404).json({ ok: false, error: 'Contact not found' })
        return res.json({ ok: true, contact })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
