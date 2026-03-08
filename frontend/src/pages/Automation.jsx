import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = 'http://localhost:3000'

export function Automation() {
    const { token } = useAuth()
    const [rules, setRules] = useState([])
    const [trigger, setTrigger] = useState('')
    const [reply, setReply] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    const authFetch = (url, opts = {}) => fetch(`${API_BASE}${url}`, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } })

    useEffect(() => { loadRules() }, [])

    async function loadRules() {
        setIsLoading(true)
        try {
            const res = await authFetch('/api/global-rules')
            const data = await res.json()
            if (data.ok) setRules(data.rules)
        } catch (_) { } finally { setIsLoading(false) }
    }

    async function handleAdd(e) {
        e.preventDefault()
        if (!trigger.trim() || !reply.trim()) return
        try {
            const res = await authFetch('/api/global-rules', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: trigger.trim(), reply: reply.trim() })
            })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setRules(prev => [data.rule, ...prev])
            setTrigger(''); setReply('')
        } catch { alert('Network error') }
    }

    async function handleToggle(id, enabled) {
        try {
            const res = await authFetch(`/api/global-rules/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !enabled })
            })
            const data = await res.json()
            if (data.ok) setRules(prev => prev.map(r => r._id === id ? data.rule : r))
        } catch { alert('Network error') }
    }

    async function handleDelete(id) {
        try {
            const res = await authFetch(`/api/global-rules/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.ok) setRules(prev => prev.filter(r => r._id !== id))
        } catch { alert('Network error') }
    }

    return (
        <section className="contact-page">
            <h3 style={{ marginTop: 0 }}>Global Automation Rules</h3>
            <p className="meta" style={{ marginBottom: 20 }}>These rules apply to <strong style={{ color: 'var(--text)' }}>all contacts</strong>. Contact-specific rules (set on the Contacts page) take priority over these.</p>

            {/* Add rule form */}
            <form onSubmit={handleAdd} className="send-form" style={{ gridTemplateColumns: '1fr 2fr auto', marginBottom: 24 }}>
                <input value={trigger} onChange={e => setTrigger(e.target.value)} type="text" placeholder="Trigger keyword (e.g. price)" required />
                <input value={reply} onChange={e => setReply(e.target.value)} type="text" placeholder="Auto-reply message (e.g. Our price is ₹999)" required />
                <button type="submit">+ Add Rule</button>
            </form>

            {isLoading && <div className="meta">Loading rules…</div>}
            {!isLoading && rules.length === 0 && <div className="meta">No global rules yet. Add your first rule above.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rules.map(r => (
                    <div key={r._id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto auto', gap: 12, alignItems: 'center', padding: '14px 16px', background: 'var(--bg)', border: `1px solid ${r.enabled ? 'var(--border)' : 'transparent'}`, borderRadius: 12, opacity: r.enabled ? 1 : 0.5 }}>
                        <div style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.12)', borderRadius: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>🔑 {r.trigger}</div>
                        <div style={{ fontSize: 14 }}>{r.reply}</div>
                        <button onClick={() => handleToggle(r._id, r.enabled)}
                            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: r.enabled ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                            {r.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button onClick={() => handleDelete(r._id)}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                ))}
            </div>
        </section>
    )
}
