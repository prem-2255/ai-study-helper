import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { recordActivity } from '../utils/userProgress'
import { useSessionHistory } from '../utils/useSessionHistory'
import SessionSidebar, { SidebarToggle } from '../components/SessionSidebar'
import axios from 'axios'
import { ArrowLeft, Send, Sparkles, User, Bot, HelpCircle, MessageSquare } from 'lucide-react'

const SUGGESTIONS = [
  'Explain how recursion works.',
  'What is a binary search tree?',
  'Why do we use hashing?',
  'Explain time complexity.'
]

const DEFAULT_MESSAGES = [
  {
    role: 'model',
    content: 'Hello! I am your Socratic AI Tutor. What concept or problem are we exploring today? Remember, my goal is to guide you to find the answers yourself, so be ready to think!'
  }
]

// Derive title from first user message
function chatTitleExtractor(messages) {
  const firstUser = messages.find(m => m.role === 'user')
  return firstUser ? firstUser.content.trim() : 'New Chat'
}

const AssistantModule = () => {
  const { user, token } = useAuth()
  const userId = user?.id || user?.email

  const {
    sessions,
    activeSessionId,
    activeData: messages,
    createSession,
    selectSession,
    deleteSession,
    saveSession
  } = useSessionHistory('assistant', userId, DEFAULT_MESSAGES, chatTitleExtractor)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNewChat = () => {
    createSession()
    setInput('')
    inputRef.current?.focus()
  }

  const handleSelectConvo = (session) => {
    selectSession(session)
    setInput('')
    inputRef.current?.focus()
  }

  const handleSendMessage = async (text) => {
    if (!text.trim() || loading) return

    const newMessages = [...messages, { role: 'user', content: text }]
    const sessionId = saveSession(newMessages)
    setInput('')
    setLoading(true)

    try {
      const resp = await axios.post(
        'http://localhost:8000/modules/assistant/chat',
        { history: newMessages },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const withReply = [...newMessages, { role: 'model', content: resp.data.response }]
      saveSession(withReply, sessionId)

      recordActivity(user, {
        moduleKey: 'assistant',
        title: 'Socratic Tutor Consultation',
        xpEarned: 50
      })
    } catch (err) {
      alert('Error communicating with assistant: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const msgCount = (session) => {
    const count = session.data?.filter(m => m.role === 'user').length || 0
    return `${count} msg${count !== 1 ? 's' : ''}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewChat}
          onSelectSession={handleSelectConvo}
          onDeleteSession={deleteSession}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
          moduleLabel="Chat"
          countExtractor={msgCount}
          icon={MessageSquare}
        />

        {/* Main Chat */}
        <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden relative min-w-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarToggle sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Socratic AI Tutor</h2>
                <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Active Guidance Enabled
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 max-w-[200px] text-right hidden sm:flex">
              <HelpCircle className="h-3.5 w-3.5" /> No direct answers, just pure active learning
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" role="log" aria-live="polite">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div className={`p-2 rounded-xl h-fit w-fit flex-shrink-0 ${
                    isUser ? 'bg-indigo-600 text-white' : 'bg-white/10 text-indigo-400 border border-white/10'
                  }`}>
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white/5 border border-white/10 text-slate-100 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex gap-3 max-w-[85%] mr-auto items-center animate-pulse">
                <div className="p-2 bg-white/10 text-indigo-400 border border-white/10 rounded-xl h-fit w-fit">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-6 py-3 bg-slate-950/20 border-t border-white/5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-2">Try asking:</span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sug)}
                    disabled={loading}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-indigo-300 transition-all cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/10 bg-slate-950/40">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(input) }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or explain what you think..."
                aria-label="Socratic tutor chat message input"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message to Socratic tutor"
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssistantModule
