import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { recordActivity } from '../utils/userProgress'
import { useSessionHistory } from '../utils/useSessionHistory'
import SessionSidebar, { SidebarToggle } from '../components/SessionSidebar'
import axios from 'axios'
import { 
  ArrowLeft, 
  FileText, 
  HelpCircle, 
  Sparkles, 
  Calendar, 
  Upload, 
  Play, 
  Lightbulb, 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  Crosshair, 
  Compass, 
  Loader2,
  CheckCircle,
  XCircle,
  HelpCircle as QuestionIcon,
  BookOpen
} from 'lucide-react'

const API_BASE = 'http://localhost:8000'

const TOOLS = [
  { 
    id: 'summarize', 
    title: 'Notes Summarizer', 
    icon: FileText, 
    endpoint: '/summarize', 
    placeholder: 'Paste your study notes here to extract strategic takeaways...', 
    description: 'Upload a tactical PDF briefing or paste raw text to compile a concise summary.', 
    acceptsFile: true,
    neonColor: 'var(--neon-teal)',
    glowClass: 'glow-teal',
    badge: 'INTEL DECK'
  },
  { 
    id: 'quiz', 
    title: 'Quiz Generator', 
    icon: HelpCircle, 
    endpoint: '/generate-quiz', 
    placeholder: 'Paste study files or notes here to generate a custom combat mock test...', 
    description: 'Turn study material into interactive combat training exercises with full review metrics.', 
    acceptsFile: true,
    neonColor: 'var(--neon-purple)',
    glowClass: 'glow-purple',
    badge: 'COMBAT SIM'
  },
  { 
    id: 'explain', 
    title: 'Concept Explainer', 
    icon: Sparkles, 
    endpoint: '/explain', 
    placeholder: 'Enter concept (e.g. Quantum Entanglement, Binary Search, Photosynthesis)...', 
    description: 'Struggling with a dense theory? Run it through the Analogy Reactor for simplified comparisons.', 
    acceptsFile: false,
    neonColor: 'var(--neon-amber)',
    glowClass: 'glow-amber',
    badge: 'THEORY CORE'
  },
  { 
    id: 'plan', 
    title: 'Revision Planner', 
    icon: Calendar, 
    endpoint: '/generate-plan', 
    placeholder: 'Paste your campaign syllabus or course structure to outline a timeline...', 
    description: 'Generate a personalized daily study timeline layout based on your syllabus metrics.', 
    acceptsFile: true,
    neonColor: 'var(--neon-emerald)',
    glowClass: 'glow-emerald',
    badge: 'CAMPAIGN MAP'
  }
]

function getDefaultStudyData() {
  return {
    toolId: 'summarize',
    inputText: '',
    planDays: 7,
    result: null
  }
}

function studyTitleExtractor(data) {
  const tool = TOOLS.find(t => t.id === data.toolId)
  const toolName = tool ? tool.title : 'Study Tool'
  if (data.inputText) {
    const preview = data.inputText.trim().slice(0, 30)
    return `${toolName}: ${preview}${data.inputText.length > 30 ? '…' : ''}`
  }
  return toolName
}

