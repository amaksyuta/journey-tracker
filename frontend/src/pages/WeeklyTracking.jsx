import { useState } from 'react'
import { Calendar, CheckCircle2, Circle, Plus, Target, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Button, Card, Chip, Empty, ErrorBox, Field, Modal, PageHeader, ProgressBar, inputCls, useLoad } from '../components/ui.jsx'

const CATEGORIES = ['Core Skills', 'Quest Badges', 'Deep Books', 'Civilization', 'Life Skills']

export default function WeeklyTracking() {
  const { refresh } = useAuth()
  const { data: goals, setData, error } = useLoad(() => api.get('/goals'), [])
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState(null)

  const replace = (g) => setData((list) => list.map((x) => (x.id === g.id ? g : x)))
  const call = async (fn) => { setErr(null); try { await fn() } catch (e) { setErr(e.message) } }
  const toggle = (g, m) => call(async () => { replace(await api.post(`/goals/${g.id}/milestones/${m.id}/toggle`)); refresh() })
  const addStep = (g, title) => call(async () => replace(await api.post(`/goals/${g.id}/milestones`, { title })))
  const remove = (g) => call(async () => {
    if (!confirm(`Delete goal "${g.title}"?`)) return
    await api.del(`/goals/${g.id}`)
    setData((list) => list.filter((x) => x.id !== g.id))
  })

  return (
    <div className="space-y-6">
      <PageHeader icon={Calendar} title="Weekly Goal Tracker" subtitle="Set your own goals, break them into milestones, and celebrate when you finish (+50 XP).">
        <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add Goal</Button>
      </PageHeader>
      <ErrorBox error={error || err} />
      {goals?.length === 0 && <Empty icon={Target} title="No goals yet" text="Click “Add Goal” to plan your week." />}
      <div className="space-y-4">
        {goals?.map((g) => (
          <Card key={g.id} className="p-6 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base">{g.title}</h3>
                  <Chip color="blue">{g.category}</Chip>
                  <Chip>{g.period}</Chip>
                  {g.progress === 100 && <Chip color="emerald">Achieved 🎉</Chip>}
                </div>
                {g.description && <p className="text-xs text-slate-500 mt-1">{g.description}</p>}
                {g.target_date && <p className="text-[11px] text-slate-400 mt-1">Target: {g.target_date}</p>}
              </div>
              <button onClick={() => remove(g)} className="text-slate-300 hover:text-rose-600" title="Delete goal"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <ProgressBar value={g.progress} color={g.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'} />
              <span className="text-xs font-bold text-slate-600 w-10 text-right">{g.progress}%</span>
            </div>
            <div className="space-y-2">
              {g.milestones.map((m) => (
                <button key={m.id} onClick={() => toggle(g, m)} className="flex items-center gap-2 text-xs w-full text-left">
                  {m.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                  <span className={m.completed ? 'line-through text-slate-400' : ''}>{m.title}</span>
                </button>
              ))}
              <AddStep onAdd={(t) => addStep(g, t)} />
            </div>
          </Card>
        ))}
      </div>
      {adding && <GoalForm onClose={() => setAdding(false)} onCreated={(g) => { setData((l) => [g, ...(l || [])]); setAdding(false) }} />}
    </div>
  )
}

function AddStep({ onAdd }) {
  const [t, setT] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t); setT('') } }} className="flex gap-2 pt-1">
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Add a milestone…" className={`${inputCls} py-1.5`} />
      <Button variant="ghost" type="submit" className="py-1.5"><Plus className="w-3.5 h-3.5" /></Button>
    </form>
  )
}

function GoalForm({ onClose, onCreated }) {
  const [f, setF] = useState({ title: '', description: '', category: CATEGORIES[0], period: 'weekly', target_date: '', steps: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    try {
      onCreated(await api.post('/goals', {
        title: f.title, description: f.description || null, category: f.category, period: f.period,
        target_date: f.target_date || null, milestones: f.steps.split('\n').map((s) => s.trim()).filter(Boolean),
      }))
    } catch (err) { setError(err.message) }
  }
  return (
    <Modal title="New Goal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Goal"><input required value={f.title} onChange={set('title')} className={inputCls} placeholder="e.g. Finish my robotics prototype" /></Field>
        <Field label="Why it matters (optional)"><textarea rows={2} value={f.description} onChange={set('description')} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><select value={f.category} onChange={set('category')} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Type"><select value={f.period} onChange={set('period')} className={inputCls}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="session">Session</option></select></Field>
        </div>
        <Field label="Target date"><input type="date" value={f.target_date} onChange={set('target_date')} className={inputCls} /></Field>
        <Field label="Milestones (one per line)"><textarea rows={4} value={f.steps} onChange={set('steps')} className={inputCls} placeholder={'Sketch the design\nBuild it\nShow a Guide'} /></Field>
        <ErrorBox error={error} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Goal</Button>
        </div>
      </form>
    </Modal>
  )
}
