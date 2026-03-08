const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password required' })
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })
    try {
        const existing = await User.findOne({ username: username.toLowerCase().trim() })
        if (existing) return res.status(409).json({ ok: false, error: 'Username already taken' })
        const passwordHash = await bcrypt.hash(password, 10)
        const user = await User.create({ username: username.toLowerCase().trim(), passwordHash })
        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
        return res.status(201).json({ ok: true, token, username: user.username })
    } catch (err) {
        console.error('[auth] register error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password required' })
    try {
        const user = await User.findOne({ username: username.toLowerCase().trim() })
        if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
        const match = await bcrypt.compare(password, user.passwordHash)
        if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
        return res.json({ ok: true, token, username: user.username })
    } catch (err) {
        console.error('[auth] login error', err)
        return res.status(500).json({ ok: false, error: 'Server error' })
    }
})

module.exports = router
