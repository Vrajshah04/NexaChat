import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { WAProvider } from './context/WAContext'
import { PrivateRoute } from './components/PrivateRoute'
import { AppShell } from './components/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Contacts } from './pages/Contacts'
import { Automation } from './pages/Automation'
import { Analytics } from './pages/Analytics'

createRoot(document.getElementById('root')).render(
    <AuthProvider>
        <BrowserRouter>
            <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Protected — WAProvider lives here so socket persists across all tab switches */}
                <Route element={<PrivateRoute />}>
                    <Route element={<WAProvider><AppShell /></WAProvider>}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/automation" element={<Automation />} />
                        <Route path="/analytics" element={<Analytics />} />
                    </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    </AuthProvider>
)
