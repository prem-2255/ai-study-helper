import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react'

const MAX_PASSWORD_LENGTH = 72

const ForgotPassword = () => {
  const [step, setStep] = useState(1) // 1: Request Code, 2: Reset Password, 3: Success
  const [email, setEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState(null)

  const { forgotPassword, resetPassword } = useAuth()
  const navigate = useNavigate()

  const handleRequestCode = async (e) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setDevCode(null)

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    const result = await forgotPassword(email)
    setLoading(false)

    if (result.success) {
      setInfoMessage(result.message)
      if (result.resetCode) {
        setDevCode(result.resetCode)
      }
      setStep(2)
    } else {
      setError(result.error)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')

    if (!resetCode) {
      setError('Please enter the reset code.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      setError(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await resetPassword(resetCode, newPassword)
    setLoading(false)

    if (result.success) {
      setStep(3)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Ambient glow effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="text-center relative">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
            {step === 3 ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : (
              <ShieldCheck className="h-6 w-6" />
            )}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            {step === 1 && 'Reset Your Password'}
            {step === 2 && 'Enter Reset Code'}
            {step === 3 && 'Password Reset Complete'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {step === 1 && 'Enter your registered email to receive a password reset code.'}
            {step === 2 && 'Check your email for the 6-digit reset code and set a new password.'}
            {step === 3 && 'Your password has been reset successfully. You can now sign in.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-sm font-medium text-red-400 animate-shake">
            ⚠️ {error}
          </div>
        )}

        {/* Info Alert */}
        {infoMessage && step === 2 && (
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-sm font-medium text-indigo-300">
            ℹ️ {infoMessage}
          </div>
        )}

        {/* Dev Mode Reset Code Banner */}
        {devCode && step === 2 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
            <div className="font-semibold text-amber-400 uppercase tracking-wider">Local Dev Reset Code:</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tracking-widest bg-black/40 px-3 py-1 rounded-lg text-amber-200">
                {devCode}
              </span>
              <button
                type="button"
                onClick={() => setResetCode(devCode)}
                className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-sans px-2.5 py-1 rounded-lg transition-all"
              >
                Auto-fill Code
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Request Reset Code */}
        {step === 1 && (
          <form className="mt-8 space-y-6" onSubmit={handleRequestCode}>
            <div>
              <label htmlFor="reset-email" className="sr-only">Email address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/5 py-3 pl-10 pr-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Reset Password Form */}
        {step === 2 && (
          <form className="mt-8 space-y-4" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="reset-code" className="block text-xs font-medium text-slate-400 mb-1">
                6-Digit Reset Code
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <RefreshCw className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  id="reset-code"
                  name="resetCode"
                  type="text"
                  required
                  maxLength={10}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/5 py-3 pl-10 pr-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 font-mono tracking-wider transition-all"
                  placeholder="123456"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-slate-400 mb-1">
                New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/5 py-3 pl-10 pr-10 text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-400 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-2xl border-0 bg-white/5 py-3 pl-10 pr-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen */}
        {step === 3 && (
          <div className="mt-8 space-y-6 text-center">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm">
              ✨ Your password has been successfully updated! You can now log into your account using your new password.
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full flex justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex justify-center mt-6 pt-4 border-t border-white/10">
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
