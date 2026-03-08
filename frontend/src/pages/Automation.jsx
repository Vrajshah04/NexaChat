import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function Automation() {
    const { token } = useAuth()
    const [rules, setRules] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    // Form state
    const [trigger, setTrigger] = useState('')
    const [responseText, setResponseText] = useState('')
    const [caption, setCaption] = useState('')
    const imageRef = useRef(null)

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
        if (!trigger.trim()) return
        if (!responseText.trim() && !imageRef.current?.files?.[0]) {
            alert('Provide at least a reply message or an image')
            return
        }

        const form = new FormData()
        form.append('trigger', trigger.trim())
        if (responseText.trim()) form.append('responseText', responseText.trim())
        if (imageRef.current?.files?.[0]) {
            form.append('image', imageRef.current.files[0])
            if (caption.trim()) form.append('caption', caption.trim())
        }

        try {
            const res = await authFetch('/api/global-rules', {
                method: 'POST',
                body: form // fetch handles multipart boundary automatically
            })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setRules(prev => [data.rule, ...prev])
            setTrigger('')
            setResponseText('')
            setCaption('')
            if (imageRef.current) imageRef.current.value = ''
        } catch { alert('Network error') }
    }

    async function handleToggle(id, enabled) {
        try {
            const res = await authFetch(`/api/global-rules/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

    const inp = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }

    return (
        <section className="contact-page">
            <h3 style={{ marginTop: 0 }}>Global Automation Rules</h3>
            <p className="meta" style={{ marginBottom: 20 }}>These rules apply to <strong style={{ color: 'var(--text)' }}>all contacts</strong>. Contact-specific rules (set on the Contacts page) take priority over these.</p>

            {/* Add rule form */}
            <form onSubmit={handleAdd} style={{ background: 'rgba(34,197,94,0.05)', border: '1px dashed rgba(34,197,94,0.3)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600, marginBottom: 12 }}>+ Add Global Rule</div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>TRIGGER KEYWORD *</label>
                    <input value={trigger} onChange={e => setTrigger(e.target.value)} placeholder='e.g. "price"' required style={inp} />
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>REPLY MESSAGE (optional)</label>
                    <input value={responseText} onChange={e => setResponseText(e.target.value)} placeholder='e.g. "Our price is ₹999"' style={inp} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>IMAGE (optional)</label>
                        <input ref={imageRef} type="file" accept="image/*" style={{ ...inp, padding: '6px 10px' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>IMAGE CAPTION (optional)</label>
                        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder='e.g. "Pricing chart"' style={inp} />
                    </div>
                </div>

                <button type="submit" style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--accent)', color: '#052e16', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                    Save Global Rule
                </button>
            </form>

            {isLoading && <div className="meta">Loading rules…</div>}
            {!isLoading && rules.length === 0 && <div className="meta">No global rules yet. Add your first rule above.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rules.map(r => (
                    <div key={r._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr auto auto', gap: 16, alignItems: 'start', padding: '16px', background: 'var(--bg)', border: `1px solid ${r.enabled ? 'var(--border)' : 'transparent'}`, borderRadius: 14, opacity: r.enabled ? 1 : 0.6 }}>
                        {/* Trigger */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Trigger</span>
                            <div style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.12)', borderRadius: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 500, whiteSpace: 'nowrap' }}>🔑 {r.trigger}</div>
                        </div>

                        {/* Response */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Response</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {r.responseText && (
                                    <div style={{ fontSize: 14, color: 'var(--text)' }}>
                                        <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 6 }}>💬</span>
                                        {r.responseText}
                                    </div>
                                )}
                                {r.imagePath && (
                                    <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--panel)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 6 }}>🖼 IMAGE:</span>
                                        <span style={{ fontWeight: 500 }}>{r.imageOriginalName || 'Uploaded Image'}</span>
                                        {r.caption && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>Caption: {r.caption}</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ marginTop: 20 }}>
                            <button onClick={() => handleToggle(r._id, r.enabled)}
                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: r.enabled ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500, minWidth: 80 }}>
                                {r.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                        <div style={{ marginTop: 20 }}>
                            <button onClick={() => handleDelete(r._id)}
                                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
