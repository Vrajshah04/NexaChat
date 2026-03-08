import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
    { path: '/', label: '💬 WhatsApp' },
    { path: '/contacts', label: '👤 Contacts' },
    { path: '/automation', label: '⚡ Automation' },
    { path: '/analytics', label: '📊 Analytics' },
]

export function AppShell() {
    const { username, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <div className="app">
            <div className="layout">
                <aside className="sidebar">
                    <h2 className="sidebar-title">WA Dashboard</h2>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Signed in as <strong style={{ color: 'var(--text)' }}>{username}</strong></p>
                    <nav className="nav">
                        {NAV.map(item => (
                            <button key={item.path}
                                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                onClick={() => navigate(item.path)}>
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <button onClick={logout}
                        style={{ display: 'block', width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: 500, fontSize: 14, marginTop: 24 }}>
                        Sign Out
                    </button>
                </aside>
                <main className="main-area">
                    <header className="app-header">
                        <h1>Messaging Console</h1>
                    </header>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
