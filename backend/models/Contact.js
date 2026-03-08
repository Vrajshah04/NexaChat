const mongoose = require('mongoose')

const AutoReplyRuleSchema = new mongoose.Schema({
    trigger: { type: String, required: true, trim: true },
    responseType: { type: String, enum: ['text', 'image'], default: 'text' },
    // Text response
    responseText: { type: String, default: '' },
    // Image response
    imagePath: { type: String, default: '' },   // server-side path to uploaded image
    imageOriginalName: { type: String, default: '' },
    caption: { type: String, default: '' },   // optional caption under the image
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
