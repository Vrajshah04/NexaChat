import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('wa_token') || null)
    const [username, setUsername] = useState(() => localStorage.getItem('wa_username') || null)

    const login = useCallback((newToken, newUsername) => {
        localStorage.setItem('wa_token', newToken)
        localStorage.setItem('wa_username', newUsername)
        setToken(newToken)
        setUsername(newUsername)
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('wa_token')
        localStorage.removeItem('wa_username')
        localStorage.removeItem('contacts')
        setToken(null)
        setUsername(null)
    }, [])

    return (
        <AuthContext.Provider value={{ token, username, login, logout, isAuthenticated: Boolean(token) }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
