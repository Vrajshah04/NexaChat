import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const WAContext = createContext(null)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function WAProvider({ children }) {
    const { token } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const [qrDataUrl, setQrDataUrl] = useState('')
    const [showQrModal, setShowQrModal] = useState(false)
    const [messages, setMessages] = useState([])

    // Single socket instance for the entire app lifetime — never destroyed on tab switch
    const socket = useMemo(() => {
        if (!token) return null
        return io(API_BASE, { autoConnect: true, auth: { token } })
    }, [token])

    useEffect(() => {
        if (!socket) return

        function onStatus({ isReady }) {
            setIsReady(Boolean(isReady))
            if (isReady) { setQrDataUrl(''); setShowQrModal(false) }
        }
        function onQr({ dataUrl }) { if (!dataUrl) return; setQrDataUrl(dataUrl); setShowQrModal(true) }
        function onAuthenticated() { setQrDataUrl(''); setShowQrModal(false) }
        function onDisconnected() { setIsReady(false) }
        function onMessage(msg) { setMessages(prev => [...prev, msg]) }
        function onHistory(list) { setMessages(Array.isArray(list) ? list : []) }

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

    return (
        <WAContext.Provider value={{ socket, isReady, qrDataUrl, showQrModal, setShowQrModal, messages }}>
            {children}
        </WAContext.Provider>
    )
}

export function useWA() {
    const ctx = useContext(WAContext)
    if (!ctx) throw new Error('useWA must be inside WAProvider')
    return ctx
}
