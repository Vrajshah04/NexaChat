import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function App() {
  const [isReady, setIsReady] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [messages, setMessages] = useState([])
  const [activePage, setActivePage] = useState('whatsapp')
  const [contacts, setContacts] = useState([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const nameRef = useRef(null)
  const contactNumberRef = useRef(null)
  const customMsgRef = useRef(null)
  const attachmentRef = useRef(null)
  const numberRef = useRef(null)
  const textRef = useRef(null)
  const sendAttachmentRef = useRef(null)
  const captionRef = useRef(null)

  // Ensure Socket.IO connects to the Express backend (port 3000) even when running a separate frontend dev server
  const API_BASE = 'http://localhost:3000'
  const socket = useMemo(() => io(API_BASE, { autoConnect: true }), [])

  useEffect(() => {
    function onStatus({ isReady }) {
      setIsReady(Boolean(isReady))
      if (isReady) {
        setQrDataUrl('')
        setShowQrModal(false)
      }
    }
    function onQr({ dataUrl }) {
      if (!dataUrl) return
      setQrDataUrl(dataUrl)
      setShowQrModal(true)
    }
    function onAuthenticated() {
      setQrDataUrl('')
      setShowQrModal(false)
    }
    function onDisconnected() {
      setIsReady(false)
    }
    function onMessage(msg) {
      setMessages(prev => [...prev, msg])
    }
    function onHistory(list) {
      setMessages(Array.isArray(list) ? list : [])
    }

    socket.on('wa:status', onStatus)
    socket.on('wa:qr', onQr)
    socket.on('wa:authenticated', onAuthenticated)
    socket.on('wa:disconnected', onDisconnected)
    socket.on('wa:message', onMessage)
    socket.on('wa:history', onHistory)

    return () => {
      socket.off('wa:status', onStatus)
      socket.off('wa:qr', onQr)
      socket.off('wa:authenticated', onAuthenticated)
      socket.off('wa:disconnected', onDisconnected)
      socket.off('wa:message', onMessage)
      socket.off('wa:history', onHistory)
      socket.close()
    }
  }, [socket])

  // Contacts: load from localStorage first, then try backend for current session
  useEffect(() => {
    const stored = localStorage.getItem('contacts')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setContacts(parsed)
      } catch (_) {}
    }
    let cancelled = false
    async function loadFromServer() {
      setIsLoadingContacts(true)
      try {
        const res = await fetch(`${API_BASE}/api/contacts`)
        const data = await res.json()
        if (!cancelled && data?.ok && Array.isArray(data.contacts)) {
          setContacts(data.contacts)
          localStorage.setItem('contacts', JSON.stringify(data.contacts))
        }
      } catch (_) {
        // ignore, rely on localStorage
      } finally {
        if (!cancelled) setIsLoadingContacts(false)
      }
    }
    loadFromServer()
    return () => { cancelled = true }
  }, [])

  function persistContacts(next) {
    setContacts(next)
    localStorage.setItem('contacts', JSON.stringify(next))
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
        // Caption comes from the 2nd input (textRef)
        const captionVal = textRef.current?.value?.trim() || ''
        // Standalone message comes from the 4th input (captionRef)
        const standaloneMsg = captionRef.current?.value?.trim() || ''
        if (captionVal) form.append('caption', captionVal)
        if (standaloneMsg) form.append('message', standaloneMsg)
        form.append('attachment', sendAttachmentRef.current.files[0])
        res = await fetch(`${API_BASE}/api/send`, { method: 'POST', body: form })
      } else {
        // No attachment: only send the standalone message from the 4th input
        const standaloneMsg = captionRef.current?.value?.trim() || ''
        if (!standaloneMsg) return
        res = await fetch(`${API_BASE}/api/send`, {
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
    } catch (err) {
      alert('Network error')
    }
  }

  async function handleAddContact(e) {
    e.preventDefault()
    const name = nameRef.current?.value.trim()
    const number = contactNumberRef.current?.value.trim()
    const customMessage = customMsgRef.current?.value.trim()
    if (!name || !number) return
    try {
      const form = new FormData()
      form.append('name', name)
      form.append('number', number)
      if (customMessage) form.append('customMessage', customMessage)
      if (attachmentRef.current?.files?.[0]) form.append('attachment', attachmentRef.current.files[0])
      const res = await fetch(`${API_BASE}/api/contacts`, { method: 'POST', body: form })
      const data = await res.json()
      if (!data?.ok) {
        alert(data?.error || 'Failed to save contact')
        return
      }
      const next = [...contacts.filter(c => c.chatId !== data.contact.chatId), data.contact]
      persistContacts(next)
      if (nameRef.current) nameRef.current.value = ''
      if (contactNumberRef.current) contactNumberRef.current.value = ''
      if (customMsgRef.current) customMsgRef.current.value = ''
      if (attachmentRef.current) attachmentRef.current.value = ''
    } catch (_) {
      alert('Network error')
    }
  }

  async function handleLogout() {
    try {
      // Disconnect to logout and wipe session cache on the server
      await fetch(`${API_BASE}/api/disconnect`, { method: 'POST' })
    } catch (_) {}
    try {
      // Immediately re-init to surface a fresh QR for the next login
      await fetch(`${API_BASE}/api/connect`, { method: 'POST' })
    } catch (_) {}
  }

  function handleCloseQrModal() {
    setShowQrModal(false)
  }

  async function handleDeleteContact(chatIdOrNumber) {
    const id = String(chatIdOrNumber || '')
    const num = id.endsWith('@c.us') ? id.replace('@c.us', '') : id
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(num)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data?.ok) {
        alert(data?.error || 'Failed to remove contact')
        return
      }
      const next = contacts.filter(c => c.chatId !== (num + '@c.us'))
      persistContacts(next)
    } catch (_) {
      alert('Network error')
    }
  }

  return (
    <div className="app">
      <div className="layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">Menu</h2>
          <nav className="nav">
            <button
              className={`nav-item ${activePage === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setActivePage('whatsapp')}
            >
              WhatsApp
            </button>
            <button
              className={`nav-item ${activePage === 'contact' ? 'active' : ''}`}
              onClick={() => setActivePage('contact')}
            >
              Contact
            </button>
          </nav>
        </aside>

        <main className="main-area">
          <header className="app-header">
            <h1>Messaging Console</h1>
          </header>

          {activePage === 'whatsapp' ? (
            <section className="tab-content" id="tab-whatsapp">
              <section className="status-row">
                <div id="status-indicator" className={`status ${isReady ? 'status-connected' : 'status-disconnected'}`}>
                  {isReady ? 'Connected' : 'Disconnected'}
                </div>
                <button onClick={handleLogout} className="tab" style={{ marginLeft: 8 }}>
                  {isReady ? 'Logout' : 'Show QR'}
                </button>
              </section>

              <section className="messages" id="messages">
                {messages.map((m, idx) => {
                  const fromMe = m?.fromMe
                  const body = m?.body || ''
                  const from = m?.from || ''
                  const to = m?.to || ''
                  const timestamp = m?.timestamp || Date.now()
                  const hasMedia = m?.hasMedia
                  const mediaInfo = m?.mediaInfo
                  const who = fromMe ? `me → ${to || ''}` : `${from || ''} → me`
                  
                  return (
                    <React.Fragment key={idx}>
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
                        ) : (
                          body
                        )}
                      </div>
                      <div className="meta">{`${who} • ${new Date(timestamp).toLocaleTimeString()}`}</div>
                    </React.Fragment>
                  )
                })}
              </section>

              <form id="send-form" className="send-form" onSubmit={handleSubmit} style={{ gridTemplateColumns: '220px 1fr 1fr 1fr auto' }}>
                <input id="number" ref={numberRef} type="tel" placeholder="Phone number (e.g. 919558804843)" required />
                <input id="text" ref={textRef} type="text" placeholder="Caption" />
                <input ref={sendAttachmentRef} type="file" title="Attachment (optional)" />
                <input ref={captionRef} type="text" placeholder="Separate message" />
                <button type="submit">Send</button>
              </form>
              {/* Removed the separate-send checkbox per request */}
            </section>
          ) : null}

          {activePage === 'contact' ? (
            <section className="contact-page">
              <h3 style={{ marginTop: 0 }}>Contacts</h3>
              <form onSubmit={handleAddContact} className="send-form" style={{ gridTemplateColumns: '160px 1fr 1fr 1fr auto' }}>
                <input ref={nameRef} type="text" placeholder="Name" required />
                <input ref={contactNumberRef} type="tel" placeholder="Number (e.g. 919558804843)" required />
                <input ref={customMsgRef} type="text" placeholder="Custom auto-reply (optional)" />
                <input ref={attachmentRef} type="file" title="Attachment (optional)" />
                <button type="submit">Save</button>
              </form>
              <div style={{ marginTop: 12 }}>
                {isLoadingContacts ? <div className="meta">Loading contacts…</div> : null}
                {contacts.length === 0 ? (
                  <div className="meta">No contacts yet.</div>
                ) : (
                  <div className="messages" style={{ minHeight: 0 }}>
                    {contacts.map(c => (
                      <div key={c.chatId} className="msg them" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                        <div>
                          <div><strong>{c.name}</strong> ({c.number})</div>
                          {c.customMessage ? <div className="meta">Auto-reply: {c.customMessage}</div> : <div className="meta">No custom auto-reply</div>}
                          {c.attachmentOriginalName ? <div className="meta">Attachment: {c.attachmentOriginalName}</div> : <div className="meta">No attachment</div>}
                        </div>
                        <button onClick={() => handleDeleteContact(c.chatId)} style={{ alignSelf: 'start', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {/* QR Modal */}
      {showQrModal && (
        <div className="qr-modal show" onClick={handleCloseQrModal}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Scan QR Code</h3>
            <p>Open WhatsApp on your phone and scan this QR code to link your account</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="WhatsApp QR Code" />
            ) : (
              <div style={{ width: '280px', height: '280px', background: '#f0f0f0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <p>Loading QR Code...</p>
              </div>
            )}
            <button className="qr-modal-close" onClick={handleCloseQrModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


