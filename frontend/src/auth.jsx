import { createContext, useContext, useState } from 'react'
import { api, setToken, getToken } from './api'

const AuthContext = createContext(null)

function decodeEmail(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || payload.email || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const t = getToken()
    if (!t) return null
    return { email: localStorage.getItem('checkout_email') || decodeEmail(t), role: localStorage.getItem('checkout_role') }
  })

  function persist(res) {
    setToken(res.token)
    localStorage.setItem('checkout_email', res.email)
    localStorage.setItem('checkout_role', res.role)
    setUser({ email: res.email, role: res.role })
  }

  async function login(email, password) {
    persist(await api.login(email, password))
  }
  async function register(email, password) {
    persist(await api.register(email, password))
  }
  function logout() {
    setToken(null)
    localStorage.removeItem('checkout_email')
    localStorage.removeItem('checkout_role')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
