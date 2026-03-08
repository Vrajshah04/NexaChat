cls
import React, { useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWA } from '../context/WAContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function Dashboard() {
    const { token } = useAuth()
    const { isReady, qrDataUrl, showQrModal, setShowQrModal, messages } = useWA()

    const numberRef = useRef(null)
    const textRef = useRef(null)
    const sendAttachmentRef = useRef(null)
    const captionRef = useRef(null)
    const messagesEndRef = useRef(null)

    const authFetch = (url, opts = {}) =>
        fetch(`${API_BASE}${url}`, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } })

    async function handleLogout() {
        try { await authFetch('/api/disconnect', { method: 'POST' }) } catch (_) { }
        try { await authFetch('/api/connect', { method: 'POST' }) } catch (_) { }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const number = numberRef.current?.value.trim()
        if (!number) return
        try {
            const hasFile = Boolean(sendAttachmentRef.current?.files?.[0])
            let res
            if (hasFile) {
                const form = new FormData()
                form.append('number', number)
                const captionVal = textRef.current?.value?.trim() || ''
                const standaloneMsg = captionRef.current?.value?.trim() || ''
                if (captionVal) form.append('caption', captionVal)
                if (standaloneMsg) form.append('message', standaloneMsg)
                form.append('attachment', sendAttachmentRef.current.files[0])
                res = await authFetch('/api/send', { method: 'POST', body: form })
            } else {
                const standaloneMsg = captionRef.current?.value?.trim() || ''
                if (!standaloneMsg) return
                res = await authFetch('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number, message: standaloneMsg })
                })
            }
            const data = await res.json()
            if (!data.ok) alert(data.error || 'Failed to send')
            else {
                if (textRef.current) textRef.current.value = ''
                if (captionRef.current) captionRef.current.value = ''
                if (sendAttachmentRef.current) sendAttachmentRef.current.value = ''
            }
        } catch { alert('Network error') }
    }

    return (
        <section className="tab-content" id="tab-whatsapp">
            <section className="status-row">
                <div id="status-indicator" className={`status ${isReady ? 'status-connected' : 'status-disconnected'}`}>
                    {isReady ? '● Connected' : '○ Disconnected'}
                </div>
                <button onClick={handleLogout} className="tab" style={{ marginLeft: 8 }}>
                    {isReady ? 'Logout' : 'Show QR'}
                </button>
            </section>

            <section className="messages" id="messages">
                {messages.length === 0 && (
                    <div className="meta" style={{ textAlign: 'center', padding: '40px 0' }}>
                        No messages yet. Connect WhatsApp to start.
                    </div>
                )}
                {messages.map((m, idx) => {
                    const fromMe = m?.fromMe
                    const body = m?.body || ''
                    const hasMedia = m?.hasMedia
                    const mediaInfo = m?.mediaInfo
                    const who = fromMe ? `me → ${m?.to || ''}` : `${m?.from || ''} → me`
                    return (
                        <React.Fragment key={m?.id || idx}>
                            <div className={`msg ${fromMe ? 'me' : 'them'}`}>
                                {hasMedia && mediaInfo ? (
                                    <div className="media-message">
                                        {mediaInfo.mimetype?.startsWith('image/') ? (
                                            <img
                                                src={`data:${mediaInfo.mimetype};base64,${mediaInfo.data}`}
                                                alt={mediaInfo.filename}
                                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <div className="file-message">
                                                <div className="file-icon">📄</div>
                                                <div className="file-info">
                                                    <div className="file-name">{mediaInfo.filename}</div>
                                                    <div className="file-type">{mediaInfo.mimetype}</div>
                                                </div>
                                            </div>
                                        )}
                                        {body && <div className="media-caption">{body}</div>}
                                    </div>
                                ) : body}
                            </div>
                            <div className="meta">{`${who} • ${new Date(m?.timestamp || Date.now()).toLocaleTimeString()}`}</div>
                        </React.Fragment>
                    )
                })}
                <div ref={messagesEndRef} />
            </section>

            <form id="send-form" className="send-form" onSubmit={handleSubmit}
                style={{ gridTemplateColumns: '220px 1fr 1fr 1fr auto' }}>
                <input id="number" ref={numberRef} type="tel" placeholder="Phone number (e.g. 919558804843)" required />
                <input id="text" ref={textRef} type="text" placeholder="Caption (for file)" />
                <input ref={sendAttachmentRef} type="file" title="Attachment (optional)" />
                <input ref={captionRef} type="text" placeholder="Message" />
                <button type="submit">Send</button>
            </form>

            {showQrModal && (
                <div className="qr-modal show" onClick={() => setShowQrModal(false)}>
                    <div className="qr-modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Scan QR Code</h3>
                        <p>Open WhatsApp on your phone and scan this QR code</p>
                        {qrDataUrl
                            ? <img src={qrDataUrl} alt="WhatsApp QR Code" />
                            : <div style={{ width: 280, height: 280, background: '#f0f0f0', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}><p>Loading QR…</p></div>
                        }
                        <button className="qr-modal-close" onClick={() => setShowQrModal(false)}>Close</button>
                    </div>
                </div>
            )}
        </section>
    )
}
