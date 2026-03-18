import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    Zap,
    UserPlus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Key,
    MessageSquare,
    Image as ImageIcon,
    Plus,
    User,
    Hash,
    Loader2,
    Paperclip,
    X,
    FileText,
    Film,
    File,
    Edit2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Helpers shared between components
function AttachmentIcon({ mimetype, size = 14 }) {
    if (!mimetype) return <File size={size} />
    if (mimetype.startsWith('image/')) return <ImageIcon size={size} />
    if (mimetype.startsWith('video/')) return <Film size={size} />
    if (mimetype.startsWith('text/')) return <FileText size={size} />
    return <File size={size} />
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentChip({ att }) {
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: 12, color: 'var(--accent)', fontWeight: 500,
            maxWidth: 180,
        }}>
            <AttachmentIcon mimetype={att.mimetype} size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.originalName || 'Attachment'}
            </span>
        </div>
    )
}

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
        try {
            const res = await authFetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, number })
            })
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

    async function handleEditRule(chatId, ruleId, formData) {
        const num = chatId.replace('@c.us', '')
        try {
            const res = await authFetch(`/api/contacts/${num}/rules/${ruleId}`, { method: 'PUT', body: formData })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setContacts(prev => prev.map(c => c.chatId === chatId ? data.contact : c))
        } catch { alert('Network error') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
            {/* Page header */}
            <div style={{ marginBottom: 28, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent)', marginBottom: 6 }}>
                    <User size={16} />
                    <span style={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 12 }}>Contact Manager</span>
                </div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: 30 }}>Contacts</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                    Manage saved contacts and set <strong style={{ color: 'var(--text)' }}>contact-specific</strong> auto-reply rules.
                </p>
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

                {/* LEFT — Add contact form */}
                <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', paddingTop: 38, overflow: 'hidden' }}>
                    <motion.form
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onSubmit={handleAddContact}
                        className="glass"
                        style={{
                            padding: 24, borderRadius: 'var(--radius-xl)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            background: 'var(--accent-light)',
                            display: 'flex', flexDirection: 'column', gap: 16,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#052e16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <UserPlus size={17} />
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>Add Contact</span>
                        </div>

                        <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Name</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '0 12px', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
                                <User size={15} color="var(--accent)" />
                                <input ref={nameRef} type="text" placeholder="Contact Name" required
                                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '11px 10px', color: 'var(--text)', fontSize: 14 }} />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>WhatsApp Number</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '0 12px', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
                                <Hash size={15} color="var(--accent)" />
                                <input ref={numberRef} type="tel" placeholder="91955xxxxxxx" required
                                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '11px 10px', color: 'var(--text)', fontSize: 14 }} />
                            </div>
                        </div>

                        <button type="submit"
                            style={{ padding: '13px', background: 'var(--accent)', color: '#052e16', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 16px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <UserPlus size={17} />
                            Add Contact
                        </button>
                    </motion.form>
                </div>

                {/* RIGHT — Contacts list */}
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saved Contacts</span>
                        <span style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>{contacts.length} total</span>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                            <Loader2 className="animate-spin" size={28} color="var(--accent)" />
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="glass" style={{ textAlign: 'center', padding: 48, borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                            <User size={36} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: 14 }}>No contacts yet. Add one to get started.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {contacts.map((c, idx) => (
                                <motion.div
                                    key={c.chatId}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                    className="glass"
                                    style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
                                >
                                    {/* Contact header row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--accent-light)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                                <User size={19} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.number || c.chatId?.replace('@c.us', '')}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className="nav-item"
                                                style={{
                                                    padding: '7px 14px', borderRadius: 9, fontSize: 12,
                                                    background: expandedRules[c.chatId] ? 'var(--accent-light)' : 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${expandedRules[c.chatId] ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                                                    color: expandedRules[c.chatId] ? 'var(--accent)' : 'var(--text-muted)',
                                                }}
                                                onClick={() => setExpandedRules(p => ({ ...p, [c.chatId]: !p[c.chatId] }))}>
                                                <Zap size={14} />
                                                <span>{c.autoReplyRules?.length || 0} Rules</span>
                                                {expandedRules[c.chatId] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteContact(c.chatId)}
                                                style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', opacity: 0.65 }}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expandable rules panel */}
                                    <AnimatePresence>
                                        {expandedRules[c.chatId] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}
                                            >
                                                <div style={{ padding: 24 }}>
                                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 16 }}>Automation Rules</div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                                        {(c.autoReplyRules || []).length === 0 ? (
                                                            <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
                                                                No custom rules for this contact.
                                                            </div>
                                                        ) : (
                                                            (c.autoReplyRules || []).map(r => (
                                                                <RuleCard key={r._id} rule={r} onDelete={() => handleDeleteRule(c.chatId, r._id)} onEdit={(formData) => handleEditRule(c.chatId, r._id, formData)} />
                                                            ))
                                                        )}
                                                    </div>

                                                    <AddRuleForm onAdd={(formData) => handleAddRule(c.chatId, formData)} />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function RuleCard({ rule, onDelete, onEdit }) {
    const [isEditing, setIsEditing] = useState(false)
    const atts = Array.isArray(rule.attachments) ? rule.attachments : []
    const hasText = rule.responseText && rule.responseText.trim()

    if (isEditing) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ borderRadius: 14, background: 'rgba(255,255,255,0.02)', padding: '20px' }}>
                <EditContactRuleForm rule={rule} onSave={(formData) => { onEdit(formData); setIsEditing(false) }} onCancel={() => setIsEditing(false)} />
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass"
            style={{ borderRadius: 14, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trigger</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
                        <Key size={14} />
                        {rule.trigger}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Response</div>
                    {hasText && (
                        <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                            <MessageSquare size={14} style={{ marginTop: 3, opacity: 0.6 }} />
                            <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: 8 }}>{rule.responseText}</div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }}>
                    <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.8, display: 'flex', padding: 4 }}>
                        <Edit2 size={15} />
                    </button>
                    <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6, display: 'flex', padding: 4 }}>
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Attachment chips */}
            {atts.length > 0 && (
                <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {atts.map((att, i) => <AttachmentChip key={i} att={att} />)}
                </div>
            )}
        </motion.div>
    )
}

