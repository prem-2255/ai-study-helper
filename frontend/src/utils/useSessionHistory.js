import { useState, useEffect, useCallback } from 'react'

// ── localStorage helpers ──────────────────────────────────────────────
const STORAGE_KEY_PREFIX = 'studyai_history_'

function getStorageKey(moduleKey, userId) {
  return `${STORAGE_KEY_PREFIX}${moduleKey}_${userId || 'anon'}`
}

function loadSessions(moduleKey, userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(moduleKey, userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(moduleKey, userId, sessions) {
  try {
    localStorage.setItem(getStorageKey(moduleKey, userId), JSON.stringify(sessions))
  } catch {
    // localStorage full — silently fail
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateTitle(data, titleExtractor) {
  if (titleExtractor) {
    const title = titleExtractor(data)
    if (title) {
      return title.length > 45 ? title.slice(0, 45) + '…' : title
    }
  }
  return 'Untitled Session'
}

/**
 * Relative time formatting.
 */
export function formatRelativeTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Custom hook for managing session history with localStorage persistence.
 *
 * @param {string} moduleKey - Unique key per module (e.g. 'assistant', 'simulation')
 * @param {string|number} userId - Current user's ID or email
 * @param {*} defaultData - Default data for a fresh session
 * @param {function} titleExtractor - (data) => string — derives a display title from session data
 *
 * Returns:
 *   sessions       - Array of all saved sessions, sorted newest first
 *   activeSessionId - ID of the currently active session
 *   activeData     - The data of the active session
 *   createSession  - () => id — create a new empty session
 *   selectSession  - (session) => void — switch to an existing session
 *   deleteSession  - (sessionId) => void — remove a session
 *   saveSession    - (data, sessionId?) => void — persist current session data
 *   sessionCount   - Number of saved sessions
 */
export function useSessionHistory(moduleKey, userId, defaultData, titleExtractor) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [activeData, setActiveData] = useState(defaultData)

  // Load on mount / user change
  useEffect(() => {
    const loaded = loadSessions(moduleKey, userId)
    setSessions(loaded)

    if (loaded.length > 0) {
      const latest = loaded[0]
      setActiveSessionId(latest.id)
      setActiveData(latest.data)
    } else {
      setActiveSessionId(null)
      setActiveData(defaultData)
    }
  }, [moduleKey, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const persistSessions = useCallback((updated) => {
    setSessions(updated)
    saveSessions(moduleKey, userId, updated)
  }, [moduleKey, userId])

  const saveSession = useCallback((data, sessionId) => {
    const id = sessionId || activeSessionId || generateId()
    if (!activeSessionId) setActiveSessionId(id)
    setActiveData(data)

    setSessions(prev => {
      let updated
      const existing = prev.find(s => s.id === id)
      if (existing) {
        updated = prev.map(s =>
          s.id === id
            ? { ...s, data, title: generateTitle(data, titleExtractor), updatedAt: Date.now() }
            : s
        )
      } else {
        const newSession = {
          id,
          title: generateTitle(data, titleExtractor),
          data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        updated = [newSession, ...prev]
      }
      updated.sort((a, b) => b.updatedAt - a.updatedAt)
      saveSessions(moduleKey, userId, updated)
      return updated
    })

    return id
  }, [moduleKey, userId, activeSessionId, titleExtractor])

  const createSession = useCallback(() => {
    const newId = generateId()
    setActiveSessionId(newId)
    setActiveData(defaultData)
    return newId
  }, [defaultData])

  const selectSession = useCallback((session) => {
    setActiveSessionId(session.id)
    setActiveData(session.data)
  }, [])

  const deleteSession = useCallback((sessionId) => {
    const updated = sessions.filter(s => s.id !== sessionId)
    persistSessions(updated)

    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id)
        setActiveData(updated[0].data)
      } else {
        const newId = generateId()
        setActiveSessionId(newId)
        setActiveData(defaultData)
      }
    }
  }, [sessions, activeSessionId, defaultData, persistSessions])

  return {
    sessions,
    activeSessionId,
    activeData,
    createSession,
    selectSession,
    deleteSession,
    saveSession,
    sessionCount: sessions.length
  }
}
