import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { recordActivity } from '../utils/userProgress'
import { useSessionHistory } from '../utils/useSessionHistory'
import SessionSidebar, { SidebarToggle } from '../components/SessionSidebar'
import axios from 'axios'
import { ArrowLeft, RefreshCw, Activity, Cpu, Users, Award, ShieldAlert, Swords } from 'lucide-react'

const SCENARIOS = [
  {
    id: 1,
    title: 'Cyber Monday Traffic Surge',
    type: 'Infrastructure Operations',
    intro: 'It is 2:00 PM on Cyber Monday. The monitoring dashboard shows a sudden spike in CPU load to 98% on your primary web application cluster. Checkout times have surged from 1.2s to 12s, and users are beginning to get 504 Gateway Timeout errors.',
    initialMetrics: { health: 100, load: 20, users: 100 },
    initialOptions: [
      'Scale the web server cluster vertically (add more RAM/CPU to existing instances).',
      'Deploy replica read-only database nodes and route product page queries to them.',
      'Temporarily disable secondary non-critical features (like recommended items and analytics).'
    ]
  },
  {
    id: 2,
    title: 'Auxiliary Ransomware Breach',
    type: 'Security Operations',
    intro: 'An automated security scanner alerts you that file backup sync scripts on an auxiliary server are failing. Upon logging in, you find files with an unfamiliar extension, and a text file named "RESTORE_INSTRUCTIONS.txt" placed in the root directory. Encryption is actively spreading.',
    initialMetrics: { health: 100, load: 15, users: 100 },
    initialOptions: [
      'Isolate the auxiliary server by disabling its virtual network interface immediately.',
      'Run a full system security scan and attempt to delete the ransomware executable.',
      'Power off all local office servers to prevent potential lateral propagation.'
    ]
  }
]

function getDefaultSessionData(scenario) {
  return {
    scenarioId: scenario.id,
    history: [],
    metrics: { ...scenario.initialMetrics },
    currentNarrative: scenario.intro,
    options: [...scenario.initialOptions],
    finished: false,
    feedback: ''
  }
}

function simTitleExtractor(data) {
  const scenario = SCENARIOS.find(s => s.id === data.scenarioId)
  const name = scenario ? scenario.title : 'Simulation'
  const steps = data.history?.length || 0
  if (steps > 0) return `${name} (${steps} step${steps !== 1 ? 's' : ''})`
  return name
}

