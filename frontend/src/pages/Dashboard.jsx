import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  getUserProgress, 
  calculateLevelInfo, 
  resetUserProgress, 
  TOTAL_CORE_QUESTS 
} from '../utils/userProgress'
import { 
  Gamepad2, 
  Blocks, 
  Bot, 
  FileText, 
  HelpCircle, 
  Sparkles, 
  Calendar,
  Compass,
  Trophy,
  Zap,
  Activity,
  Shield,
  Sliders,
  Terminal,
  Youtube,
  RotateCcw,
  CheckCircle2
} from 'lucide-react'

const Dashboard = () => {
  const { user } = useAuth()
  const [progress, setProgress] = useState(() => getUserProgress(user))

  useEffect(() => {
    setProgress(getUserProgress(user))
  }, [user])

  const levelInfo = calculateLevelInfo(progress.xp)
  const completedCount = progress.completedModules.length
  const questPercent = Math.min(100, Math.round((completedCount / TOTAL_CORE_QUESTS) * 100))
  const isFreshAccount = progress.xp === 0 && completedCount === 0

  const handleReset = () => {
    if (window.confirm('Reset all progress back to a fresh 0 XP state?')) {
      const fresh = resetUserProgress(user)
      setProgress(fresh)
    }
  }

  const modules = [
    {
      key: 'simulation',
      title: 'Simulation Mode',
      description: 'Step into real-world engineering scenarios. Your choices affect live metrics like CPU and Health.',
      icon: Gamepad2,
      path: '/simulation',
      color: 'border-purple-500/30 text-purple-400 hover:shadow-purple-500/10 hover:border-purple-500',
      badge: 'Decision Engine',
      neonColor: 'var(--neon-purple)'
    },
    {
      key: 'builder',
      title: 'Logic Builder',
      description: 'Build algorithmic steps and logic chains. Run tests on your logic and receive Socratic tutor support.',
      icon: Blocks,
      path: '/builder',
      color: 'border-emerald-500/30 text-emerald-400 hover:shadow-emerald-500/10 hover:border-emerald-500',
      badge: 'Visual Code',
      neonColor: 'var(--neon-emerald)'
    },
    {
      key: 'assistant',
      title: 'AI Assistant',
      description: 'Chat with our Socratic AI tutor. Ask questions, discover analogies, and learn without direct spoilers.',
      icon: Bot,
      path: '/assistant',
      color: 'border-amber-500/30 text-amber-400 hover:shadow-amber-500/10 hover:border-amber-500',
      badge: 'Socratic GPT',
      neonColor: 'var(--neon-amber)'
    },
    {
      key: 'youtube',
      title: 'YouTube Analyzer',
      description: 'Paste any YouTube link — AI summarizes the video, explains the topic, and tells you if it\'s actually useful for studying.',
      icon: Youtube,
      path: '/youtube-analyzer',
      color: 'border-red-500/30 text-red-400 hover:shadow-red-500/10 hover:border-red-500',
      badge: 'Video Intel',
      neonColor: '#ff2d6f'
    }
  ]

  const studyTools = [
    {
      title: 'Notes Summarizer',
      desc: 'Summarize long notes or uploaded PDF syllabi.',
      icon: FileText,
      badge: 'Tactical Summaries',
      glow: 'glow-teal'
    },
    {
      title: 'Quiz Generator',
      desc: 'Generate multiple choice questions to test knowledge.',
      icon: HelpCircle,
      badge: 'Mock Battles',
      glow: 'glow-purple'
    },
    {
      title: 'Concept Explainer',
      desc: 'Simplifies dense academic definitions via analogies.',
      icon: Sparkles,
      badge: 'Analogy Reactor',
      glow: 'glow-amber'
    },
    {
      title: 'Revision Planner',
      desc: 'Create daily study calendar allocations for exams.',
      icon: Calendar,
      badge: 'Campaign Planner',
      glow: 'glow-emerald'
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ═══ SYSTEM HUB / GAMER PROFILE ═══ */}
      <div className="hud-panel hud-accent-multi hud-grid-bg p-6 md:p-8"
        style={{ boxShadow: '0 0 50px rgba(0, 245, 212, 0.05)' }}>
        
        {/* Decorative Grid Lines and scanline overlay is inherited from hud-panel */}
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'linear-gradient(90deg, var(--neon-teal), var(--neon-purple), var(--neon-magenta))' }} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider status-pulse"
                style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', color: 'var(--neon-teal)' }}>
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                SYSTEM ONLINE · {isFreshAccount ? 'FRESH ACCOUNT' : 'ACTIVE SESSION'}
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', color: 'var(--neon-amber)' }}>
                <Zap className="h-3.5 w-3.5" />
                {isFreshAccount ? 'DAY 1 · READY TO START' : `STREAK DAY ${progress.streak}`}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white leading-none">
              COMMAND DECK: <span className="bg-gradient-to-r from-white via-indigo-200 to-cyan-300 bg-clip-text text-transparent">{user?.name || user?.email.split('@')[0]}</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              {isFreshAccount 
                ? 'Welcome to your interactive learning hub. Your account is fresh and ready — select any simulation pipeline or study tool below to start earning XP.'
                : 'Welcome back to the central core. Continue your training modules, run interactive simulations, or process study files below.'}
            </p>
          </div>

          {/* Real User Stat Panel */}
          <div className="flex flex-col sm:flex-row gap-4 lg:min-w-[400px]">
            {/* Level & XP Widget */}
            <div className="flex-1 p-4 rounded-xl border border-white/5 bg-slate-950/60 backdrop-blur-md relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" style={{ color: 'var(--neon-amber)' }} />
                  <span className="hud-label text-xs uppercase" style={{ color: 'var(--neon-amber)' }}>{levelInfo.title}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">XP {progress.xp}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-slate-900 border border-white/5">
                <div className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.max(4, levelInfo.progressPercent)}%`, background: 'linear-gradient(90deg, var(--neon-teal), var(--neon-purple))', boxShadow: '0 0 10px rgba(0, 245, 212, 0.5)' }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">
                {isFreshAccount 
                  ? '▸ Complete your 1st activity below to earn XP'
                  : `▸ ${levelInfo.xpNeededForNext} XP to Level ${levelInfo.level + 1}`}
              </p>
            </div>

            {/* Real Campaign Quest Widget */}
            <div className="p-4 rounded-xl border border-white/5 bg-slate-950/60 backdrop-blur-md min-w-[130px] text-center flex flex-col justify-center relative">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Shield className="h-4 w-4" style={{ color: 'var(--neon-purple)' }} />
                <span className="hud-label text-[10px] text-slate-500">Active Quests</span>
              </div>
              <p className="text-2xl font-black text-white font-mono" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.1)' }}>
                {completedCount}/{TOTAL_CORE_QUESTS}
              </p>
              <p className={`text-[9px] uppercase tracking-widest font-bold mt-1 ${isFreshAccount ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {isFreshAccount ? 'READY TO START' : `${questPercent}% COMPLETED`}
              </p>
            </div>
          </div>
        </div>

        {/* Reset progress button for clean testing */}
        {!isFreshAccount && (
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
            <button 
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              title="Reset progress to zero"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Stats to Fresh
            </button>
          </div>
        )}
      </div>

      {/* ═══ MISSION OBJECTIVES (Simulation Modules) ═══ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-tight text-white hud-label">Mission Objectives</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod, idx) => {
            const IconComponent = mod.icon
            return (
              <Link
                key={idx}
                to={mod.path}
                className={`group relative flex flex-col justify-between p-6 hud-panel border transition-all duration-300 hover:scale-[1.02] ${mod.color}`}
                style={{ background: 'var(--hud-bg)' }}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 transition-transform duration-300"
                      style={{ color: mod.neonColor, textShadow: `0 0 10px ${mod.neonColor}` }}>
                      <IconComponent className="h-7 w-7" />
                    </div>
                    <div className="flex items-center gap-2">
                      {progress.completedModules.includes(mod.key) && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" /> DONE
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 group-hover:text-white transition-colors">
                        {mod.badge}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:translate-x-0.5 transition-transform duration-300">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    {mod.description}
                  </p>
                </div>
                <div className="text-xs font-bold text-white inline-flex items-center gap-1.5 transition-all font-mono tracking-wide"
                  style={{ color: mod.neonColor }}>
                  LAUNCH TARGET CORE &rarr;
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ═══ TACTICAL INVENTORY (Study Helper Tools) ═══ */}
      <div className="space-y-4 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-tight text-white hud-label">Tactical Study Inventory</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {studyTools.map((tool, idx) => {
            const Icon = tool.icon
            return (
              <Link 
                key={idx}
                to="/study-tools" 
                className="p-5 hud-panel border border-white/5 rounded-2xl space-y-3 hover:border-indigo-500/30 transition-all group relative block"
                style={{ background: 'var(--hud-glass)' }}
              >
                <div className="p-2 w-fit bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 bg-white/5 border border-white/5 rounded text-slate-400 block w-fit mb-1.5">
                    {tool.badge}
                  </span>
                  <h4 className="font-bold text-white text-sm">{tool.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{tool.desc}</p>
                </div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 font-mono text-[9px]">
                  DEPLOY &gt;
                </div>
              </Link>
            )
          })}
        </div>

      </div>
    </div>
  )
}

export default Dashboard
