const mongoose = require('mongoose')

const AutoReplyRuleSchema = new mongoose.Schema({
    trigger: { type: String, required: true },
    reply: { type: String, required: true },
})

const ContactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chatId: { type: String, required: true },   // e.g. 919558804843@c.us
    name: { type: String, required: true },
    number: { type: String, required: true },
    autoReplyEnabled: { type: Boolean, default: true },
    autoReplyRules: [AutoReplyRuleSchema],
    attachmentPath: { type: String, default: '' },
    attachmentMimetype: { type: String, default: '' },
    attachmentOriginalName: { type: String, default: '' },
}, { timestamps: true })

// One contact record per chatId per user
ContactSchema.index({ userId: 1, chatId: 1 }, { unique: true })

module.exports = mongoose.model('Contact', ContactSchema)
