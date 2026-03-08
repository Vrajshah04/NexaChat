const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: String, required: true },  // your WA phone number — scopes data per account
    chatId: { type: String },                  // the other party's chatId
    from: { type: String },
    to: { type: String },
    body: { type: String, default: '' },
    fromMe: { type: Boolean, default: false },
    hasMedia: { type: Boolean, default: false },
    mediaInfo: { type: Object, default: null },   // { mimetype, filename, data (base64) }
    type: { type: String },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    timestamp: { type: Date, default: Date.now },
}, { timestamps: true })

// TTL index: MongoDB auto-deletes messages older than 30 days
MessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

// Query index: fetch latest messages for a user fast
MessageSchema.index({ userId: 1, timestamp: -1 })

module.exports = mongoose.model('Message', MessageSchema)
