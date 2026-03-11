import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    User,
    Lock,
    ShieldCheck,
    LogIn,
    UserPlus,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function Login() {
    const [tab, setTab] = useState('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            })
            const data = await res.json()
            if (!data.ok) { setError(data.error || 'Failed'); return }
            login(data.token, data.username)
            navigate('/')
        } catch {
            setError('Network error — make sure the server is running')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            padding: 20
        }}>
            {/* Background decorative elements */}
            <div style={{ position: 'fixed', top: '10%', left: '5%', width: 300, height: 300, background: 'var(--accent)', filter: 'blur(150px)', opacity: 0.1, zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '10%', right: '5%', width: 400, height: 400, background: '#3b82f6', filter: 'blur(200px)', opacity: 0.05, zIndex: 0 }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass shadow-lg"
                style={{
                    padding: 48,
                    width: '100%',
                    maxWidth: 440,
                    borderRadius: 32,
                    position: 'relative',
                    zIndex: 1,
                    background: 'rgba(12, 12, 14, 0.6)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
                    >
                        <ShieldCheck size={36} />
                    </motion.div>
                    <h1 style={{ margin: '0 0 10px 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>Welcome back</h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 16 }}>Secure access to your dashboard</p>
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 32, background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 16 }}>
                    <button
                        onClick={() => { setTab('login'); setError('') }}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: 12,
                            border: 'none',
                            background: tab === 'login' ? 'var(--panel)' : 'transparent',
                            color: tab === 'login' ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: tab === 'login' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <LogIn size={16} />
                        Login
                    </button>
                    <button
                        onClick={() => { setTab('register'); setError('') }}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: 12,
                            border: 'none',
                            background: tab === 'register' ? 'var(--panel)' : 'transparent',
                            color: tab === 'register' ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: tab === 'register' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <UserPlus size={16} />
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '0 16px', border: '1px solid var(--border)', transition: 'border-color 0.2s' }}>
                            <User size={18} color="var(--text-muted)" />
                            <input
                                type="text" placeholder="Your account name" value={username} required autoFocus
                                onChange={e => setUsername(e.target.value)}
                                style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 12px', color: 'var(--text)', fontSize: 15 }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '0 16px', border: '1px solid var(--border)', transition: 'border-color 0.2s' }}>
                            <Lock size={18} color="var(--text-muted)" />
                            <input
                                type="password" placeholder="••••••••" value={password} required
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 12px', color: 'var(--text)', fontSize: 15 }}
                            />
                        </div>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13, background: 'rgba(244, 63, 94, 0.05)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(244, 63, 94, 0.2)' }}
                            >
                                <AlertCircle size={16} />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button type="submit" disabled={loading}
                        style={{
                            marginTop: 12,
                            padding: '16px',
                            borderRadius: 16,
                            background: 'var(--accent)',
                            color: '#052e16',
                            fontWeight: 700,
                            fontSize: 16,
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Securing session...
                            </>
                        ) : (
                            <>
                                {tab === 'login' ? 'Sign In Now' : 'Create Access'}
                                <LogIn size={20} />
                            </>
                        )}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        By continuing, you agree to the <span style={{ color: 'var(--text)', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>.
                    </p>
                </form>
            </motion.div>
        </div>
    )
}
