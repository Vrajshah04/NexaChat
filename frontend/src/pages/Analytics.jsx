import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function StatCard({ value, label, color }) {
    return (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: color || 'var(--accent)' }}>{value}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{label}</div>
        </div>
    )
}

export function Analytics() {
    const { token } = useAuth()
    const [data, setData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    const authFetch = (url) => fetch(`${API_BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } })

    async function load() {
        setIsLoading(true)
        try {
            const res = await authFetch('/api/analytics')
            const json = await res.json()
            if (json.ok) setData(json)
        } catch (_) { } finally { setIsLoading(false) }
    }

    useEffect(() => {
        load()
        const interval = setInterval(load, 30000)
        return () => clearInterval(interval)
    }, [])

    if (isLoading && !data) return <div className="meta" style={{ padding: 32 }}>Loading analytics…</div>

    return (
        <section className="contact-page">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ marginTop: 0 }}>Analytics</h3>
                <button className="tab" onClick={load} style={{ fontSize: 13 }}>↻ Refresh</button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                <StatCard value={data?.messagesToday ?? 0} label="Messages Today" />
                <StatCard value={data?.activeChats ?? 0} label="Active Chats" color="#60a5fa" />
                <StatCard value={data?.autoRepliesSent ?? 0} label="Auto-replies Sent Today" color="#f59e0b" />
                <StatCard value={data?.totalMessages ?? 0} label="Total Messages (30d)" color="var(--muted)" />
            </div>

            {/* Recent conversations */}
            <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Recent Conversations</h4>
            {(data?.recentChats || []).length === 0 && <div className="meta">No conversations yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.recentChats || []).map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>{String(c._id || '').replace('@c.us', '')}</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.lastTime ? new Date(c.lastTime).toLocaleTimeString() : ''}</div>
                    </div>
                ))}
            </div>
        </section>
    )
}