function AddRuleForm({ onAdd }) {
    const [trigger, setTrigger] = useState('')
    const [responseText, setResponseText] = useState('')
    const [attachments, setAttachments] = useState([]) // Array of File objects
    const fileInputRef = useRef(null)

    function handleFileChange(e) {
        const newFiles = Array.from(e.target.files || [])
        setAttachments(prev => [...prev, ...newFiles])
        e.target.value = ''
    }

    function removeAttachment(idx) {
        setAttachments(prev => prev.filter((_, i) => i !== idx))
    }

    function submit(e) {
        e.preventDefault()
        if (!trigger.trim()) return
        if (!responseText.trim() && attachments.length === 0) {
            alert('Provide at least a reply message or an attachment')
            return
        }
        const form = new FormData()
        form.append('trigger', trigger.trim())
        if (responseText.trim()) form.append('responseText', responseText.trim())
        for (const file of attachments) {
            form.append('attachments', file)
        }
        onAdd(form)
        setTrigger('')
        setResponseText('')
        setAttachments([])
    }

    return (
        <form onSubmit={submit} style={{ background: 'var(--accent-light)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>
                <Plus size={18} />
                <span>New Rule</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Trigger Keyword</label>
                    <input value={trigger} onChange={e => setTrigger(e.target.value)} placeholder='e.g. "order status"' required style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', color: 'var(--text)', fontSize: 13 }} />
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Reply Message</label>
                    <input value={responseText} onChange={e => setResponseText(e.target.value)} placeholder='e.g. "We are processing it"' style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', color: 'var(--text)', fontSize: 13 }} />
                </div>
            </div>

            {/* Attachments */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Attachments</label>

                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        width: '100%', padding: '11px',
                        borderRadius: 10,
                        border: '2px dashed rgba(16, 185, 129, 0.3)',
                        background: 'rgba(16, 185, 129, 0.03)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        fontSize: 13, transition: 'all 0.2s',
                        marginBottom: attachments.length > 0 ? 10 : 0,
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)'
                        e.currentTarget.style.color = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
                        e.currentTarget.style.color = 'var(--text-muted)'
                    }}
                >
                    <Paperclip size={15} />
                    <span>{attachments.length > 0 ? 'Add more files' : 'Click to attach files'}</span>
                </button>

                <AnimatePresence>
                    {attachments.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}
                        >
                            {attachments.map((file, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 12px', borderRadius: 9,
                                        background: 'rgba(16, 185, 129, 0.07)',
                                        border: '1px solid rgba(16, 185, 129, 0.15)',
                                    }}
                                >
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 7,
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--accent)', flexShrink: 0
                                    }}>
                                        <AttachmentIcon mimetype={file.type} size={14} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                            {file.type || 'Unknown'} · {formatSize(file.size)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '3px 7px', borderRadius: 5, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                    >
                                        <X size={13} />
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <button type="submit" style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#052e16', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}>
                Save Contact Rule
            </button>
        </form>
    )
}

