import React, { useRef, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useWA } from '../context/WAContext'
import {
    Send,
    Paperclip,
    MessageSquare,
    RefreshCcw,
    QrCode,
    X,
    User,
    Clock,
    Image as ImageIcon,
    FileText,
    Film,
    File
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function FileTypeIcon({ mimetype, size = 13 }) {
    if (!mimetype) return <File size={size} />
    if (mimetype.startsWith('image/')) return <ImageIcon size={size} />
    if (mimetype.startsWith('video/')) return <Film size={size} />
    if (mimetype.startsWith('text/') || mimetype === 'application/pdf') return <FileText size={size} />
    return <File size={size} />
}

function formatDateLabel(date) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === yesterday.getTime()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function Dashboard() {
    const { token } = useAuth()
    const { isReady, qrDataUrl, showQrModal, setShowQrModal, messages } = useWA()

    const numberRef = useRef(null)
    const captionRef = useRef(null)
    const fileInputRef = useRef(null)
    const messagesEndRef = useRef(null)

    // Multi-attachment state
    const [attachments, setAttachments] = useState([]) // Array of File objects

    const isInitialLoad = useRef(true)

    // Instant jump on first load, smooth scroll for new incoming messages
    useEffect(() => {
        if (!messagesEndRef.current) return
        if (isInitialLoad.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
            isInitialLoad.current = false
        } else {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const authFetch = (url, opts = {}) =>
        fetch(`${API_BASE}${url}`, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } })

    async function handleLogout() {
        try { await authFetch('/api/disconnect', { method: 'POST' }) } catch (_) { }
        try { await authFetch('/api/connect', { method: 'POST' }) } catch (_) { }
    }

    function handleFileChange(e) {
        const newFiles = Array.from(e.target.files || [])
        setAttachments(prev => [...prev, ...newFiles])
        e.target.value = '' // allow re-selecting same file
    }

    function removeAttachment(idx) {
        setAttachments(prev => prev.filter((_, i) => i !== idx))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const number = numberRef.current?.value.trim()
        if (!number) return

        const message = captionRef.current?.value?.trim() || ''
        const hasFiles = attachments.length > 0

        if (!hasFiles && !message) return

        try {
            const form = new FormData()
            form.append('number', number)
            if (message) form.append('message', message)
            for (const file of attachments) {
                form.append('attachment', file)
            }

            const res = await authFetch('/api/send', { method: 'POST', body: form })
            const data = await res.json()
            if (!data.ok) {
                alert(data.error || 'Failed to send')
            } else {
                if (captionRef.current) captionRef.current.value = ''
                setAttachments([])
            }
        } catch { alert('Network error') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header / Status Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`status ${isReady ? 'status-connected' : 'status-disconnected'}`}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                        {isReady ? 'Active' : 'Offline'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleLogout} className="nav-item glass" style={{ padding: '8px 16px', borderRadius: 99 }}>
                        <RefreshCcw size={14} />
                        <span>{isReady ? 'Logout' : 'Show QR'}</span>
                    </button>
                </div>
            </div>

            {/* Messages Feed */}
            <div className="messages" style={{ overflowY: 'auto' }}>
                <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}
                        >
                            <MessageSquare size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <p style={{ fontSize: 14 }}>Waiting for messages...</p>
                        </motion.div>
                    ) : (
                        messages.map((m, idx) => {
                            const fromMe = m?.fromMe
                            const body = m?.body || ''
                            const hasMedia = m?.hasMedia
                            const mediaInfo = m?.mediaInfo

                            // Date separator logic
                            const msgDate = new Date(m?.timestamp || Date.now())
                            const prevDate = idx > 0 ? new Date(messages[idx - 1]?.timestamp || Date.now()) : null
                            const isDifferentDay = !prevDate || msgDate.toDateString() !== prevDate.toDateString()

                            return (
                                <React.Fragment key={m?.id || idx}>
                                    {isDifferentDay && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            margin: '8px 0',
                                        }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                padding: '4px 14px',
                                                borderRadius: 99,
                                                letterSpacing: '0.02em',
                                            }}>
                                                {formatDateLabel(msgDate)}
                                            </span>
                                        </div>
                                    )}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className={`msg ${fromMe ? 'me' : 'them'}`}
                                    >
                                        <div style={{ fontSize: 11, fontWeight: 700, color: fromMe ? 'rgba(5, 46, 22, 0.7)' : 'var(--accent)', marginBottom: 4, opacity: 0.8 }}>
                                            {fromMe ? `To: ${m?.senderName || 'Recipient'}` : (m?.senderName || 'Contact')}
                                        </div>
                                        {hasMedia && mediaInfo ? (
                                            <div className="media-message">
                                                {mediaInfo.mimetype?.startsWith('image/') ? (
                                                    <img
                                                        src={`data:${mediaInfo.mimetype};base64,${mediaInfo.data}`}
                                                        alt={mediaInfo.filename}
                                                        style={{
                                                            maxWidth: '320px',
                                                            maxHeight: '400px',
                                                            objectFit: 'cover',
                                                            borderRadius: 12,
                                                            display: 'block',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="file-message glass" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                        <Paperclip size={18} />
                                                        <div className="file-info">
                                                            <div className="file-name">{mediaInfo.filename}</div>
                                                            <div className="file-type">{mediaInfo.mimetype}</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {body && <div style={{ marginTop: 8 }}>{body}</div>}
                                            </div>
                                        ) : body}
                                        <div className="msg-meta">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={10} />
                                                {new Date(m?.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </motion.div>
                                </React.Fragment>
                            )
                        })
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Floating Send Form Area */}
            <div className="send-form-container">
                {/* Attachment chips — shown above the form when files are selected */}
                <AnimatePresence>
                    {attachments.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: 8, height: 0 }}
                            style={{ overflow: 'hidden', marginBottom: 8 }}
                        >
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: 6,
                                padding: '10px 14px',
                                background: 'rgba(16, 185, 129, 0.06)',
                                border: '1px solid rgba(16, 185, 129, 0.18)',
                                borderRadius: 14,
                            }}>
                                {attachments.map((file, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '5px 10px 5px 8px',
                                            borderRadius: 20,
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            fontSize: 12, color: 'var(--accent)', fontWeight: 500,
                                            maxWidth: 220,
                                        }}
                                    >
                                        <FileTypeIcon mimetype={file.type} size={13} />
                                        <span style={{
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap', maxWidth: 160
                                        }}>
                                            {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            style={{
                                                background: 'none', border: 'none', padding: '1px 2px',
                                                cursor: 'pointer', color: 'var(--text-muted)',
                                                display: 'flex', alignItems: 'center', marginLeft: 2,
                                                borderRadius: 4,
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form className="send-form glass shadow-lg" onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0 12px', width: 200 }}>
                        <User size={16} color="var(--text-muted)" />
                        <input id="number" ref={numberRef} type="tel" placeholder="91955xxxxxxx" required style={{ width: '100%' }} />
                    </div>

                    <input id="caption" ref={captionRef} type="text" placeholder="Type a message..." style={{ paddingLeft: 8 }} />

                    <div style={{ display: 'flex', gap: 6 }}>
                        {/* Hidden multi-file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <label
                            className="nav-item"
                            style={{
                                padding: 10, cursor: 'pointer', margin: 0,
                                position: 'relative',
                                color: attachments.length > 0 ? 'var(--accent)' : undefined,
                                background: attachments.length > 0 ? 'var(--accent-light)' : undefined,
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip size={18} />
                            {attachments.length > 0 && (
                                <span style={{
                                    position: 'absolute', top: 4, right: 4,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: 'var(--accent)', color: '#052e16',
                                    fontSize: 9, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {attachments.length}
                                </span>
                            )}
                        </label>
                        <button type="submit" style={{ padding: '10px 16px' }}>
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            </div>

            {/* QR Modal rendered via portal → sits above everything */}
            {showQrModal && ReactDOM.createPortal(
                <AnimatePresence>
                    <motion.div
                        key="qr-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowQrModal(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9999,
                            background: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <motion.div
                            key="qr-card"
                            initial={{ scale: 0.92, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 24 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                            onClick={e => e.stopPropagation()}
                            className="glass"
                            style={{
                                padding: '40px 48px',
                                borderRadius: 28,
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                position: 'relative', maxWidth: 420, width: '90vw',
                            }}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowQrModal(false)}
                                style={{
                                    position: 'absolute', top: 16, right: 16,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8, width: 32, height: 32,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: 'var(--text-muted)',
                                }}
                            >
                                <X size={16} />
                            </button>

                            {/* Icon */}
                            <div style={{
                                width: 56, height: 56, borderRadius: 18,
                                background: 'var(--accent-light)',
                                border: '1px solid rgba(16,185,129,0.25)',
                                color: 'var(--accent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: 20,
                            }}>
                                <QrCode size={28} />
                            </div>

                            <h3 style={{ margin: '0 0 8px 0', fontSize: 22, textAlign: 'center' }}>
                                Connect WhatsApp
                            </h3>
                            <p style={{ margin: '0 0 28px 0', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
                                Open WhatsApp on your phone → Linked Devices → Link a Device
                            </p>

                            {/* QR code box */}
                            {qrDataUrl ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        background: '#fff', padding: 14,
                                        borderRadius: 20,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                    }}
                                >
                                    <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220, display: 'block' }} />
                                </motion.div>
                            ) : (
                                <div style={{
                                    width: 248, height: 248,
                                    background: 'rgba(255,255,255,0.04)',
                                    borderRadius: 20, border: '1px solid var(--border)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    color: 'var(--text-muted)',
                                }}>
                                    <RefreshCcw size={28} style={{ opacity: 0.4, animation: 'spin 1.5s linear infinite' }} />
                                    <span style={{ fontSize: 13 }}>Generating QR…</span>
                                </div>
                            )}

                            {/* Status pill */}
                            <div style={{
                                marginTop: 24, display: 'flex', alignItems: 'center', gap: 8,
                                background: 'rgba(16,185,129,0.08)',
                                border: '1px solid rgba(16,185,129,0.2)',
                                padding: '7px 18px', borderRadius: 99,
                                fontSize: 13, color: 'var(--text-muted)',
                            }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
                                Waiting for scan…
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
