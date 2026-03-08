const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const GlobalRule = require('../models/GlobalRule')

const router = express.Router()

// Multer setup for global rule images
const uploadsDir = path.resolve(__dirname, '..', 'uploads')
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }) } catch (_) { }

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
        cb(null, 'global-' + Date.now() + '-' + safe)
    }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// GET /api/global-rules
router.get('/', async (req, res) => {
    try {
        const rules = await GlobalRule.find({ userId: req.user.userId }).sort({ createdAt: -1 }).lean()
        return res.json({ ok: true, rules })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/global-rules — supports text + image
router.post('/', upload.single('image'), async (req, res) => {
    const { trigger, responseText, caption } = req.body || {}
    if (!trigger) return res.status(400).json({ ok: false, error: 'trigger is required' })

    const hasImage = Boolean(req.file)
    const hasText = Boolean(responseText && String(responseText).trim())

    if (!hasImage && !hasText) {
        return res.status(400).json({ ok: false, error: 'Provide at least a reply message or an image' })
    }

    try {
        const ruleData = {
            userId: req.user.userId,
            trigger: trigger.trim(),
            responseType: hasImage ? 'image' : 'text',
            responseText: hasText ? String(responseText).trim() : '',
            imagePath: hasImage ? req.file.path : '',
            imageOriginalName: hasImage ? (req.file.originalname || '') : '',
            caption: hasImage ? String(caption || '').trim() : '',
        }
        const rule = await GlobalRule.create(ruleData)
        return res.status(201).json({ ok: true, rule })
    } catch (err) {
        console.error('[globalRules] save error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// PUT /api/global-rules/:id — update rule (file upload not supported in simple PUT yet, mainly for toggle)
router.put('/:id', async (req, res) => {
    const { trigger, responseText, caption, enabled } = req.body || {}
    try {
        const update = {}
        if (trigger !== undefined) update.trigger = trigger.trim()
        if (responseText !== undefined) update.responseText = responseText.trim()
        if (caption !== undefined) update.caption = caption.trim()
        if (enabled !== undefined) update.enabled = enabled

        // Note: If both imagePath and responseText become empty, we don't handle it here yet.
        // Detailed file replacement logic can be added if needed.

        const rule = await GlobalRule.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { $set: update },
            { new: true }
        )
        if (!rule) return res.status(404).json({ ok: false, error: 'Rule not found' })
        return res.json({ ok: true, rule })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// DELETE /api/global-rules/:id
router.delete('/:id', async (req, res) => {
    try {
        const rule = await GlobalRule.findOneAndDelete({ _id: req.params.id, userId: req.user.userId })
        if (!rule) return res.status(404).json({ ok: false, error: 'Rule not found' })
        // Clean up image file if it exists
        if (rule.imagePath) {
            fs.promises.unlink(rule.imagePath).catch(() => { })
        }
        return res.json({ ok: true })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
