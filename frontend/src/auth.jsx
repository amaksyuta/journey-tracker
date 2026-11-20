import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return
    try {
      setUser(await api.get('/auth/me'))
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    refresh().finally(() => setLoading(false))
  }, [refresh, logout])

  const finish = (res) => {
    tokenStore.set(res.access_token)
    setUser(res.user)
  }
  const login = async (username, password) => finish(await api.post('/auth/login', { username, password }))
  const loginAsGuest = async () => finish(await api.post('/auth/guest'))

  const role = user?.role
  const value = {
    user, loading, login, loginAsGuest, logout, refresh,
    isAdmin: role === 'admin',
    isLearner: role === 'user',
    isGuest: role === 'guest',
    canResolveAppeals: role === 'admin' || (role === 'user' && user?.is_council),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
