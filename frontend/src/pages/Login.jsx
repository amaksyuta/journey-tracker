import { useState } from 'react'
import { Compass, Eye, LogIn } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { Button, ErrorBox, Field, inputCls } from '../components/ui.jsx'

const DEMO = [
  { u: 'alex', p: 'revel123', label: 'Alex · learner + Council' },
  { u: 'maya', p: 'revel123', label: 'Maya · learner' },
  { u: 'sarah', p: 'guide123', label: 'Guide Sarah · admin' },
]

export default function Login() {
  const { login, loginAsGuest } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/30">R</div>
          <h1 className="text-2xl font-extrabold">Revel Journey Tracker</h1>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <Compass className="w-3.5 h-3.5" /> Set goals · earn badges · build your Hero Portfolio
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); run(() => login(username, password)) }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4"
        >
          <Field label="Username">
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full py-2.5" disabled={busy}><LogIn className="w-4 h-4" /> Sign in</Button>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase"><div className="flex-1 h-px bg-slate-200" />or<div className="flex-1 h-px bg-slate-200" /></div>
          <Button type="button" variant="ghost" className="w-full py-2.5" disabled={busy} onClick={() => run(loginAsGuest)}>
            <Eye className="w-4 h-4" /> Continue as guest (read-only)
          </Button>
        </form>

        <div className="bg-white/70 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase">POC demo accounts</div>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.u} type="button" onClick={() => { setUsername(d.u); setPassword(d.p) }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
