import React, { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { recordActivity } from '../utils/userProgress'
import { useSessionHistory } from '../utils/useSessionHistory'
import SessionSidebar, { SidebarToggle } from '../components/SessionSidebar'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Youtube,
  Search,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Lightbulb,
  ExternalLink,
  Loader2,
  ClipboardPaste,
  Video
} from 'lucide-react'

const API_URL = 'http://localhost:8000'

function getDefaultYTData() {
  return {
    url: '',
    result: null,
    error: ''
  }
}

function ytTitleExtractor(data) {
  if (data.result?.video_title) return data.result.video_title
  if (data.url) {
    // Extract video ID for a short label
    const match = data.url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? `Video: ${match[1]}` : 'YouTube Analysis'
  }
  return 'New Analysis'
}

const YouTubeAnalyzer = () => {
  const { user, token } = useAuth()
  const userId = user?.id || user?.email

  const {
    sessions,
    activeSessionId,
    activeData,
    createSession,
    selectSession,
    deleteSession,
    saveSession
  } = useSessionHistory('youtube', userId, getDefaultYTData(), ytTitleExtractor)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  // Derived state
  const url = activeData.url || ''
  const result = activeData.result || null
  const error = activeData.error || ''

  const setUrl = (newUrl) => {
    saveSession({ ...activeData, url: newUrl, error: '' })
  }

  const setError = (err) => {
    saveSession({ ...activeData, error: err })
  }

  // Extract video ID for thumbnail preview
  const getVideoId = (link) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
      /(?:youtu\.be\/)([\w-]{11})/,
      /(?:youtube\.com\/embed\/)([\w-]{11})/,
      /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    ]
    for (const pattern of patterns) {
      const match = link.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const previewVideoId = getVideoId(url)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      inputRef.current?.focus()
    }
  }

  const handleNewAnalysis = () => {
    const newId = createSession()
    saveSession(getDefaultYTData(), newId)
  }

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please paste a YouTube URL first')
      return
    }
    if (!getVideoId(url)) {
      setError('That doesn\'t look like a valid YouTube URL. Try pasting the full link.')
      return
    }

    setLoading(true)
    saveSession({ ...activeData, error: '', result: null })

    try {
      const res = await fetch(`${API_URL}/modules/youtube/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Analysis failed')
      }

      const data = await res.json()
      saveSession({ ...activeData, result: data, error: '' })

      recordActivity(user, {
        moduleKey: 'youtube',
        title: `Analyzed: ${data.video_title || 'Video'}`,
        xpEarned: 100
      })
    } catch (err) {
      saveSession({ ...activeData, error: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const getVerdictConfig = (verdict) => {
    switch (verdict) {
      case 'highly_useful':
        return {
          icon: CheckCircle2,
          label: 'Highly Useful for Study',
          color: 'var(--neon-emerald)',
          bgColor: 'rgba(16, 185, 129, 0.08)',
          borderColor: 'rgba(16, 185, 129, 0.25)',
          ringColor: '#10b981',
        }
      case 'partially_useful':
        return {
          icon: AlertTriangle,
          label: 'Partially Useful',
          color: 'var(--neon-amber)',
          bgColor: 'rgba(251, 191, 36, 0.08)',
          borderColor: 'rgba(251, 191, 36, 0.25)',
          ringColor: '#fbbf24',
        }
      case 'not_useful':
      default:
        return {
          icon: XCircle,
          label: 'Not Useful for Study',
          color: 'var(--neon-magenta)',
          bgColor: 'rgba(255, 45, 111, 0.08)',
          borderColor: 'rgba(255, 45, 111, 0.25)',
          ringColor: '#ff2d6f',
        }
    }
  }

  const analysis = result?.analysis
  const verdictConfig = analysis ? getVerdictConfig(analysis.usefulness_verdict) : null

  const ytSubtitle = (session) => {
    if (session.data?.result) return '✅ Analyzed'
    return ''
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        <Link
          to="/dashboard"
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded bg-red-500/10 border border-red-500/25 text-red-400 font-mono">
              Video Intel
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-none" style={{ background: 'linear-gradient(90deg, #fff, #ff6b6b, #ff2d6f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            YouTube Study Analyzer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Paste a YouTube link → AI analyzes if the video is useful for your studies
          </p>
        </div>
        <SidebarToggle sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Session History Sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewAnalysis}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
          moduleLabel="Analysis"
          countExtractor={ytSubtitle}
          icon={Video}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto space-y-8 min-w-0">
          {/* URL Input Section */}
          <div className="hud-panel border border-white/10 p-6 relative overflow-hidden" style={{ background: 'var(--hud-bg)' }}>
            <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'linear-gradient(90deg, #ff2d6f, #ff6b6b, #fbbf24)' }} />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Youtube className="h-5 w-5 text-red-400" />
                <span className="text-sm font-bold text-white">Paste YouTube Video URL</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative group">
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="yt-url-input w-full px-4 py-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-slate-500 text-sm font-mono focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !url.trim()}
                  className="yt-analyze-btn flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? 'rgba(255, 45, 111, 0.15)' : 'linear-gradient(135deg, #ff2d6f, #ff6b6b)',
                    color: '#fff',
                    border: '1px solid rgba(255, 45, 111, 0.3)',
                    boxShadow: loading ? 'none' : '0 0 20px rgba(255, 45, 111, 0.2)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Analyze Video
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-4 py-2.5">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Video Preview (before analysis) */}
          {previewVideoId && !result && !loading && (
            <div className="hud-panel border border-white/10 p-4 flex flex-col sm:flex-row gap-4 items-center" style={{ background: 'var(--hud-bg)' }}>
              <img
                src={`https://img.youtube.com/vi/${previewVideoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                className="w-full sm:w-48 rounded-lg border border-white/10"
              />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Preview</p>
                <p className="text-sm text-slate-300">Video detected — click <strong className="text-red-400">Analyze Video</strong> to get the AI study breakdown</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-2 transition-colors"
                >
                  Open on YouTube <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="hud-panel border border-white/10 p-12 text-center space-y-4" style={{ background: 'var(--hud-bg)' }}>
              <div className="yt-loading-ring mx-auto" />
              <p className="text-sm text-slate-400 animate-pulse">Extracting transcript & analyzing with AI...</p>
              <p className="text-xs text-slate-600 font-mono">This may take 10-20 seconds for long videos</p>
            </div>
          )}

          {/* Results */}
          {result && analysis && (
            <div className="space-y-6 yt-results-fade-in">
              {/* Video Info + Verdict Card */}
              <div className="hud-panel border border-white/10 p-6 relative overflow-hidden" style={{ background: 'var(--hud-bg)' }}>
                <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${verdictConfig.ringColor}, transparent)` }} />

                <div className="flex flex-col md:flex-row gap-6">
                  {/* Video Thumbnail */}
                  <div className="shrink-0">
                    <div className="relative">
                      <img
                        src={result.video_thumbnail}
                        alt={result.video_title}
                        className="w-full md:w-56 rounded-xl border border-white/10"
                      />
                      <a
                        href={`https://www.youtube.com/watch?v=${result.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <Youtube className="h-10 w-10 text-red-500" />
                      </a>
                    </div>
                  </div>

                  {/* Video Info + Score */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1 leading-tight">{result.video_title}</h2>
                      <p className="text-sm text-slate-400 mb-3">{result.video_author}</p>

                      {/* Subject Tags */}
                      {analysis.subject_tags && analysis.subject_tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {analysis.subject_tags.map((tag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-300"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Usefulness Score Gauge */}
                    <div className="flex items-center gap-5">
                      <div className="yt-gauge-container" style={{ '--gauge-color': verdictConfig.ringColor }}>
                        <svg className="yt-gauge-svg" viewBox="0 0 120 120">
                          <circle
                            className="yt-gauge-bg"
                            cx="60" cy="60" r="50"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            className="yt-gauge-fill"
                            cx="60" cy="60" r="50"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            style={{
                              stroke: verdictConfig.ringColor,
                              strokeDasharray: `${(analysis.usefulness_score / 100) * 314.16} 314.16`,
                              filter: `drop-shadow(0 0 6px ${verdictConfig.ringColor})`,
                            }}
                          />
                          <text x="60" y="55" textAnchor="middle" className="yt-gauge-number" fill="white">
                            {analysis.usefulness_score}
                          </text>
                          <text x="60" y="72" textAnchor="middle" className="yt-gauge-label" fill={verdictConfig.color}>
                            / 100
                          </text>
                        </svg>
                      </div>

                      <div>
                        <div
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider mb-1"
                          style={{
                            background: verdictConfig.bgColor,
                            border: `1px solid ${verdictConfig.borderColor}`,
                            color: verdictConfig.color,
                          }}
                        >
                          {React.createElement(verdictConfig.icon, { className: 'h-3.5 w-3.5' })}
                          {verdictConfig.label}
                        </div>
                        <p className="text-xs text-slate-400 max-w-xs">{analysis.verdict_reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="hud-panel border border-white/10 p-6" style={{ background: 'var(--hud-bg)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-white">AI Summary</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Topic Explanation Card */}
              <div className="hud-panel border border-white/10 p-6" style={{ background: 'var(--hud-bg)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-white">Topic Explanation</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.topic_explanation}</p>
              </div>

              {/* Key Takeaways */}
              <div className="hud-panel border border-white/10 p-6" style={{ background: 'var(--hud-bg)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-white">Key Takeaways</h3>
                </div>
                <ul className="space-y-3">
                  {analysis.key_takeaways?.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          color: 'var(--neon-emerald)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-300 leading-relaxed">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Study Actions */}
              {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
                <div className="hud-panel border border-white/10 p-6" style={{ background: 'var(--hud-bg)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-white">Recommended Study Actions</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analysis.recommended_actions.map((action, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/20 transition-colors"
                      >
                        <TrendingUp className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                        <span className="text-sm text-slate-300">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyze Another */}
              <div className="text-center pt-2">
                <button
                  onClick={handleNewAnalysis}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold text-slate-300 hover:text-white transition-all"
                >
                  <Search className="h-4 w-4" />
                  Analyze Another Video
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default YouTubeAnalyzer
