import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, GraduationCap, User } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2 group" aria-label="StudyAI Home Dashboard">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                <GraduationCap className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-indigo-200 to-cyan-300 bg-clip-text">
                StudyAI
              </span>
            </Link>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10" aria-label={`Logged in as ${user.name || user.email}`}>
                <div className="w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300 uppercase" aria-hidden="true">
                  {user.name ? user.name[0] : user.email[0]}
                </div>
                <span className="text-sm font-medium text-slate-200 hidden sm:inline">
                  {user.name || user.email.split('@')[0]}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                aria-label="Log out of StudyAI"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-semibold transition-all duration-200"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
