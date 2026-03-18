import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    Zap,
    Trash2,
    Key,
    MessageSquare,
    Image as ImageIcon,
    Plus,
    Power,
    Loader2,
    Paperclip,
    X,
    FileText,
    Film,
    File,
    Hash,
    Edit2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
            maxWidth: 200,
        }}>
            <AttachmentIcon mimetype={att.mimetype} size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.originalName || 'Attachment'}
            </span>
        </div>
    )
}

export function Automation() {
    const { token } = useAuth()
    const [rules, setRules] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const [trigger, setTrigger] = useState('')
    const [responseText, setResponseText] = useState('')
    const [attachments, setAttachments] = useState([])
    const fileInputRef = useRef(null)

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

    function handleFileChange(e) {
        const newFiles = Array.from(e.target.files || [])
        setAttachments(prev => [...prev, ...newFiles])
        e.target.value = ''
    }

    function removeAttachment(idx) {
        setAttachments(prev => prev.filter((_, i) => i !== idx))
    }

    async function handleAdd(e) {
        e.preventDefault()
        if (!trigger.trim()) return
        if (!responseText.trim() && attachments.length === 0) {
            alert('Provide at least a reply message or an attachment')
            return
        }
        const form = new FormData()
        form.append('trigger', trigger.trim())
        if (responseText.trim()) form.append('responseText', responseText.trim())
        for (const file of attachments) form.append('attachments', file)
        try {
            const res = await authFetch('/api/global-rules', { method: 'POST', body: form })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setRules(prev => [data.rule, ...prev])
            setTrigger('')
            setResponseText('')
            setAttachments([])
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

    async function handleEdit(id, formData) {
        try {
            const res = await authFetch(`/api/global-rules/${id}`, { method: 'PUT', body: formData })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            setRules(prev => prev.map(r => r._id === id ? data.rule : r))
        } catch { alert('Network error') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
            {/* Page header */}
            <div style={{ marginBottom: 28, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent)', marginBottom: 6 }}>
                    <Zap size={20} fill="currentColor" />
                    <span style={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 12 }}>Automation Engine</span>
                </div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: 30 }}>Global Rules</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                    Apply to <strong style={{ color: 'var(--text)' }}>all incoming messages</strong>. Contact-specific rules take priority.
                </p>
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

                {/* LEFT — Add rule form (sticky) */}
                <div style={{ width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column', paddingTop: 38, overflow: 'hidden' }}>
                    <motion.form
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onSubmit={handleAdd}
                        className="glass"
                        style={{
                            padding: 24,
                            borderRadius: 'var(--radius-xl)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            background: 'var(--accent-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 18,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#052e16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Plus size={18} />
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>Add Global Rule</span>
                        </div>

                        {/* Trigger */}
                        <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Trigger Keyword</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '0 12px', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
                                <Key size={15} color="var(--accent)" />
                                <input value={trigger} onChange={e => setTrigger(e.target.value)} placeholder='e.g. "pricing"' required
                                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '11px 10px', color: 'var(--text)', fontSize: 14 }} />
                            </div>
                        </div>

                        {/* Reply message */}
                        <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Reply Message</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '0 12px', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
                                <MessageSquare size={15} color="var(--accent)" />
                                <input value={responseText} onChange={e => setResponseText(e.target.value)} placeholder='e.g. "Our plans start at..."'
                                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '11px 10px', color: 'var(--text)', fontSize: 14 }} />
                            </div>
                        </div>

                        {/* Attachments */}
                        <div>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Attachments</label>
                            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '100%', padding: '11px',
                                    borderRadius: 11, border: '2px dashed rgba(16, 185, 129, 0.3)',
                                    background: 'rgba(16, 185, 129, 0.03)', color: 'var(--text-muted)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    fontSize: 13, transition: 'all 0.2s',
                                    marginBottom: attachments.length > 0 ? 10 : 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.6)'; e.currentTarget.style.color = 'var(--accent)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                            >
                                <Paperclip size={15} />
                                <span>{attachments.length > 0 ? 'Add more files' : 'Click to attach files'}</span>
                            </button>
                            <AnimatePresence>
                                {attachments.length > 0 && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                                        {attachments.map((file, idx) => (
                                            <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                                                    <AttachmentIcon mimetype={file.type} size={13} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatSize(file.size)}</div>
                                                </div>
                                                <button type="button" onClick={() => removeAttachment(idx)}
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '3px 6px', borderRadius: 5, display: 'flex', alignItems: 'center' }}>
                                                    <X size={12} />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button type="submit"
                            style={{ padding: '13px', background: 'var(--accent)', color: '#052e16', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 16px rgba(16,185,129,0.25)' }}>
                            Activate Global Rule
                        </button>
                    </motion.form>
                </div>

                {/* RIGHT — Rules list */}
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Rules</span>
                        <span style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>{rules.length} total</span>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                            <Loader2 className="animate-spin" size={28} color="var(--accent)" />
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="glass" style={{ textAlign: 'center', padding: 48, borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                            <Zap size={36} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: 14 }}>No rules yet. Add one to start automating.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <AnimatePresence>
                                {rules.map((r, idx) => (
                                    <GlobalRuleCard key={r._id} rule={r} idx={idx}
                                        onToggle={() => handleToggle(r._id, r.enabled)}
                                        onDelete={() => handleDelete(r._id)}
                                        onEdit={(formData) => handleEdit(r._id, formData)} />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function GlobalRuleCard({ rule, idx, onToggle, onDelete, onEdit }) {
    const [isEditing, setIsEditing] = useState(false)
    const atts = Array.isArray(rule.attachments) ? rule.attachments : []

    if (isEditing) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 12 }}>
                <EditGlobalRuleForm rule={rule} onSave={(formData) => { onEdit(formData); setIsEditing(false) }} onCancel={() => setIsEditing(false)} />
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ delay: idx * 0.04 }}
            className="glass"
            style={{
                borderRadius: 'var(--radius-lg)',
                opacity: rule.enabled ? 1 : 0.55,
                border: rule.enabled ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 0.3s ease',
                overflow: 'hidden',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                {/* Trigger */}
                <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                    background: rule.enabled ? 'var(--accent-light)' : 'rgba(255,255,255,0.04)',
                    padding: '6px 14px', borderRadius: 99,
                    color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 13,
                    border: `1px solid ${rule.enabled ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                }}>
                    <Hash size={12} />
                    {rule.trigger}
                    {!rule.enabled && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', marginLeft: 4 }}>off</span>}
                </div>

                {/* Response */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {rule.responseText && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <MessageSquare size={12} style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.responseText}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={onToggle} className="nav-item glass"
                        style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 12,
                            background: rule.enabled ? 'var(--accent-light)' : 'rgba(255,255,255,0.02)',
                            color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                        <Power size={13} />
                        <span>{rule.enabled ? 'On' : 'Off'}</span>
                    </button>
                    <button onClick={() => setIsEditing(true)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.8 }}>
                        <Edit2 size={14} />
                    </button>
                    <button onClick={onDelete}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', opacity: 0.6 }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Attachment chips */}
            {atts.length > 0 && (
                <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid var(--border)' }}>
                    <div style={{ width: '100%', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 10, marginBottom: 4 }}>Attachments</div>
                    {atts.map((att, i) => <AttachmentChip key={i} att={att} />)}
                </div>
            )}
        </motion.div>
    )
}

function EditGlobalRuleForm({ rule, onSave, onCancel }) {
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
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Edit Global Rule</div>
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
