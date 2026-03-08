const Contact = require('../models/Contact')
const GlobalRule = require('../models/GlobalRule')

/**
 * Two-tier auto-reply engine.
 * Priority: contact-specific rules → global rules → null (silence)
 *
 * @param {string} userId   - authenticated user's MongoDB ObjectId string
 * @param {string} chatId   - sender's WhatsApp chatId (e.g. 919xxxxxxx@c.us)
 * @param {string} body     - message body text
 * @returns {Promise<string|null>} reply text, or null if no rule matched
 */
async function getAutoReply(userId, chatId, body) {
    if (!body) return null
    const lowerBody = body.toLowerCase()

    // 1. Contact-specific rules (highest priority)
    const contact = await Contact.findOne({ userId, chatId }).lean()
    if (contact && contact.autoReplyEnabled && Array.isArray(contact.autoReplyRules)) {
        for (const rule of contact.autoReplyRules) {
            if (!rule.trigger) continue
            if (lowerBody.includes(rule.trigger.toLowerCase())) {
                return rule.reply
            }
        }
    }

    // 2. Global rules (fallback)
    const globalRules = await GlobalRule.find({ userId, enabled: true }).lean()
    for (const rule of globalRules) {
        if (!rule.trigger) continue
        if (lowerBody.includes(rule.trigger.toLowerCase())) {
            return rule.reply
        }
    }

    // 3. No match → silence
    return null
}

module.exports = { getAutoReply }
