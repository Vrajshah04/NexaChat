const express = require('express')
const Message = require('../models/Message')
const Contact = require('../models/Contact')

const router = express.Router()

// GET /api/analytics
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const [messagesToday, totalMessages, autoRepliesSent] = await Promise.all([
            Message.countDocuments({ userId, timestamp: { $gte: todayStart } }),
            Message.countDocuments({ userId }),
            Message.countDocuments({ userId, direction: 'outbound', fromMe: true, timestamp: { $gte: todayStart } }),
        ])

        // Active chats: distinct chatIds with a message today
        const activeChatIds = await Message.distinct('chatId', { userId, timestamp: { $gte: todayStart } })

        // Recent conversations: last message per chatId
        const recentChats = await Message.aggregate([
            { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId) } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: '$chatId', lastMessage: { $first: '$body' }, lastTime: { $first: '$timestamp' }, direction: { $first: '$direction' } } },
            { $sort: { lastTime: -1 } },
            { $limit: 10 }
        ])

        return res.json({
            ok: true,
            messagesToday,
            totalMessages,
            activeChats: activeChatIds.length,
            autoRepliesSent,
            recentChats
        })
    } catch (err) {
        console.error('[analytics] error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
