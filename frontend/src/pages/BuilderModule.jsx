import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { recordActivity } from '../utils/userProgress'
import axios from 'axios'
import { ArrowLeft, Play, Sparkles, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'

const PROBLEMS = [
  {
    id: 1,
    title: 'Absolute Value of x',
    description: 'Create a logic chain that takes an integer variable "x" and returns its absolute value. (For example, if x is -5, it should return 5. If x is 3, it should return 3).',
    availableBlocks: [
      { id: 'c1', type: 'condition', value: 'if x < 0', label: 'if (x < 0) { ... }' },
      { id: 'c2', type: 'condition', value: 'else', label: 'else { ... }' },
      { id: 's1', type: 'statement', value: 'return x', label: 'return x;' },
      { id: 's2', type: 'statement', value: 'return -x', label: 'return -x;' }
    ],
    testCases: [
      { input: -10, expected: 10 },
      { input: 5, expected: 5 },
      { input: 0, expected: 0 }
    ]
  },
  {
    id: 2,
    title: 'Is Even Number Check',
    description: 'Create a logic chain that takes an integer variable "x" and returns "True" if the number is even, and "False" if the number is odd.',
    availableBlocks: [
      { id: 'c3', type: 'condition', value: 'if x % 2 == 0', label: 'if (x % 2 == 0) { ... }' },
      { id: 'c4', type: 'condition', value: 'else', label: 'else { ... }' },
      { id: 's3', type: 'statement', value: 'return True', label: 'return true;' },
      { id: 's4', type: 'statement', value: 'return False', label: 'return false;' }
    ],
    testCases: [
      { input: 4, expected: true },
      { input: 7, expected: false },
      { input: -2, expected: true }
    ]
  }
]

const BuilderModule = () => {
  const { user, token } = useAuth()
  const [selectedProblem, setSelectedProblem] = useState(PROBLEMS[0])
  const [assembledBlocks, setAssembledBlocks] = useState([])
  const [testResults, setTestResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')

  const handleSelectProblem = (problem) => {
    setSelectedProblem(problem)
    setAssembledBlocks([])
    setTestResults(null)
    setHint('')
  }

  const handleAddBlock = (block) => {
    // Give each added block a unique key instance ID
    setAssembledBlocks(prev => [...prev, { ...block, instanceId: Date.now() + Math.random() }])
    setTestResults(null)
  }

  const handleRemoveBlock = (instanceId) => {
    setAssembledBlocks(prev => prev.filter(b => b.instanceId !== instanceId))
    setTestResults(null)
  }

  const handleClear = () => {
    setAssembledBlocks([])
    setTestResults(null)
    setHint('')
  }

  // Local execution logic to test solutions
  const runLocalTests = () => {
    const cases = selectedProblem.testCases
    let passedCount = 0
    
    const results = cases.map((tc) => {
      const inputVal = tc.input
      let actualOutput = null
      let matchedCond = null

      // Loop through assembled blocks sequentially
      for (let i = 0; i < assembledBlocks.length; i++) {
        const block = assembledBlocks[i]
        
        if (block.type === 'condition') {
          if (block.value === 'if x < 0') {
            matchedCond = inputVal < 0
          } else if (block.value === 'if x % 2 == 0') {
            matchedCond = inputVal % 2 === 0
          } else if (block.value === 'else') {
            matchedCond = !matchedCond
          }
        } 
        else if (block.type === 'statement') {
          // If no condition has been defined, evaluate always. Otherwise evaluate if matched condition is true
          if (matchedCond === null || matchedCond === true) {
            if (block.value === 'return x') actualOutput = inputVal
            if (block.value === 'return -x') actualOutput = -inputVal
            if (block.value === 'return True') actualOutput = true
            if (block.value === 'return False') actualOutput = false
            break // Break on first returning statement
          }
        }
      }

      const passed = actualOutput === tc.expected
      if (passed) passedCount++

      return {
        input: inputVal,
        expected: String(tc.expected),
        actual: actualOutput === null ? 'undefined' : String(actualOutput),
        passed
      }
    })

    const allPassed = passedCount === cases.length
    setTestResults({
      results,
      allPassed,
      passedCount,
      totalCount: cases.length
    })

    if (allPassed) {
      recordActivity(user, {
        moduleKey: 'builder',
        title: `Solved: ${selectedProblem.title}`,
        xpEarned: 150
      })
    }
  }

  const handleGetHint = async () => {
    setLoading(true)
    setHint('')
    try {
      const blockString = assembledBlocks.map((b, idx) => `${idx + 1}. [${b.type.toUpperCase()}] ${b.value}`).join('\n')
      const resp = await axios.post(
        'http://localhost:8000/modules/builder/hint',
        {
          problem: selectedProblem.description,
          blocks: blockString || 'No blocks added yet'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setHint(resp.data.hint)
    } catch (err) {
      alert('Error fetching hint: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Selection Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Tasks</h3>
            <div className="flex flex-col gap-2" role="tablist" aria-label="Available logic building tasks">
              {PROBLEMS.map((prob) => (
                <button
                  key={prob.id}
                  role="tab"
                  aria-selected={selectedProblem.id === prob.id}
                  aria-controls="logic-builder-canvas-workspace"
                  onClick={() => handleSelectProblem(prob)}
                  className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${
                    selectedProblem.id === prob.id
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {prob.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Available Blocks */}
          <div className="p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">{selectedProblem.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {selectedProblem.description}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logic Tool Blocks</h4>
              <div className="flex flex-col gap-2">
                {selectedProblem.availableBlocks.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => handleAddBlock(block)}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-slate-200 text-left font-mono text-sm transition-all"
                  >
                    <span>{block.label}</span>
                    <Plus className="h-4 w-4 text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Compiled Canvas */}
          <div className="p-6 bg-slate-950 border border-white/10 rounded-3xl space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assembled Algorithm</span>
                {assembledBlocks.length > 0 && (
                  <button 
                    onClick={handleClear}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>

              {/* Canvas List */}
              <div className="min-h-[160px] p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col gap-2 relative overflow-y-auto max-h-64">
                {assembledBlocks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center m-auto">Click blocks on the left to build your algorithm</p>
                ) : (
                  assembledBlocks.map((block) => (
                    <div 
                      key={block.instanceId} 
                      className={`flex justify-between items-center p-2.5 rounded-xl border text-sm font-mono leading-relaxed ${
                        block.type === 'condition' 
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 pl-3' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 pl-8'
                      }`}
                    >
                      <span>{block.label}</span>
                      <button 
                        onClick={() => handleRemoveBlock(block.instanceId)}
                        aria-label={`Remove block: ${block.label}`}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Run / Hint Actions */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={handleGetHint}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-indigo-300 font-semibold text-sm transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI Hint
                </button>

                <button
                  onClick={runLocalTests}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
                >
                  <Play className="h-4 w-4" />
                  Run Tests
                </button>
              </div>

              {/* Socratic Hint Display */}
              {hint && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-200 italic leading-relaxed">
                  💡 <strong>Tutor Hint:</strong> "{hint}"
                </div>
              )}

              {/* Tests output */}
              {testResults && (
                <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                  testResults.allPassed ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {testResults.allPassed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    Tests: {testResults.passedCount}/{testResults.totalCount} Passed
                  </div>
                  <div className="flex flex-col gap-1 font-mono text-[10px] text-slate-300 mt-1">
                    {testResults.results.map((r, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>Input: {r.input} &rarr; Expected: {r.expected}</span>
                        <span className={r.passed ? 'text-green-400' : 'text-red-400'}>
                          {r.passed ? 'PASS' : `FAIL (Got ${r.actual})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

export default BuilderModule
