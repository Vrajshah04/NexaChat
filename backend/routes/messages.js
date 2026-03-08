const express = require('express')
const Message = require('../models/Message')

const router = express.Router()

// GET /api/messages — last 100 messages for the authenticated user (within 30-day TTL window)
router.get('/', async (req, res) => {
    try {
        const messages = await Message.find({ userId: req.user.userId })
            .sort({ timestamp: -1 })
            .limit(100)
            .lean()
        return res.json({ ok: true, messages: messages.reverse() })
    } catch (err) {
        console.error('[messages] fetch error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