const StudyTools = () => {
  const { user } = useAuth()
  const userId = user?.id || user?.email

  const {
    sessions,
    activeSessionId,
    activeData,
    createSession,
    selectSession,
    deleteSession,
    saveSession
  } = useSessionHistory('studytools', userId, getDefaultStudyData(), studyTitleExtractor)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  // Derived state
  const activeTool = TOOLS.find(t => t.id === activeData.toolId) || TOOLS[0]
  const text = activeData.inputText || ''
  const planDays = activeData.planDays || 7
  const result = activeData.result || null

  const setText = (newText) => {
    saveSession({ ...activeData, inputText: newText })
  }

  const setPlanDays = (days) => {
    saveSession({ ...activeData, planDays: days })
  }

  const handleSelectTool = (tool) => {
    const newId = createSession()
    saveSession({ ...getDefaultStudyData(), toolId: tool.id }, newId)
    setFile(null)
  }

  const handleNewSession = () => {
    const newId = createSession()
    saveSession(getDefaultStudyData(), newId)
    setFile(null)
  }

  const handleFileUpload = (e) => {
    setFile(e.target.files[0])
  }

  const handleSubmit = async () => {
    if (!text && !file) return
    setLoading(true)

    try {
      const formData = new FormData()
      if (file) formData.append('file', file)
      if (text) formData.append('text', text)

      if (activeTool.id === 'explain') formData.append('concept', text)
      if (activeTool.id === 'plan') formData.append('days', planDays)

      const resp = await axios.post(`${API_BASE}${activeTool.endpoint}`, formData)

      // Save result to session
      saveSession({ ...activeData, result: resp.data })

      recordActivity(user, {
        moduleKey: 'studyTools',
        title: `Used ${activeTool.title}`,
        xpEarned: 100
      })
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const toolLabel = (session) => {
    const tool = TOOLS.find(t => t.id === session.data?.toolId)
    return tool ? tool.badge : ''
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Command Deck
        </Link>
        <SidebarToggle sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Session History Sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewSession}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
          moduleLabel="Session"
          countExtractor={toolLabel}
          icon={BookOpen}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* ═══ Tactical Sidebar (Tool Selector) ═══ */}
            <div className="lg:col-span-1 space-y-4">
              <div className="hud-panel p-4" style={{ background: 'var(--hud-bg)' }}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Compass className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">System Selector</h3>
                </div>
                
                <div className="flex flex-col gap-2" role="tablist" aria-label="Study tool options">
                  {TOOLS.map((tool) => {
                    const Icon = tool.icon
                    const isActive = activeTool.id === tool.id
                    return (
                      <button
                        key={tool.id}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls="study-tool-workspace"
                        onClick={() => handleSelectTool(tool)}
                        className="w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between"
                        style={{
                          background: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                          borderColor: isActive ? tool.neonColor : 'var(--hud-border)',
                          boxShadow: isActive ? `0 0 15px ${tool.neonColor}20` : 'none',
                          color: isActive ? 'white' : 'var(--text-secondary)'
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? tool.neonColor : 'inherit' }} />
                          <span className="font-mono tracking-wide">{tool.title}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 tracking-wider">
                          {tool.badge}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quick HUD Metrics */}
              <div className="hud-panel p-4 space-y-3" style={{ background: 'var(--hud-glass)' }}>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Cpu className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">AI Co-Processor</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-600">Core Engine</span>
                    <span className="text-emerald-400 glow-emerald">Active v3.5</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-600">Model Temp</span>
                    <span className="text-slate-400">Normal (0.7)</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-600">Access Tier</span>
                    <span className="text-cyan-400 glow-teal">Gamer Elite</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Mission Analysis Workspace ═══ */}
            <div className="lg:col-span-3 space-y-6">
              <div className="hud-panel p-6 space-y-5" style={{ background: 'var(--hud-bg)' }}>
                
                {/* Top decorative accent */}
                <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${activeTool.neonColor}, transparent)` }} />

                {/* Tool Header */}
                <div className="flex justify-between items-start border-b border-white/[0.04] pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-white" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.05)' }}>
                      {activeTool.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">{activeTool.description}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-1 rounded border border-white/5 bg-white/[0.02]"
                    style={{ color: activeTool.neonColor, borderColor: `${activeTool.neonColor}30` }}>
                    {activeTool.badge}
                  </span>
                </div>

                {/* File Upload Zone */}
                {activeTool.acceptsFile && (
                  <div
                    onClick={() => document.getElementById('tool-file-input').click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        document.getElementById('tool-file-input').click();
                      }
                    }}
                    tabIndex="0"
                    role="button"
                    aria-label={`Upload PDF file for ${activeTool.title}`}
                    className="p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all hover:bg-white/[0.01] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    style={{
                      borderColor: file ? 'var(--neon-teal)' : 'var(--hud-border)',
                      background: file ? 'rgba(0, 245, 212, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                      boxShadow: file ? '0 0 15px rgba(0, 245, 212, 0.05)' : 'none'
                    }}
                  >
                    <input type="file" id="tool-file-input" hidden tabIndex="-1" aria-hidden="true" onChange={handleFileUpload} accept=".pdf" />
                    <Upload className="h-6 w-6 mx-auto text-slate-500 mb-2 transition-transform duration-300 hover:translate-y-[-2px]" />
                    <p className="text-xs font-mono" style={{ color: file ? 'var(--neon-teal)' : 'var(--text-secondary)' }}>
                      {file ? `📄 BRIEFING ACQUIRED: ${file.name}` : 'DEPLOY PDF SYLLABUS / STUDY GUIDE'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">CLICK OR PRESS ENTER TO LOCATE ARCHIVE</p>
                  </div>
                )}

                <div className="relative">
                  <label htmlFor="study-tool-textarea" className="sr-only">Input text content for {activeTool.title}</label>
                  <textarea
                    id="study-tool-textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={activeTool.placeholder}
                    className="w-full h-40 p-4 rounded-2xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all resize-none leading-relaxed"
                    style={{ 
                       background: 'var(--hud-bg-solid)', 
                       border: '1px solid var(--hud-border)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = activeTool.neonColor
                      e.target.style.boxShadow = `0 0 15px ${activeTool.neonColor}20`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--hud-border)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <div className="absolute bottom-3 right-3 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                    RAW_INTEL_BUFFER ({text.length} chars)
                  </div>
                </div>

                {/* Days Slider for Revision Planner */}
                {activeTool.id === 'plan' && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: 'var(--hud-glass)', borderColor: 'var(--hud-border)' }}>
                    <label htmlFor="campaign-window-slider" className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Campaign Window:</label>
                    <input
                      id="campaign-window-slider"
                      type="range"
                      min="1"
                      max="30"
                      value={planDays}
                      onChange={(e) => setPlanDays(e.target.value)}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="text-lg font-black font-mono w-10 text-center" style={{ color: 'var(--neon-emerald)', textShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }}>
                      {planDays}d
                    </span>
                  </div>
                )}

                {/* Submit Control Action */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || (!text && !file)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-xs font-mono tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: `linear-gradient(135deg, ${activeTool.neonColor}, rgba(99, 102, 241, 0.8))`,
                      boxShadow: (text || file) && !loading ? `0 0 20px ${activeTool.neonColor}30` : 'none'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        COMPILING SYNERGY MATRIX...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        INITIATE DATA TRANSMISSION
                      </>
                    )}
                  </button>

                  {loading && (
                    <span className="text-[10px] font-mono text-slate-600 animate-pulse uppercase">
                      ▸ accessing artificial intellect core...
                    </span>
                  )}
                </div>

                {/* Results Grid Frame */}
                {result && (
                  <div className="border-t border-white/[0.04] pt-6 space-y-4">
                    {activeTool.id === 'summarize' && <SummarizeResult result={result} activeTool={activeTool} />}
                    {activeTool.id === 'quiz' && <QuizResult result={result} activeTool={activeTool} />}
                    {activeTool.id === 'explain' && <ExplainResult result={result} activeTool={activeTool} />}
                    {activeTool.id === 'plan' && <PlanResult result={result} activeTool={activeTool} />}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Result Sub-Components ─── */

const SummarizeResult = ({ result, activeTool }) => (
  <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--hud-bg-solid)', borderColor: 'var(--hud-border)' }}>
    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
      <FileText className="h-4 w-4" style={{ color: activeTool.neonColor }} /> 
      INTEL ANALYSIS SUM
    </h3>
    <p className="text-xs text-slate-300 leading-relaxed font-mono">{result.summary}</p>
    {result.key_points && result.key_points.length > 0 && (
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider font-mono mt-3" style={{ color: activeTool.neonColor }}>
          Strategic Bullet Points
        </h4>
        <ul className="space-y-1.5">
          {result.key_points.map((pt, i) => (
            <li key={i} className="text-xs text-slate-400 flex items-start gap-2 font-mono">
              <span style={{ color: activeTool.neonColor }}>▸</span> {pt}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)

const QuizResult = ({ result, activeTool }) => {
  const [answers, setAnswers] = useState({})

  const handleAnswer = (qIdx, option, correct) => {
    setAnswers(prev => ({ ...prev, [qIdx]: { selected: option, isCorrect: option === correct } }))
  }

  const questions = Array.isArray(result) ? result : []

  return (
    <div className="p-5 rounded-2xl border space-y-6" style={{ background: 'var(--hud-bg-solid)', borderColor: 'var(--hud-border)' }}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
        <HelpCircle className="h-4 w-4" style={{ color: activeTool.neonColor }} /> 
        TACTICAL EVALUATION INVENTORY
      </h3>
      {questions.map((q, i) => (
        <div key={i} className="space-y-3 pb-4 border-b border-white/[0.04] last:border-0">
          <div className="flex gap-2 items-start">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
              Q{i + 1}
            </span>
            <p className="text-xs font-bold text-white font-mono leading-relaxed">{q.question}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {q.options?.map((opt, j) => {
              const answered = answers[i]
              let customStyle = {
                background: 'var(--hud-glass)',
                borderColor: 'var(--hud-border)',
                color: 'var(--text-secondary)'
              }

              if (answered) {
                if (opt === q.correct_answer) {
                  customStyle = {
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderColor: 'var(--neon-emerald)',
                    color: 'var(--neon-emerald)',
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
                  }
                } else if (opt === answered.selected && !answered.isCorrect) {
                  customStyle = {
                    background: 'rgba(255, 45, 111, 0.08)',
                    borderColor: 'var(--neon-magenta)',
                    color: 'var(--neon-magenta)',
                    boxShadow: '0 0 10px rgba(255, 45, 111, 0.2)'
                  }
                } else {
                  customStyle = {
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderColor: 'var(--hud-border)',
                    color: 'var(--text-secondary)',
                    opacity: 0.3
                  }
                }
              }

              return (
                <button
                  key={j}
                  onClick={() => !answered && handleAnswer(i, opt, q.correct_answer)}
                  disabled={!!answered}
                  className="text-left p-3 rounded-xl border text-xs font-bold transition-all font-mono tracking-wide"
                  style={customStyle}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {answers[i] && (
            <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] flex gap-2 items-start animate-fadeIn">
              <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 mt-0.5" />
              <p className="text-[10px] text-slate-400 italic font-mono leading-relaxed">
                ANALYSIS BRIEFING: {q.explanation}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const ExplainResult = ({ result, activeTool }) => (
  <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--hud-bg-solid)', borderColor: 'var(--hud-border)' }}>
    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
      <Sparkles className="h-4 w-4" style={{ color: activeTool.neonColor }} /> 
      RECONSTRUCTION LOG
    </h3>
    <p className="text-xs text-slate-300 leading-relaxed font-mono">{result.explanation}</p>

    {result.analogy && (
      <div className="p-4 rounded-xl border" style={{ background: 'rgba(251, 191, 36, 0.04)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>
        <h4 className="text-[10px] font-bold uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--neon-amber)', textShadow: '0 0 6px rgba(251, 191, 36, 0.4)' }}>
          <Lightbulb className="h-3.5 w-3.5 animate-pulse" /> SIMULATION ANALOGY
        </h4>
        <p className="text-xs text-slate-300 italic font-mono leading-relaxed">"{result.analogy}"</p>
      </div>
    )}

    {result.key_takeaway && (
      <div className="p-4 rounded-xl border" style={{ background: 'rgba(0, 245, 212, 0.04)', borderColor: 'rgba(0, 245, 212, 0.2)' }}>
        <h4 className="text-[10px] font-bold uppercase tracking-wider font-mono mb-1" style={{ color: 'var(--neon-teal)', textShadow: '0 0 6px rgba(0, 245, 212, 0.4)' }}>
          CORE MATRIX CONCEPT
        </h4>
        <p className="text-xs text-slate-300 font-mono leading-relaxed">{result.key_takeaway}</p>
      </div>
    )}
  </div>
)

const PlanResult = ({ result, activeTool }) => {
  const plans = Array.isArray(result) ? result : []
  return (
    <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--hud-bg-solid)', borderColor: 'var(--hud-border)' }}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
        <Calendar className="h-4 w-4" style={{ color: activeTool.neonColor }} /> 
        CAMPAIGN TIMELINE MAP
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((item, i) => (
          <div 
            key={i} 
            className="p-4 rounded-xl border space-y-2.5 transition-all hover:scale-[1.02]" 
            style={{ 
              background: item.is_revision ? 'rgba(251, 191, 36, 0.04)' : 'rgba(255, 255, 255, 0.01)', 
              borderColor: item.is_revision ? 'rgba(251, 191, 36, 0.25)' : 'var(--hud-border)',
              boxShadow: item.is_revision ? '0 0 10px rgba(251, 191, 36, 0.05)' : 'none'
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold" style={{ color: item.is_revision ? 'var(--neon-amber)' : 'var(--neon-emerald)' }}>
                DAY {item.day}
              </span>
              {item.is_revision && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">REVISION</span>
              )}
            </div>
            <h4 className="text-xs font-bold text-white font-mono leading-tight">{item.title}</h4>
            <ul className="space-y-1 border-t border-white/[0.04] pt-2">
              {item.tasks?.map((task, j) => (
                <li key={j} className="text-[10px] text-slate-500 flex items-start gap-1 font-mono">
                  <span style={{ color: item.is_revision ? 'var(--neon-amber)' : 'var(--neon-emerald)' }}>▸</span> {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StudyTools
