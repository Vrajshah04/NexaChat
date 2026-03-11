import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    BarChart3,
    MessageSquare,
    Send,
    Activity,
    Clock,
    RefreshCcw,
    Loader2,
    Phone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function StatCard({ value, label, icon: Icon, color, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="glass card"
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 160,
                border: '1px solid var(--border)'
            }}
        >
            <div style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
            }}>
                <Icon size={24} />
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center' }}>{label}</div>
        </motion.div>
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 32 }}>Analytics</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Real-time performance metrics</p>
                </div>
                <button
                    className="nav-item glass"
                    onClick={load}
                    style={{ padding: '10px 20px', borderRadius: 99 }}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    <span>Refresh</span>
                </button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
                <StatCard
                    value={data?.messagesToday ?? 0}
                    label="Today's Messages"
                    icon={MessageSquare}
                    color="#10b981"
                    delay={0.1}
                />
                <StatCard
                    value={data?.activeChats ?? 0}
                    label="Active Chats"
                    icon={Activity}
                    color="#3b82f6"
                    delay={0.2}
                />
                <StatCard
                    value={data?.autoRepliesSent ?? 0}
                    label="Auto-Replies"
                    icon={Send}
                    color="#f59e0b"
                    delay={0.3}
                />
                <StatCard
                    value={data?.totalMessages ?? 0}
                    label="Total (30d)"
                    icon={BarChart3}
                    color="#a855f7"
                    delay={0.4}
                />
            </div>

            {/* Recent conversations */}
            <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <Clock size={20} color="var(--accent)" />
                    <h3 style={{ margin: 0, fontSize: 18 }}>Recent Activity</h3>
                </div>

                {!data && isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <Loader2 className="animate-spin" size={32} color="var(--accent)" />
                    </div>
                ) : (data?.recentChats || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                        No recent conversations detected.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <AnimatePresence>
                            {(data?.recentChats || []).map((c, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + (i * 0.05) }}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto 1fr auto',
                                        gap: 20,
                                        alignItems: 'center',
                                        padding: '16px 20px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 16,
                                        transition: 'all 0.2s ease'
                                    }}
                                    whileHover={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                        <Phone size={16} color="var(--text-muted)" />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{String(c._id || '').replace('@c.us', '')}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || '—'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                            {c.lastTime ? new Date(c.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {c.lastTime ? new Date(c.lastTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
