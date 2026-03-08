const express = require('express')
const GlobalRule = require('../models/GlobalRule')

const router = express.Router()

// GET /api/global-rules
router.get('/', async (req, res) => {
    try {
        const rules = await GlobalRule.find({ userId: req.user.userId }).sort({ createdAt: -1 }).lean()
        return res.json({ ok: true, rules })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/global-rules
router.post('/', async (req, res) => {
    const { trigger, reply } = req.body || {}
    if (!trigger || !reply) return res.status(400).json({ ok: false, error: 'trigger and reply are required' })
    try {
        const rule = await GlobalRule.create({ userId: req.user.userId, trigger: trigger.trim(), reply: reply.trim() })
        return res.status(201).json({ ok: true, rule })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// PUT /api/global-rules/:id
router.put('/:id', async (req, res) => {
    const { trigger, reply, enabled } = req.body || {}
    try {
        const rule = await GlobalRule.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { ...(trigger !== undefined && { trigger: trigger.trim() }), ...(reply !== undefined && { reply: reply.trim() }), ...(enabled !== undefined && { enabled }) },
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
        return res.json({ ok: true })
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
