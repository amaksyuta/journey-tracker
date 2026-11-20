import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ icon: Icon, iconClass = 'text-blue-600', title, subtitle, children }) {
  return (
    <Card className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-6 h-6 ${iconClass}`} />}
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </Card>
  )
}

const BTN = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20',
  amber: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
  ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
  dark: 'bg-slate-900 hover:bg-slate-800 text-white',
}

export function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button
      className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Chip({ color = 'slate', children, className = '' }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-purple-100 text-purple-800',
  }[color]
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap ${c} ${className}`}>{children}</span>
}

export function Avatar({ emoji, size = 'md' }) {
  const s = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-lg', lg: 'w-12 h-12 text-xl', xl: 'w-16 h-16 text-3xl' }[size]
  return (
    <div className={`${s} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0`}>
      {emoji}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white border border-slate-200 w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700 block mb-1">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">{error}</div>
}

export function Empty({ icon: Icon, title, text }) {
  return (
    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
      {Icon && <Icon className="w-8 h-8 text-emerald-500 mx-auto mb-2" />}
      <h4 className="font-bold text-xs text-slate-700">{title}</h4>
      {text && <p className="text-xs text-slate-400 mt-1">{text}</p>}
    </div>
  )
}

export function ProgressBar({ value, color = 'bg-blue-600' }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

// Tiny data-loading hook: const { data, error, reload } = useLoad(() => api.get('/x'), [deps])
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fn().then((d) => alive && (setData(d), setError(null))).catch((e) => alive && setError(e.message))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, reload: () => setTick((t) => t + 1), setData }
}
