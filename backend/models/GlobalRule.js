const mongoose = require('mongoose')

const GlobalRuleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trigger: { type: String, required: true, trim: true },
    // responseType auto-detected: image if imagePath exists, else text
    responseType: { type: String, enum: ['text', 'image'], default: 'text' },
    // Text response
    responseText: { type: String, default: '' },
    // Image response
    imagePath: { type: String, default: '' },
    imageOriginalName: { type: String, default: '' },
    caption: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('GlobalRule', GlobalRuleSchema)
