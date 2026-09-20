// Real per-user progress tracker for StudyAI
// Dynamically calculates levels, XP, streaks, and quest completion per account.

export const TOTAL_CORE_QUESTS = 5 // Simulation, Builder, Assistant, YouTube, StudyTools

export const getStorageKey = (user) => {
  const identifier = user?.id || user?.email || 'guest'
  return `studyai_user_progress_${identifier}`
}

export const getInitialProgress = () => ({
  xp: 0,
  streak: 1,
  completedModules: [],
  recentActivities: [],
  lastActive: new Date().toISOString()
})

export const getUserProgress = (user) => {
  if (!user) return getInitialProgress()
  try {
    const raw = localStorage.getItem(getStorageKey(user))
    if (!raw) return getInitialProgress()
    const parsed = JSON.parse(raw)
    return {
      xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 1,
      completedModules: Array.isArray(parsed.completedModules) ? parsed.completedModules : [],
      recentActivities: Array.isArray(parsed.recentActivities) ? parsed.recentActivities : [],
      lastActive: parsed.lastActive || new Date().toISOString()
    }
  } catch {
    return getInitialProgress()
  }
}

export const recordActivity = (user, { moduleKey, title, xpEarned }) => {
  if (!user) return null
  const current = getUserProgress(user)
  const newXp = current.xp + (xpEarned || 0)
  const completedModules = current.completedModules.includes(moduleKey)
    ? current.completedModules
    : [...current.completedModules, moduleKey]

  const newActivity = {
    id: Date.now(),
    title,
    moduleKey,
    xpEarned,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const updated = {
    ...current,
    xp: newXp,
    completedModules,
    recentActivities: [newActivity, ...(current.recentActivities || [])].slice(0, 10),
    lastActive: new Date().toISOString()
  }

  try {
    localStorage.setItem(getStorageKey(user), JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to persist user progress:', err)
  }

  return updated
}

export const resetUserProgress = (user) => {
  if (!user) return getInitialProgress()
  const fresh = getInitialProgress()
  try {
    localStorage.setItem(getStorageKey(user), JSON.stringify(fresh))
  } catch (err) {
    console.warn('Failed to reset user progress:', err)
  }
  return fresh
}

export const calculateLevelInfo = (xp) => {
  const XP_PER_LEVEL = 500
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInCurrentLevel = xp % XP_PER_LEVEL
  const xpNeededForNext = XP_PER_LEVEL - xpInCurrentLevel
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100))

  const TITLES = [
    'Level 1 · Novice Cadet',
    'Level 2 · Apprentice Coder',
    'Level 3 · Systems Explorer',
    'Level 4 · Data Wizard',
    'Level 5 · Master Architect',
    'Level 6 · Quantum Scholar'
  ]
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)]

  return {
    level,
    title,
    xpInCurrentLevel,
    xpPerLevel: XP_PER_LEVEL,
    xpNeededForNext,
    progressPercent
  }
}
