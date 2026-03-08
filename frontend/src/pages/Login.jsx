import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE = 'http://localhost:3000'

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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>WhatsApp Dashboard</h1>
                <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 14 }}>Sign in to manage your automation</p>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    {['login', 'register'].map(t => (
                        <button key={t} onClick={() => { setTab(t); setError('') }}
                            className={`tab ${tab === t ? 'active' : ''}`}
                            style={{ flex: 1, padding: '10px', borderRadius: 10, textTransform: 'capitalize' }}>
                            {t}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input
                        type="text" placeholder="Username" value={username} required autoFocus
                        onChange={e => setUsername(e.target.value)}
                        style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                    />
                    <input
                        type="password" placeholder="Password (min 6 chars)" value={password} required
                        onChange={e => setPassword(e.target.value)}
                        style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                    />
                    {error && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
                    <button type="submit" disabled={loading}
                        style={{ padding: '13px', borderRadius: 12, background: 'var(--accent)', color: '#052e16', fontWeight: 600, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
                        {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    )
}
