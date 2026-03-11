const mongoose = require('mongoose')

const GlobalRuleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trigger: { type: String, required: true, trim: true },
    // Text response (optional)
    responseText: { type: String, default: '' },
    // File attachments (0 or more)
    attachments: [{
        filePath: { type: String, default: '' },
        originalName: { type: String, default: '' },
        mimetype: { type: String, default: '' },
    }],
    enabled: { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('GlobalRule', GlobalRuleSchema)