const SimulationModule = () => {
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
  } = useSessionHistory('simulation', userId, getDefaultSessionData(SCENARIOS[0]), simTitleExtractor)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(false)

  // Derived state from activeData
  const selectedScenario = SCENARIOS.find(s => s.id === activeData.scenarioId) || SCENARIOS[0]
  const history = activeData.history || []
  const metrics = activeData.metrics || selectedScenario.initialMetrics
  const currentNarrative = activeData.currentNarrative || selectedScenario.intro
  const options = activeData.options || selectedScenario.initialOptions
  const finished = activeData.finished || false
  const feedback = activeData.feedback || ''

  const handleSelectScenario = (scenario) => {
    const data = getDefaultSessionData(scenario)
    const newId = createSession()
    saveSession(data, newId)
  }

  const handleNewSession = () => {
    const data = getDefaultSessionData(SCENARIOS[0])
    const newId = createSession()
    saveSession(data, newId)
  }

  const handleChooseOption = async (option) => {
    setLoading(true)

    const pastActions = history.map(h => h.action)

    try {
      const resp = await axios.post(
        'http://localhost:8000/modules/simulation/action',
        {
          scenario: selectedScenario.title,
          history: pastActions,
          action: option
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const result = resp.data

      const newHealth = Math.min(100, Math.max(0, metrics.health + (result.metrics_change?.health || 0)))
      const newLoad = Math.min(100, Math.max(0, metrics.load + (result.metrics_change?.load || 0)))
      const newUsers = Math.min(200, Math.max(0, metrics.users + (result.metrics_change?.users || 0)))

      const newHistory = [...history, { action: option, narrative: result.narrative }]
      const isFinished = result.finished || newHealth <= 0

      const updatedData = {
        ...activeData,
        metrics: { health: newHealth, load: newLoad, users: newUsers },
        history: newHistory,
        currentNarrative: result.narrative,
        feedback: result.feedback,
        finished: isFinished,
        options: isFinished ? [] : (result.options || [])
      }

      saveSession(updatedData)

      if (isFinished && newHealth > 0) {
        recordActivity(user, {
          moduleKey: 'simulation',
          title: `Completed Scenario: ${selectedScenario.title}`,
          xpEarned: 200
        })
      }
    } catch (err) {
      alert('Error updating simulation: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = () => {
    const data = getDefaultSessionData(selectedScenario)
    const newId = createSession()
    saveSession(data, newId)
  }

  const getGrade = () => {
    if (metrics.health > 85) return { grade: 'A+', comment: 'Elite Engineering Lead. Excellent priority management and resource safety.' }
    if (metrics.health > 70) return { grade: 'B', comment: 'Competent System Administrator. Resolved the issue with minimal customer fallout.' }
    if (metrics.health > 40) return { grade: 'C', comment: 'Junior Engineer. The system survived, but with major resource degradation.' }
    return { grade: 'F', comment: 'Critical System Failure. Your decisions led to extended outages or data compromise.' }
  }

  const stepCount = (session) => {
    const steps = session.data?.history?.length || 0
    return `${steps} step${steps !== 1 ? 's' : ''}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
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
          moduleLabel="Simulation"
          countExtractor={stepCount}
          icon={Swords}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto space-y-6 min-w-0">
          {/* Scenario Selection */}
          <div className="flex gap-3 flex-wrap">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleSelectScenario(scenario)}
                className={`text-left p-3 rounded-xl border text-sm font-medium transition-all flex-1 min-w-[200px] ${
                  selectedScenario.id === scenario.id
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="block font-semibold mb-1">{scenario.title}</span>
                <span className="block text-[10px] text-slate-500">{scenario.type}</span>
              </button>
            ))}
          </div>

          {/* Live Metrics Header */}
          <div className="grid grid-cols-3 gap-4 p-5 bg-slate-950 border border-white/10 rounded-2xl">
            {/* System Health */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
                <Activity className={`h-4 w-4 ${metrics.health > 70 ? 'text-green-400' : metrics.health > 40 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`} />
                System Health
              </div>
              <div className="text-xl font-black text-white">{metrics.health}%</div>
              <div
                role="progressbar"
                aria-label="System Health"
                aria-valuenow={metrics.health}
                aria-valuemin="0"
                aria-valuemax="100"
                className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.health > 70 ? 'bg-green-500' : metrics.health > 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${metrics.health}%` }}
                />
              </div>
            </div>

            {/* CPU Load */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
                <Cpu className={`h-4 w-4 ${metrics.load < 60 ? 'text-green-400' : metrics.load < 85 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`} />
                System Load (CPU)
              </div>
              <div className="text-xl font-black text-white">{metrics.load}%</div>
              <div
                role="progressbar"
                aria-label="System CPU Load"
                aria-valuenow={metrics.load}
                aria-valuemin="0"
                aria-valuemax="100"
                className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.load < 60 ? 'bg-green-500' : metrics.load < 85 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${metrics.load}%` }}
                />
              </div>
            </div>

            {/* Active Traffic */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
                <Users className="h-4 w-4 text-cyan-400" />
                Active Traffic
              </div>
              <div className="text-xl font-black text-white">{metrics.users}%</div>
              <div
                role="progressbar"
                aria-label="Active Traffic load"
                aria-valuenow={metrics.users}
                aria-valuemin="0"
                aria-valuemax="200"
                className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.users)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Simulator Console */}
          <div className="p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Narrative text */}
            <div className="space-y-4" id="simulation-console-workspace">
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">Simulation Status Console</span>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-slate-100 font-medium leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-white/5 min-h-[100px]"
              >
                {currentNarrative}
              </p>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 italic leading-relaxed">
                💡 <strong>AI Feedback:</strong> {feedback}
              </div>
            )}

            {/* Decision Options */}
            {!finished && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Select Your Action:</h4>
                <div className="flex flex-col gap-3">
                  {options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChooseOption(opt)}
                      disabled={loading}
                      className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-sm text-slate-200 font-semibold cursor-pointer active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      {idx + 1}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Finished State */}
            {finished && (
              <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col items-center text-center space-y-4 animate-fadeIn">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                  <Award className="h-10 w-10 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Simulation Completed!</h3>
                  <div className="text-3xl font-black text-indigo-300 mt-1">Grade: {getGrade().grade}</div>
                  <p className="text-sm text-slate-300 mt-2 max-w-md">
                    {getGrade().comment}
                  </p>
                </div>
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart Simulation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimulationModule
