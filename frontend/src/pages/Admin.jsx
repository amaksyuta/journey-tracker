import { useState } from 'react'
import { Award, Clock, Plus, Settings, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, Button, Card, Chip, Empty, ErrorBox, Field, Modal, PageHeader, inputCls, useLoad } from '../components/ui.jsx'

export default function Admin() {
  const [tab, setTab] = useState('review')
  const tabs = [
    { id: 'review', label: 'Badge Reviews', icon: Award },
    { id: 'users', label: 'Users & Council', icon: Users },
    { id: 'slots', label: 'Hearing Times', icon: Clock },
  ]
  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Guide Console" subtitle="Admin-only tools: approve badge evidence, manage accounts and roles, appoint the Council, and set appeal hearing times." />
      <Card className="p-2 flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
            tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </Card>
      {tab === 'review' && <Reviews />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'slots' && <Slots />}
    </div>
  )
}

function Reviews() {
  const { data, reload, error } = useLoad(() => api.get('/badges/submissions'), [])
  const [fb, setFb] = useState({})
  const [err, setErr] = useState(null)
  const review = async (id, decision) => {
    setErr(null)
    try { await api.post(`/badges/submissions/${id}/review`, { decision, feedback: fb[id] || null }); reload() } catch (e) { setErr(e.message) }
  }
  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-extrabold text-base">Evidence waiting for review</h3>
      <ErrorBox error={error || err} />
      {data?.length === 0 && <Empty icon={Award} title="Review queue is empty" />}
      {data?.map((s) => (
        <div key={s.id} className="p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{s.badge.icon}</div>
              <div>
                <div className="font-bold text-sm">{s.badge.title} <span className="text-amber-600 text-xs">+{s.badge.xp} XP</span></div>
                <div className="text-xs text-slate-500">{s.user.avatar} {s.user.display_name} · {fmtDate(s.submitted_at)}</div>
              </div>
            </div>
          </div>
          <p className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 italic">“{s.reflection}”</p>
          {s.evidence_url && <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-bold hover:underline">{s.evidence_url}</a>}
          <input placeholder="Feedback for the learner (optional)" className={inputCls} value={fb[s.id] || ''} onChange={(e) => setFb({ ...fb, [s.id]: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => review(s.id, 'reject')}>Needs more work</Button>
            <Button variant="success" onClick={() => review(s.id, 'approve')}>Award badge</Button>
          </div>
        </div>
      ))}
    </Card>
  )
}

function UsersAdmin() {
  const { user: me, refresh } = useAuth()
  const { data, setData, error } = useLoad(() => api.get('/admin/users'), [])
  const [err, setErr] = useState(null)
  const [creating, setCreating] = useState(false)
  const patch = async (u, body) => {
    setErr(null)
    try {
      const nu = await api.patch(`/admin/users/${u.id}`, body)
      setData((l) => l.map((x) => (x.id === nu.id ? nu : x)))
      refresh()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-base">Accounts</h3>
        <Button onClick={() => setCreating(true)}><UserPlus className="w-4 h-4" /> New account</Button>
      </div>
      <ErrorBox error={error || err} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b">
            <th className="py-2">Person</th><th>Username</th><th>Role</th><th>Council</th><th>Bucks</th><th>Active</th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className={`border-b border-slate-100 ${u.is_active ? '' : 'opacity-50'}`}>
                <td className="py-2.5"><div className="flex items-center gap-2"><Avatar emoji={u.avatar} size="sm" /><b>{u.display_name}</b></div></td>
                <td className="text-slate-500">{u.username}</td>
                <td>
                  <select value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    <option value="admin">admin (Guide)</option><option value="user">user (Learner)</option><option value="guest">guest</option>
                  </select>
                </td>
                <td>
                  {u.role === 'user' ? (
                    <button onClick={() => patch(u, { is_council: !u.is_council })}
                      className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 ${u.is_council ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      <Shield className="w-3 h-3" /> {u.is_council ? 'ON' : 'OFF'}
                    </button>
                  ) : <span className="text-slate-300">-</span>}
                </td>
                <td className="font-bold text-amber-700">{u.role === 'user' ? u.balance : '-'}</td>
                <td><input type="checkbox" checked={u.is_active} disabled={u.id === me.id} onChange={() => patch(u, { is_active: !u.is_active })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <NewUser onClose={() => setCreating(false)} onCreated={(u) => { setData((l) => [...l, u]); setCreating(false) }} />}
    </Card>
  )
}

function NewUser({ onClose, onCreated }) {
  const [f, setF] = useState({ display_name: '', username: '', password: '', avatar: '🙂', role: 'user', balance: 100, top_skill: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    try { onCreated(await api.post('/admin/users', { ...f, balance: Number(f.balance), top_skill: f.top_skill || null })) } catch (err) { setError(err.message) }
  }
  return (
    <Modal title="New account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <Field label="Display name"><input required value={f.display_name} onChange={set('display_name')} className={inputCls} /></Field>
          <Field label="Avatar"><input value={f.avatar} onChange={set('avatar')} className={`${inputCls} text-center`} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username"><input required minLength={3} value={f.username} onChange={set('username')} className={inputCls} /></Field>
          <Field label="Password (8+)"><input required minLength={8} type="password" value={f.password} onChange={set('password')} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role"><select value={f.role} onChange={set('role')} className={inputCls}><option value="user">Learner</option><option value="admin">Guide / admin</option><option value="guest">Guest</option></select></Field>
          <Field label="Starting Revel Bucks"><input type="number" min={0} value={f.balance} onChange={set('balance')} className={inputCls} disabled={f.role !== 'user'} /></Field>
        </div>
        <Field label="Top skill (optional)"><input value={f.top_skill} onChange={set('top_skill')} className={inputCls} /></Field>
        <ErrorBox error={error} />
        <div className="flex gap-2 justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Create</Button></div>
      </form>
    </Modal>
  )
}

function Slots() {
  const { data, reload, error } = useLoad(() => api.get('/admin/time-slots'), [])
  const [label, setLabel] = useState('')
  const [err, setErr] = useState(null)
  const call = async (fn) => { setErr(null); try { await fn(); reload() } catch (e) { setErr(e.message) } }
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-extrabold text-base">Appeal hearing times</h3>
        <p className="text-xs text-slate-500">A time disappears from the learners’ list while an appeal has booked it, and comes back when the appeal is resolved.</p>
      </div>
      <ErrorBox error={error || err} />
      <div className="space-y-2">
        {data?.filter((s) => s.is_active).map((s) => (
          <div key={s.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" />{s.label}</span>
            <div className="flex items-center gap-2">
              {s.is_booked ? <Chip color="amber">Booked</Chip> : <Chip color="emerald">Available</Chip>}
              {!s.is_booked && <button onClick={() => call(() => api.del(`/admin/time-slots/${s.id}`))} className="text-slate-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); call(async () => { await api.post('/admin/time-slots', { label }); setLabel('') }) }} className="flex gap-2">
        <input required minLength={3} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Friday Town Hall (2:00 PM - 2:30 PM)" className={inputCls} />
        <Button type="submit"><Plus className="w-4 h-4" /> Add</Button>
      </form>
    </Card>
  )
}
