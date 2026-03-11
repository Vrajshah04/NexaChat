const mongoose = require('mongoose')

const AutoReplyRuleSchema = new mongoose.Schema({
    trigger: { type: String, required: true, trim: true },
    // Text response (optional)
    responseText: { type: String, default: '' },
    // File attachments (0 or more)
    attachments: [{
        filePath: { type: String, default: '' },
        originalName: { type: String, default: '' },
        mimetype: { type: String, default: '' },
    }],
})

const ContactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chatId: { type: String, required: true },   // e.g. 919558804843@c.us
    name: { type: String, required: true },
    number: { type: String, required: true },
    autoReplyEnabled: { type: Boolean, default: true },
    autoReplyRules: [AutoReplyRuleSchema],
}, { timestamps: true })

// One contact record per chatId per user
ContactSchema.index({ userId: 1, chatId: 1 }, { unique: true })

module.exports = mongoose.model('Contact', ContactSchema)
