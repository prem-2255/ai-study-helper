import React from 'react'
import {
  Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeftOpen,
  Clock
} from 'lucide-react'
import { formatRelativeTime } from '../utils/useSessionHistory'

/**
 * Reusable sidebar for session history.
 *
 * Props:
 *   sessions       - Array of session objects
 *   activeSessionId - ID of the active session
 *   onNewSession   - () => void
 *   onSelectSession - (session) => void
 *   onDeleteSession - (sessionId) => void
 *   sidebarOpen    - boolean
 *   onToggleSidebar - () => void
 *   moduleLabel    - string (e.g. "Chat", "Simulation", "Analysis")
 *   accentColor    - optional CSS color for active states (default: indigo)
 *   countExtractor - optional (session) => string for subtitle info
 *   icon           - optional Lucide icon component for each session row
 */
const SessionSidebar = ({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  sidebarOpen,
  onToggleSidebar,
  moduleLabel = 'Chat',
  accentColor,
  countExtractor,
  icon: SessionIcon = MessageSquare,
}) => {
  return (
    <>
      {/* Toggle button rendered separately in the chat header */}

      {/* Sidebar panel */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-72' : 'w-0'
        }`}
      >
        <div className="w-72 h-full flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-white/10 bg-slate-950/40">
            <button
              onClick={onNewSession}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New {moduleLabel}
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <SessionIcon className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  No {moduleLabel.toLowerCase()}s yet.<br />Start a new one to begin!
                </p>
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId
                return (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session)}
                    className={`group w-full text-left px-3 py-2.5 mx-1 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                      isActive
                        ? 'bg-indigo-500/15 border border-indigo-500/25'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                    style={{ width: 'calc(100% - 0.5rem)' }}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                      isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'
                    }`}>
                      <SessionIcon className="h-3.5 w-3.5" />
                    </div>

                    {/* Title & meta */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${
                        isActive ? 'text-indigo-200' : 'text-slate-300'
                      }`}>
                        {session.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                        {countExtractor && (
                          <span className="text-[10px] text-slate-600">
                            {countExtractor(session)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-all cursor-pointer flex-shrink-0 mt-0.5"
                      title={`Delete ${moduleLabel.toLowerCase()}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {sessions.length > 0 && (
            <div className="px-3 py-2.5 border-t border-white/5 bg-slate-950/30">
              <p className="text-[10px] text-slate-600 text-center">
                {sessions.length} {moduleLabel.toLowerCase()}{sessions.length !== 1 ? 's' : ''} saved locally
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Toggle button for the sidebar, meant to be placed inside the module's header.
 */
export const SidebarToggle = ({ sidebarOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
    title={sidebarOpen ? 'Hide history' : 'Show history'}
  >
    {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
  </button>
)

export default SessionSidebar
