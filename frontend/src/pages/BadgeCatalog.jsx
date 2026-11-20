import { useMemo, useState } from 'react'
import { Award, CheckCircle2, Search } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Button, Card, Chip, ErrorBox, Field, Modal, PageHeader, inputCls, useLoad } from '../components/ui.jsx'

const STATUS = {
  earned: { color: 'emerald', label: 'Earned' },
  in_review: { color: 'amber', label: 'In Review' },
  rejected: { color: 'rose', label: 'Needs work' },
}

export default function BadgeCatalog() {
  const { isLearner } = useAuth()
  const { data, error, reload } = useLoad(() => api.get('/badges'), [])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const cats = useMemo(() => ['All', ...new Set((data || []).map((b) => b.category))], [data])
  const shown = (data || []).filter((b) =>
    (cat === 'All' || b.category === cat) &&
    (b.title + b.description + b.skills.join(' ')).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader icon={Award} title="Badge Catalog" subtitle="See every badge, the skills it represents, and exactly what you need to do to earn it." />
      <Card className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search badges or skills…" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
          ))}
        </div>
      </Card>
      <ErrorBox error={error} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((b) => (
          <button key={b.id} onClick={() => setOpen(b)} className="text-left bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-blue-400 transition space-y-2">
            <div className="flex justify-between items-start">
              <div className="text-3xl">{b.icon}</div>
              {b.my_status && <Chip color={STATUS[b.my_status].color}>{STATUS[b.my_status].label}</Chip>}
            </div>
            <h3 className="font-bold text-sm">{b.title}</h3>
            <p className="text-xs text-slate-500 line-clamp-2">{b.description}</p>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{b.category}</span>
              <span className="text-[11px] text-amber-600 font-bold">+{b.xp} XP · {b.earned_count} earned</span>
            </div>
          </button>
        ))}
      </div>
      {open && <BadgeModal badge={open} canSubmit={isLearner} onClose={() => setOpen(null)} onSubmitted={() => { setOpen(null); reload() }} />}
    </div>
  )
}

function BadgeModal({ badge, canSubmit, onClose, onSubmitted }) {
  const [url, setUrl] = useState('')
  const [reflection, setReflection] = useState('')
  const [error, setError] = useState(null)
  const submittable = canSubmit && (!badge.my_status || badge.my_status === 'rejected')
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/badges/${badge.id}/submissions`, { evidence_url: url || null, reflection })
      onSubmitted()
    } catch (err) { setError(err.message) }
  }
  return (
    <Modal title={`${badge.icon} ${badge.title}`} onClose={onClose} wide>
      <div className="flex gap-2 flex-wrap"><Chip color="blue">{badge.category}</Chip><Chip color="amber">+{badge.xp} XP</Chip>
        {badge.my_status && <Chip color={STATUS[badge.my_status].color}>{STATUS[badge.my_status].label}</Chip>}</div>
      <p className="text-xs text-slate-700">{badge.description}</p>
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Skills</div>
        <div className="flex gap-1.5 flex-wrap">{badge.skills.map((s) => <Chip key={s} color="purple">{s}</Chip>)}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">What you need to do</div>
        <ul className="space-y-1.5">{badge.criteria.map((c) => (
          <li key={c} className="text-xs flex gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />{c}</li>
        ))}</ul>
      </div>
      {badge.my_feedback && <div className="p-2.5 bg-slate-50 border rounded-xl text-xs"><b>Guide feedback:</b> {badge.my_feedback}</div>}
      {submittable && (
        <form onSubmit={submit} className="space-y-3 pt-3 border-t border-slate-100">
          <div className="text-xs font-extrabold">Submit your evidence</div>
          <Field label="Link to your work (optional)"><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" /></Field>
          <Field label="Reflection - what did you learn?"><textarea required minLength={3} rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} className={inputCls} /></Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full py-2.5">Send to a Guide for review</Button>
        </form>
      )}
    </Modal>
  )
}
