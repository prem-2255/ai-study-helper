import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)
const API_BASE = 'http://localhost:8000'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        // Set authorization header globally or per-request
        const resp = await axios.get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setUser(resp.data)
      } catch (err) {
        console.error('Failed to verify token', err)
        // Clear invalid token
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [token])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const resp = await axios.post(`${API_BASE}/auth/login`, { email, password })
      const { access_token, user: userData } = resp.data
      localStorage.setItem('token', access_token)
      setToken(access_token)
      setUser(userData)
      return { success: true }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Invalid email or password'
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name, email, password) => {
    setLoading(true)
    try {
      const resp = await axios.post(`${API_BASE}/auth/signup`, { name, email, password })
      const { access_token, user: userData } = resp.data
      localStorage.setItem('token', access_token)
      setToken(access_token)
      setUser(userData)
      return { success: true }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Registration failed'
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = async (idToken) => {
    setLoading(true)
    try {
      const resp = await axios.post(`${API_BASE}/auth/google`, { id_token: idToken })
      const { access_token, user: userData } = resp.data
      localStorage.setItem('token', access_token)
      setToken(access_token)
      setUser(userData)
      return { success: true }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Google sign-in failed'
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const forgotPassword = async (email) => {
    try {
      const resp = await axios.post(`${API_BASE}/auth/forgot-password`, { email })
      return {
        success: true,
        message: resp.data.message,
        resetCode: resp.data.reset_code
      }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Failed to request password reset code'
      return { success: false, error: errorMsg }
    }
  }

  const resetPassword = async (token, newPassword) => {
    try {
      const resp = await axios.post(`${API_BASE}/auth/reset-password`, { token, new_password: newPassword })
      return { success: true, message: resp.data.message }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail || 'Failed to reset password'
      return { success: false, error: errorMsg }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, googleLogin, signup, forgotPassword, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
