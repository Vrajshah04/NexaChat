import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function Contacts() {
    const { token } = useAuth()
    const [contacts, setContacts] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedRules, setExpandedRules] = useState({})
    const nameRef = useRef(null)
    const numberRef = useRef(null)

    const authFetch = (url, opts = {}) =>
        fetch(`${API_BASE}${url}`, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } })

    useEffect(() => { loadContacts() }, [])

    async function loadContacts() {
        setIsLoading(true)
        try {
            const res = await authFetch('/api/contacts')
            const data = await res.json()
            if (data.ok) setContacts(data.contacts)
        } catch (_) { } finally { setIsLoading(false) }
    }

    async function handleAddContact(e) {
        e.preventDefault()
        const name = nameRef.current?.value.trim()
        const number = numberRef.current?.value.trim()
        if (!name || !number) return
        const form = new FormData()
        form.append('name', name)
        form.append('number', number)
        try {
            const res = await authFetch('/api/contacts', { method: 'POST', body: form })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => [...prev.filter(c => c.chatId !== data.contact.chatId), data.contact])
            nameRef.current.value = ''
            numberRef.current.value = ''
        } catch { alert('Network error') }
    }

    async function handleDeleteContact(chatId) {
        const num = chatId.replace('@c.us', '')
        try {
            const res = await authFetch(`/api/contacts/${num}`, { method: 'DELETE' })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => prev.filter(c => c.chatId !== chatId))
        } catch { alert('Network error') }
    }

    async function handleAddRule(chatId, formData) {
        const num = chatId.replace('@c.us', '')
        try {
            const res = await authFetch(`/api/contacts/${num}/rules`, { method: 'POST', body: formData })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => prev.map(c => c.chatId === chatId ? data.contact : c))
        } catch { alert('Network error') }
    }

    async function handleDeleteRule(chatId, ruleId) {
        const num = chatId.replace('@c.us', '')
        try {
            const res = await authFetch(`/api/contacts/${num}/rules/${ruleId}`, { method: 'DELETE' })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => prev.map(c => c.chatId === chatId ? data.contact : c))
        } catch { alert('Network error') }
    }

    return (
        <section className="contact-page">
            <h3 style={{ marginTop: 0 }}>Contacts</h3>

            <form onSubmit={handleAddContact} className="send-form"
                style={{ gridTemplateColumns: '1fr 1fr auto', marginBottom: 24 }}>
                <input ref={nameRef} type="text" placeholder="Name" required />
                <input ref={numberRef} type="tel" placeholder="Number (e.g. 919558804843)" required />
                <button type="submit">Save</button>
            </form>

            {isLoading && <div className="meta">Loading contacts…</div>}
            {!isLoading && contacts.length === 0 && <div className="meta">No contacts yet. Add one above.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {contacts.map(c => (
                    <div key={c.chatId} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

                        {/* Contact header row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '14px 16px' }}>
                            <div>
                                <div><strong>{c.name}</strong> <span className="meta" style={{ display: 'inline' }}>({c.number})</span></div>
                                <div className="meta">
                                    {(c.autoReplyRules || []).length} rule{c.autoReplyRules?.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <button className="tab"
                                onClick={() => setExpandedRules(p => ({ ...p, [c.chatId]: !p[c.chatId] }))}>
                                {expandedRules[c.chatId] ? '▲ Rules' : '▼ Rules'}
                            </button>
                            <button onClick={() => handleDeleteContact(c.chatId)}
                                style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                                Remove
                            </button>
                        </div>

                        {/* Expandable rules panel */}
                        {expandedRules[c.chatId] && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
                                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
                                    Contact rules • take priority over global rules
                                </p>

                                {/* Existing rules */}
                                {(c.autoReplyRules || []).length === 0 && (
                                    <div className="meta" style={{ marginBottom: 12 }}>No rules yet.</div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                    {(c.autoReplyRules || []).map(r => (
                                        <RuleCard key={r._id} rule={r} onDelete={() => handleDeleteRule(c.chatId, r._id)} />
                                    ))}
                                </div>

                                {/* Add rule form */}
                                <AddRuleForm onAdd={(formData) => handleAddRule(c.chatId, formData)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

/* ── Single rule display card ─────────────────────────────────────────── */
function RuleCard({ rule, onDelete }) {
    const hasImage = rule.responseType === 'image' && rule.imagePath
    const hasText = rule.responseText && rule.responseText.trim()

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'start', padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
            {/* Trigger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Trigger</span>
                <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.12)', borderRadius: 6, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                    🔑 {rule.trigger}
                </span>
            </div>

            {/* Response */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Response</span>

                {hasText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>💬 MESSAGE</span>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{rule.responseText}</div>
                    </div>
                )}

                {hasImage && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>🖼 IMAGE</span>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{rule.imageOriginalName || 'image'}</div>
                        {rule.caption && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Caption: {rule.caption}</div>}
                    </div>
                )}
            </div>

            {/* Delete */}
            <button onClick={onDelete}
                style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, marginTop: 18 }}>
                ✕
            </button>
        </div>
    )
}

/* ── Add rule form with dynamic fields ────────────────────────────────── */
function AddRuleForm({ onAdd }) {
    const [trigger, setTrigger] = useState('')
    const [responseText, setResponseText] = useState('')
    const [caption, setCaption] = useState('')
    const imageRef = useRef(null)

    function submit(e) {
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
        // responseType auto-detected by backend based on what's present
        onAdd(form)
        setTrigger('')
        setResponseText('')
        setCaption('')
        if (imageRef.current) imageRef.current.value = ''
    }

    const inp = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }

    return (
        <form onSubmit={submit} style={{ background: 'rgba(34,197,94,0.05)', border: '1px dashed rgba(34,197,94,0.3)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>+ Add Rule</div>

            <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>TRIGGER KEYWORD *</label>
                <input value={trigger} onChange={e => setTrigger(e.target.value)} placeholder='e.g. "resume"' required style={inp} />
            </div>

            <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>REPLY MESSAGE (optional)</label>
                <input value={responseText} onChange={e => setResponseText(e.target.value)} placeholder='e.g. "Check my resume at vraj.dev/resume"' style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>IMAGE (optional)</label>
                    <input ref={imageRef} type="file" accept="image/*" style={{ ...inp, padding: '6px 10px' }} />
                </div>
                <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>IMAGE CAPTION (optional)</label>
                    <input value={caption} onChange={e => setCaption(e.target.value)} placeholder='e.g. "Here is my portfolio"' style={inp} />
                </div>
            </div>

            <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', color: '#052e16', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Save Rule
            </button>
        </form>
    )
}
