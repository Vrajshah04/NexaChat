const mongoose = require('mongoose')

const GlobalRuleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trigger: { type: String, required: true, trim: true },
    reply: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('GlobalRule', GlobalRuleSchema)
