import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import SimulationModule from './pages/SimulationModule'
import BuilderModule from './pages/BuilderModule'
import AssistantModule from './pages/AssistantModule'
import StudyTools from './pages/StudyTools'
import YouTubeAnalyzer from './pages/YouTubeAnalyzer'


function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-wrapper min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />


                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/simulation" element={<SimulationModule />} />
                  <Route path="/builder" element={<BuilderModule />} />
                  <Route path="/assistant" element={<AssistantModule />} />
                  <Route path="/study-tools" element={<StudyTools />} />
                  <Route path="/youtube-analyzer" element={<YouTubeAnalyzer />} />
                </Route>

                {/* Redirects */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
          <footer className="py-6 border-t border-white/5 bg-slate-950 text-center text-xs text-slate-500">
            &copy; 2026 StudyAI. Built with ❤️ for college simulation lab projects.
          </footer>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