function EditContactRuleForm({ rule, onSave, onCancel }) {
    const [trigger, setTrigger] = useState(rule.trigger || '')
    const [responseText, setResponseText] = useState(rule.responseText || '')
    const [keptAttachments, setKeptAttachments] = useState(Array.isArray(rule.attachments) ? rule.attachments : [])
    const [newAttachments, setNewAttachments] = useState([])
    const fileInputRef = useRef(null)

    function handleFileChange(e) {
        const files = Array.from(e.target.files || [])
        setNewAttachments(prev => [...prev, ...files])
        e.target.value = ''
    }

    function removeKept(filePath) {
        setKeptAttachments(prev => prev.filter(a => a.filePath !== filePath))
    }

    function removeNew(idx) {
        setNewAttachments(prev => prev.filter((_, i) => i !== idx))
    }

    function submit(e) {
        e.preventDefault()
        if (!trigger.trim()) return
        if (!responseText.trim() && keptAttachments.length === 0 && newAttachments.length === 0) {
            alert('Provide at least a reply message or an attachment')
            return
        }

        const form = new FormData()
        form.append('trigger', trigger.trim())
        if (responseText.trim()) form.append('responseText', responseText.trim())
        form.append('keptAttachments', JSON.stringify(keptAttachments.map(a => a.filePath)))

        for (const file of newAttachments) {
            form.append('attachments', file)
        }

        onSave(form)
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Edit Contact Rule</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Trigger Keyword</label>
                    <input value={trigger} onChange={e => setTrigger(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', color: 'var(--text)', fontSize: 13 }} />
                </div>
                <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Reply Message</label>
                    <input value={responseText} onChange={e => setResponseText(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', color: 'var(--text)', fontSize: 13 }} />
                </div>
            </div>

            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Attachments</label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {keptAttachments.map((att, i) => (
                        <div key={'k' + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'var(--text)' }}>
                            <AttachmentIcon mimetype={att.mimetype} size={12} />
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.originalName}</span>
                            <button type="button" onClick={() => removeKept(att.filePath)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: 2, marginLeft: 2 }}><X size={12} /></button>
                        </div>
                    ))}
                    {newAttachments.map((f, i) => (
                        <div key={'n' + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: 11, color: 'var(--accent)' }}>
                            <AttachmentIcon mimetype={f.type} size={12} />
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <button type="button" onClick={() => removeNew(i)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: 2, marginLeft: 2 }}><X size={12} /></button>
                        </div>
                    ))}
                </div>

                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed rgba(16, 185, 129, 0.3)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Paperclip size={13} /> Add Files
                </button>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#052e16', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Save Changes</button>
            </div>
        </form>
    )
}
