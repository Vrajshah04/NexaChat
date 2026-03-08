import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = 'http://localhost:3000'

export function Contacts() {
    const { token } = useAuth()
    const [contacts, setContacts] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedRules, setExpandedRules] = useState({})
    const nameRef = useRef(null)
    const numberRef = useRef(null)
    const attachmentRef = useRef(null)

    const authFetch = (url, opts = {}) => fetch(`${API_BASE}${url}`, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } })

    useEffect(() => {
        loadContacts()
    }, [])

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
        form.append('name', name); form.append('number', number)
        if (attachmentRef.current?.files?.[0]) form.append('attachment', attachmentRef.current.files[0])
        try {
            const res = await authFetch('/api/contacts', { method: 'POST', body: form })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => { const filtered = prev.filter(c => c.chatId !== data.contact.chatId); return [...filtered, data.contact] })
            if (nameRef.current) nameRef.current.value = ''
            if (numberRef.current) numberRef.current.value = ''
            if (attachmentRef.current) attachmentRef.current.value = ''
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

    async function handleAddRule(chatId, trigger, reply) {
        const num = chatId.replace('@c.us', '')
        try {
            const res = await authFetch(`/api/contacts/${num}/rules`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger, reply })
            })
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

            {/* Add contact form */}
            <form onSubmit={handleAddContact} className="send-form" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', marginBottom: 24 }}>
                <input ref={nameRef} type="text" placeholder="Name" required />
                <input ref={numberRef} type="tel" placeholder="Number (e.g. 919558804843)" required />
                <input ref={attachmentRef} type="file" title="Default attachment (optional)" />
                <button type="submit">Save</button>
            </form>

            {isLoading && <div className="meta">Loading contacts…</div>}
            {!isLoading && contacts.length === 0 && <div className="meta">No contacts yet. Add one above.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {contacts.map(c => (
                    <div key={c.chatId} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                        {/* Contact header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '14px 16px' }}>
                            <div>
                                <div><strong>{c.name}</strong> <span className="meta" style={{ display: 'inline' }}>({c.number})</span></div>
                                <div className="meta">{(c.autoReplyRules || []).length} rule{c.autoReplyRules?.length !== 1 ? 's' : ''} · {c.attachmentOriginalName || 'no attachment'}</div>
                            </div>
                            <button className="tab" onClick={() => setExpandedRules(p => ({ ...p, [c.chatId]: !p[c.chatId] }))}>
                                {expandedRules[c.chatId] ? '▲ Rules' : '▼ Rules'}
                            </button>
                            <button onClick={() => handleDeleteContact(c.chatId)} style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Remove</button>
                        </div>

                        {/* Expandable rules section */}
                        {expandedRules[c.chatId] && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)' }}>Contact-specific auto-reply rules (override global rules):</p>
                                {(c.autoReplyRules || []).length === 0 && <div className="meta">No rules yet.</div>}
                                {(c.autoReplyRules || []).map(r => (
                                    <div key={r._id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                                        <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, fontSize: 13, color: 'var(--accent)' }}>🔑 {r.trigger || '(any)'}</div>
                                        <div style={{ padding: '8px 12px', background: 'var(--panel)', borderRadius: 8, fontSize: 13 }}>{r.reply}</div>
                                        <button onClick={() => handleDeleteRule(c.chatId, r._id)} style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>✕</button>
                                    </div>
                                ))}
                                {/* Add rule inline form */}
                                <AddRuleForm onAdd={(trigger, reply) => handleAddRule(c.chatId, trigger, reply)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

function AddRuleForm({ onAdd }) {
    const [trigger, setTrigger] = useState('')
    const [reply, setReply] = useState('')
    function submit(e) {
        e.preventDefault()
        if (!trigger.trim() || !reply.trim()) return
        onAdd(trigger.trim(), reply.trim())
        setTrigger(''); setReply('')
    }
    return (
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 10 }}>
            <input value={trigger} onChange={e => setTrigger(e.target.value)} type="text" placeholder="Trigger keyword" required
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
            <input value={reply} onChange={e => setReply(e.target.value)} type="text" placeholder="Reply message" required
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
            <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--accent)', color: '#052e16', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}>+ Add</button>
        </form>
    )
}
