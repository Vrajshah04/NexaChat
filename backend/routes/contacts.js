const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const Contact = require('../models/Contact')

const router = express.Router()

// Multer setup for contact attachments
const uploadsDir = path.resolve(__dirname, '..', 'uploads')
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }

console.log('[contacts] Uploads directory:', uploadsDir)

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

// POST /api/contacts — add or update a contact (no file upload here anymore)
router.post('/', async (req, res) => {
    const { name, number, autoReplyEnabled } = req.body || {}
    if (!name || !number) return res.status(400).json({ ok: false, error: 'Missing name or number' })
    const cleanNumber = String(number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const update = {
            name: String(name).trim(),
            number: cleanNumber,
            ...(autoReplyEnabled !== undefined && { autoReplyEnabled: autoReplyEnabled === 'true' || autoReplyEnabled === true }),
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
        // Note: Rule images are separate. We might want to clean them up too, but for now we just delete the contact.
        return res.json({ ok: true, removed: Boolean(contact) })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/contacts/:number/rules — add an auto-reply rule (text, image, or both)
router.post('/:number/rules', upload.single('image'), async (req, res) => {
    console.log('[contacts] POST rule - file:', req.file ? req.file.originalname : 'NONE')
    console.log('[contacts] POST rule - body:', req.body)

    const { trigger, responseText, caption } = req.body || {}
    if (!trigger) return res.status(400).json({ ok: false, error: 'trigger is required' })
    const hasImage = Boolean(req.file)
    const hasText = Boolean(responseText && String(responseText).trim())
    if (!hasImage && !hasText) return res.status(400).json({ ok: false, error: 'Provide at least a reply message or an image' })

    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'

    const rule = {
        trigger: trigger.trim(),
        responseType: hasImage ? 'image' : 'text',
        responseText: hasText ? String(responseText).trim() : '',
        imagePath: hasImage ? req.file.path : '',
        imageOriginalName: hasImage ? (req.file.originalname || '') : '',
        caption: hasImage ? String(caption || '').trim() : '',
    }

    console.log('[contacts] saving rule:', rule)

    try {
        const contact = await Contact.findOneAndUpdate(
            { userId: req.user.userId, chatId },
            { $push: { autoReplyRules: rule } },
            { new: true }
        )
        if (!contact) return res.status(404).json({ ok: false, error: 'Contact not found' })
        return res.json({ ok: true, contact })
    } catch (err) {
        console.error('[contacts] add rule error', err)
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
