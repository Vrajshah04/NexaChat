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
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } })

// GET /api/contacts
router.get('/', async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user.userId }).sort({ name: 1 }).lean()
        return res.json({ ok: true, contacts })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/contacts — add or update a contact (no file upload here)
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
        return res.json({ ok: true, removed: Boolean(contact) })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/contacts/:number/rules — add an auto-reply rule (text, attachments, or both)
router.post('/:number/rules', upload.any(), async (req, res) => {
    console.log('[contacts] POST rule - files:', req.files?.length ?? 0)
    console.log('[contacts] POST rule - body:', req.body)

    const { trigger, responseText } = req.body || {}
    if (!trigger) return res.status(400).json({ ok: false, error: 'trigger is required' })
    const hasFiles = Boolean(req.files && req.files.length > 0)
    const hasText = Boolean(responseText && String(responseText).trim())
    if (!hasFiles && !hasText) return res.status(400).json({ ok: false, error: 'Provide at least a reply message or an attachment' })

    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'

    const attachments = hasFiles
        ? req.files.map(f => ({
            filePath: f.path,
            originalName: f.originalname || '',
            mimetype: f.mimetype || 'application/octet-stream',
        }))
        : []

    const rule = {
        trigger: trigger.trim(),
        responseText: hasText ? String(responseText).trim() : '',
        attachments,
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

// PUT /api/contacts/:number/rules/:ruleId
router.put('/:number/rules/:ruleId', upload.any(), async (req, res) => {
    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        const { trigger, responseText, keptAttachments } = req.body || {}

        const contact = await Contact.findOne({ userId: req.user.userId, chatId }).lean()
        if (!contact) return res.status(404).json({ ok: false, error: 'Contact not found' })

        const existingRule = (contact.autoReplyRules || []).find(r => String(r._id) === req.params.ruleId)
        if (!existingRule) return res.status(404).json({ ok: false, error: 'Rule not found' })

        let finalAttachments = existingRule.attachments || []
        if (keptAttachments !== undefined) {
            try {
                const keptPaths = JSON.parse(keptAttachments)
                finalAttachments = (existingRule.attachments || []).filter(att => keptPaths.includes(att.filePath))

                const removed = (existingRule.attachments || []).filter(att => !keptPaths.includes(att.filePath))
                for (const att of removed) {
                    if (att.filePath) fs.promises.unlink(att.filePath).catch(() => { })
                }
            } catch (e) {
                finalAttachments = existingRule.attachments || []
            }

            const newFiles = (req.files || []).map(f => ({
                filePath: f.path,
                originalName: f.originalname || '',
                mimetype: f.mimetype || 'application/octet-stream',
            }))
            finalAttachments = [...finalAttachments, ...newFiles]
        }

        const updateRule = {}
        if (trigger !== undefined) updateRule['autoReplyRules.$.trigger'] = trigger.trim()
        if (responseText !== undefined) updateRule['autoReplyRules.$.responseText'] = responseText.trim()
        if (keptAttachments !== undefined || (req.files && req.files.length > 0)) {
            updateRule['autoReplyRules.$.attachments'] = finalAttachments
        }

        const updatedContact = await Contact.findOneAndUpdate(
            { userId: req.user.userId, chatId, 'autoReplyRules._id': req.params.ruleId },
            { $set: updateRule },
            { new: true }
        )

        return res.json({ ok: true, contact: updatedContact })
    } catch (err) {
        console.error('[contacts] update rule error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// DELETE /api/contacts/:number/rules/:ruleId
router.delete('/:number/rules/:ruleId', async (req, res) => {
    const cleanNumber = String(req.params.number).replace(/\D/g, '')
    const chatId = cleanNumber + '@c.us'
    try {
        // Find the contact first to clean up attachment files
        const contactBefore = await Contact.findOne({ userId: req.user.userId, chatId }).lean()
        if (contactBefore) {
            const ruleToDelete = (contactBefore.autoReplyRules || []).find(r => String(r._id) === req.params.ruleId)
            if (ruleToDelete && Array.isArray(ruleToDelete.attachments)) {
                for (const att of ruleToDelete.attachments) {
                    if (att.filePath) fs.promises.unlink(att.filePath).catch(() => { })
                }
            }
        }
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
