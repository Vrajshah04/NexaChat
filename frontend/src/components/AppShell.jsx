import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    MessageSquare,
    Users,
    Zap,
    BarChart3,
    LogOut,
    UserCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

const NAV = [
    { path: '/', label: 'Messaging', icon: MessageSquare },
    { path: '/contacts', label: 'Contacts', icon: Users },
    { path: '/automation', label: 'Automation', icon: Zap },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppShell() {
    const { username, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <div className="app">
            <div className="layout">
                <motion.aside
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="sidebar glass"
                >
                    <div className="sidebar-title">
                        {/* NexaChat logo — speech bubble */}
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="9.25" fill="#060f0c" stroke="#10b981" strokeWidth="1.5" />
                            <path d="M10 8.5H22C23.38 8.5 24.5 9.62 24.5 11V18C24.5 19.38 23.38 20.5 22 20.5H16.5L13 24V20.5H10C8.62 20.5 7.5 19.38 7.5 18V11C7.5 9.62 8.62 8.5 10 8.5Z" fill="#10b981" />
                            <circle cx="12.5" cy="14.5" r="1.4" fill="#052e16" />
                            <circle cx="16" cy="14.5" r="1.4" fill="#052e16" />
                            <circle cx="19.5" cy="14.5" r="1.4" fill="#052e16" />
                        </svg>
                        <span style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>NexaChat</span>
                    </div>

                    <div style={{ marginBottom: 32, padding: '0 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                <UserCircle size={24} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{username}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pro Account</span>
                            </div>
                        </div>
                    </div>

                    <nav className="nav">
                        {NAV.map((item, idx) => {
                            const Icon = item.icon
                            const isActive = location.pathname === item.path
                            return (
                                <motion.button
                                    key={item.path}
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                    onClick={() => navigate(item.path)}
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                    <span>{item.label}</span>
                                </motion.button>
                            )
                        })}
                    </nav>

                    <button onClick={logout} className="nav-item" style={{ marginTop: 'auto', border: '1px solid var(--border)' }}>
                        <LogOut size={18} color="var(--danger)" />
                        <span style={{ color: 'var(--danger)' }}>Sign Out</span>
                    </button>
                </motion.aside>

                <motion.main
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="main-area glass"
                >
                    <Outlet />
                </motion.main>
            </div>
        </div>
    )
}
