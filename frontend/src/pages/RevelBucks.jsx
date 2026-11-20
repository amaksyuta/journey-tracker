import { useState } from 'react'
import { CheckCircle, Clock, Coins, Plus, Shield, ShieldAlert, XCircle } from 'lucide-react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, Button, Card, Chip, Empty, ErrorBox, Field, Modal, PageHeader, inputCls, useLoad } from '../components/ui.jsx'

/*
 Revel Bucks page - 4 tabs, as specified by the learner in the Gemini chats:
   1. My Revel Bucks       - personal scrollable ledger; click an entry for the reason + Appeal button
   2. Studio Balances      - every learner (no guides); click -> read-only ledger
   3. Studio Transactions  - every transaction, details inline; Appeal only for the person bucks were taken from
   4. Appeals              - pending appeals; Council/Guides see Approve / Deny
 Who-can-appeal and who-can-resolve come from the server (tx.can_appeal, appeal.can_resolve).
*/

export default function RevelBucks() {
  const { user, isGuest, isLearner, refresh } = useAuth()
  const tabs = [
    isLearner && { id: 'mine', label: 'My Revel Bucks' },
    { id: 'balances', label: 'Studio Balances' },
    !isGuest && { id: 'studio', label: 'Studio Transactions' },
    !isGuest && { id: 'appeals', label: 'Appeals' },
  ].filter(Boolean)
  const [tab, setTab] = useState(tabs[0].id)
  const [version, setVersion] = useState(0) // bump to reload all lists after a change
  const [showTx, setShowTx] = useState(false)
  const [detail, setDetail] = useState(null) // { tx, readOnly }
  const [appealFor, setAppealFor] = useState(null)
  const [member, setMember] = useState(null)

  const pending = useLoad(() => (isGuest ? Promise.resolve([]) : api.get('/bucks/appeals')), [version])
  const changed = () => { setVersion((v) => v + 1); refresh() }

  return (
    <div className="space-y-6">
      <PageHeader icon={Coins} iconClass="text-amber-500" title="Revel Bucks Economy"
        subtitle={isGuest ? 'Read-only view of studio balances.' : 'Give and take Revel Bucks, review the studio ledger, and file or resolve Council appeals.'}>
        {isLearner && (
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <div className="text-[10px] font-bold text-amber-800 uppercase">Your Balance</div>
            <div className="text-lg font-black text-amber-900">⚡ {user.balance} RB</div>
          </div>
        )}
        {!isGuest && <Button variant="amber" className="py-2.5" onClick={() => setShowTx(true)}><Plus className="w-4 h-4" /> Make a Transaction</Button>}
      </PageHeader>

      <Card className="p-2 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              tab === t.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            {t.label}
            {t.id === 'appeals' && pending.data?.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-rose-500 text-white">{pending.data.length}</span>
            )}
          </button>
        ))}
      </Card>

      {tab === 'mine' && <MyLedger version={version} onOpen={(tx) => setDetail({ tx })} />}
      {tab === 'balances' && <Balances version={version} onOpen={isGuest ? null : setMember} />}
      {tab === 'studio' && <StudioLedger version={version} onAppeal={setAppealFor} />}
      {tab === 'appeals' && <Appeals list={pending} onChanged={changed} />}

      {showTx && <MakeTransaction onClose={() => setShowTx(false)} onDone={() => { setShowTx(false); changed() }} />}
      {detail && !appealFor && (
        <TxDetail tx={detail.tx} readOnly={detail.readOnly} onClose={() => setDetail(null)}
          onAppeal={() => setAppealFor(detail.tx)} />
      )}
      {appealFor && (
        <AppealForm tx={appealFor} onClose={() => setAppealFor(null)}
          onDone={() => { setAppealFor(null); setDetail(null); changed() }} />
      )}
      {member && !detail && (
        <MemberLedger member={member} onClose={() => setMember(null)} onOpen={(tx) => setDetail({ tx, readOnly: true })} />
      )}
    </div>
  )
}

// Signed change of `me`'s balance caused by a transaction.
function deltaFor(tx, me) {
  if (tx.target.id === me.id) return tx.type === 'give' ? tx.amount : -tx.amount
  if (tx.actor.id === me.id && me.role === 'user') return tx.type === 'give' ? -tx.amount : tx.amount
  return 0
}

function StatusChips({ tx }) {
  return (
    <>
      <Chip color={tx.type === 'give' ? 'emerald' : 'rose'}>{tx.type === 'give' ? 'Given' : 'Taken'}</Chip>
      {tx.is_reversed && <Chip color="rose">Reversed</Chip>}
      {tx.appeal && (
        <Chip color={tx.appeal.status === 'approved' ? 'emerald' : tx.appeal.status === 'pending' ? 'amber' : 'slate'}>
          Appeal {tx.appeal.status}
        </Chip>
      )}
    </>
  )
}

function Sentence({ tx }) {
  return tx.type === 'give'
    ? <><b>{tx.actor.display_name}</b> gave <b>{tx.target.display_name}</b></>
    : <><b>{tx.actor.display_name}</b> took from <b>{tx.target.display_name}</b></>
}

// ---------------- Tab 1 ----------------
function MyLedger({ version, onOpen }) {
  const { user } = useAuth()
  const { data, error } = useLoad(() => api.get('/bucks/transactions?scope=mine'), [version])
  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-extrabold text-base">Your Personal Ledger</h3>
      <ErrorBox error={error} />
      <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2">
        {data?.length === 0 && <p className="text-xs text-slate-400 italic py-4 text-center">No transactions yet.</p>}
        {data?.map((tx) => {
          const d = deltaFor(tx, user)
          const other = tx.actor.id === user.id ? tx.target : tx.actor
          return (
            <button key={tx.id} onClick={() => onOpen(tx)}
              className={`w-full text-left p-4 rounded-xl border transition flex justify-between items-center gap-3 ${
                tx.is_reversed ? 'tx-reversed border-slate-200' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-2xl">{other.avatar}</div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span className="strike"><Sentence tx={tx} /></span><StatusChips tx={tx} />
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 strike">{tx.reason}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">{fmtDate(tx.created_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-black strike ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{d >= 0 ? '+' : ''}{d} RB</div>
                <span className="text-[10px] font-bold text-blue-600">Details</span>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------- Tab 2 ----------------
function Balances({ version, onOpen }) {
  const { data, error } = useLoad(() => api.get('/bucks/balances'), [version])
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-extrabold text-base">Studio Learner Balances</h3>
        <p className="text-xs text-slate-500">Guides are not listed.{onOpen && ' Click a Hero to see their read-only ledger.'}</p>
      </div>
      <ErrorBox error={error} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.map((p) => (
          <div key={p.id} onClick={() => onOpen?.(p)}
            className={`p-4 rounded-xl border border-slate-200 bg-white transition flex justify-between items-center shadow-xs ${onOpen ? 'cursor-pointer hover:border-blue-400' : ''}`}>
            <div className="flex items-center gap-3">
              <Avatar emoji={p.avatar} size="lg" />
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">{p.display_name}{p.is_council && <Chip color="amber">Council</Chip>}</div>
                <span className="text-xs text-slate-500">{p.top_skill}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-amber-700">⚡ {p.balance} RB</div>
              {onOpen && <span className="text-[10px] font-bold text-blue-600">View Ledger →</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function MemberLedger({ member, onClose, onOpen }) {
  const { data } = useLoad(() => api.get(`/bucks/transactions?scope=user&user_id=${member.id}`), [member.id])
  return (
    <Modal title={`${member.avatar} ${member.display_name}'s Ledger`} onClose={onClose} wide>
      <div className="flex justify-between items-center">
        <span className="text-xs text-amber-700 font-bold">⚡ {member.balance} Revel Bucks</span>
      </div>
      <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium">
        🔒 <strong>Read-only:</strong> you can browse {member.display_name}'s history, but not make transactions or appeals for them.
      </div>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {data?.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No transactions.</p>}
        {data?.map((tx) => (
          <button key={tx.id} onClick={() => onOpen(tx)}
            className={`w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 ${tx.is_reversed ? 'tx-reversed' : 'bg-white'}`}>
            <div className="flex justify-between items-start text-xs gap-2">
              <span className="strike"><Sentence tx={tx} /></span>
              <span className="font-black text-amber-700 shrink-0 strike">⚡ {tx.amount} RB</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-1 strike">{tx.reason}</p>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ---------------- Tab 3 ----------------
function StudioLedger({ version, onAppeal }) {
  const { data, error } = useLoad(() => api.get('/bucks/transactions?scope=studio'), [version])
  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-extrabold text-base">Studio Transaction History</h3>
      <ErrorBox error={error} />
      <div className="space-y-4 max-h-[640px] overflow-y-auto pr-2">
        {data?.map((tx) => (
          <div key={tx.id} className={`p-4 rounded-xl border border-slate-200 space-y-3 ${tx.is_reversed ? 'tx-reversed' : 'bg-white shadow-xs'}`}>
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center -space-x-2">
                  <Avatar emoji={tx.actor.avatar} size="sm" /><Avatar emoji={tx.target.avatar} size="sm" />
                </div>
                <div>
                  <div className="text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                    <span className="strike"><Sentence tx={tx} /></span><StatusChips tx={tx} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{fmtDate(tx.created_at)}</span>
                </div>
              </div>
              <div className="text-base font-black text-amber-700 shrink-0 strike">⚡ {tx.amount} RB</div>
            </div>
            <Reason tx={tx} />
            {tx.can_appeal && (
              <div className="flex justify-end">
                <Button variant="danger" className="py-1.5 px-3" onClick={() => onAppeal(tx)}><Shield className="w-3.5 h-3.5" /> Appeal</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function Reason({ tx }) {
  return (
    <div className="space-y-2">
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Reason</span>
        “{tx.reason}”
      </div>
      {tx.appeal && (
        <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-slate-800">
          <span className="text-[10px] font-bold text-blue-700 uppercase block mb-0.5">Reason for the appeal</span>
          “{tx.appeal.reason}”
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Hearing: {tx.appeal.time_slot}</div>
        </div>
      )}
    </div>
  )
}

// ---------------- Tab 4 ----------------
function Appeals({ list, onChanged }) {
  const { canResolveAppeals } = useAuth()
  const [error, setError] = useState(null)
  const resolve = async (id, decision) => {
    setError(null)
    try { await api.post(`/bucks/appeals/${id}/resolve`, { decision }); onChanged() } catch (e) { setError(e.message) }
  }
  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h3 className="font-extrabold text-base flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-500" /> Active Council Appeals</h3>
          <p className="text-xs text-slate-500">Resolved appeals leave this list; their result stays visible on the transaction.</p>
        </div>
        {!canResolveAppeals && (
          <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl font-medium">
            ℹ️ Only Council members and Guides can approve or deny appeals.
          </span>
        )}
      </div>
      <ErrorBox error={error || list.error} />
      {list.data?.length === 0 && <Empty icon={CheckCircle} title="No active appeals" text="Every appeal has been resolved by the Council." />}
      {list.data?.map((a) => (
        <div key={a.id} className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-4 shadow-xs">
          <div className="flex justify-between items-start pb-3 border-b border-rose-100 gap-3">
            <div>
              <Chip color="rose">Taken: -{a.transaction.amount} RB</Chip>
              <h4 className="font-extrabold text-sm mt-1">{a.initiator.display_name} took {a.transaction.amount} RB from {a.appellant.display_name}</h4>
              <p className="text-xs text-slate-600 italic mt-0.5">Original reason: “{a.transaction.reason}”</p>
            </div>
            <span className="text-[10px] text-slate-400 font-medium shrink-0">{fmtDate(a.transaction.created_at)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-blue-50 rounded-lg">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Appellant (appealing)</span>
                <span className="font-bold">{a.appellant.avatar} {a.appellant.display_name}</span>
              </div>
              <div className="p-2 bg-slate-100 rounded-lg">
                <span className="text-[10px] font-bold text-slate-600 uppercase block">Initiator (attends hearing)</span>
                <span className="font-bold">{a.initiator.avatar} {a.initiator.display_name}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
              <span className="font-extrabold text-slate-800">Reason for the appeal:</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-bold">🕒 Hearing: {a.time_slot}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">“{a.reason}”</p>
          </div>
          {a.can_resolve ? (
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => resolve(a.id, 'deny')}><XCircle className="w-4 h-4" /> Deny Appeal</Button>
              <Button variant="success" onClick={() => resolve(a.id, 'approve')}><CheckCircle className="w-4 h-4" /> Approve Appeal</Button>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 italic text-center">
              {canResolveAppeals ? 'You are part of this appeal - another Council member or a Guide will decide.' : 'Awaiting the Studio Council decision…'}
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}

// ---------------- Modals ----------------
function TxDetail({ tx, readOnly, onClose, onAppeal }) {
  const { user } = useAuth()
  return (
    <Modal title="Transaction Details" onClose={onClose}>
      <div className="space-y-3 text-xs">
        <Row k={tx.type === 'give' ? 'Given by' : 'Taken by'} v={`${tx.actor.avatar} ${tx.actor.display_name}`} />
        <Row k={tx.type === 'give' ? 'Given to' : 'Taken from'} v={`${tx.target.avatar} ${tx.target.display_name}`} />
        <Row k="Amount" v={<span className="text-amber-600">⚡ {tx.amount} Revel Bucks</span>} />
        <Row k="When" v={fmtDate(tx.created_at)} />
        <Reason tx={tx} />
        {tx.appeal && tx.appeal.status !== 'pending' && (
          <div className={`p-2 rounded-lg border text-[11px] font-bold flex items-center gap-2 ${
            tx.appeal.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            <Shield className="w-3.5 h-3.5" /> Appeal {tx.appeal.status}{tx.appeal.resolved_by && ` by ${tx.appeal.resolved_by}`}
            {tx.appeal.status === 'approved' && ' - transaction reversed'}
          </div>
        )}
        {tx.appeal?.status === 'pending' && (
          <div className="p-2 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 text-[11px] font-bold">Appeal pending - waiting for the Council.</div>
        )}
      </div>
      {!readOnly && tx.can_appeal && (
        <div className="pt-2 border-t border-slate-100">
          <Button variant="danger" className="w-full py-2.5" onClick={onAppeal}>Appeal</Button>
        </div>
      )}
      {!readOnly && !tx.can_appeal && tx.type === 'take' && !tx.appeal && !tx.is_reversed && (
        <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-500 text-center">
          {tx.actor.id === user.id
            ? '🔒 You took these Revel Bucks, so you can’t appeal - you’ll take part in the hearing if it’s appealed.'
            : `🔒 Only ${tx.target.display_name} can appeal this transaction.`}
        </div>
      )}
    </Modal>
  )
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-3"><span className="text-slate-500">{k}:</span><span className="font-bold text-slate-900 text-right">{v}</span></div>
)

function AppealForm({ tx, onClose, onDone }) {
  const { data: slots } = useLoad(() => api.get('/bucks/time-slots'), [])
  const [reason, setReason] = useState('')
  const [slot, setSlot] = useState('')
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/bucks/appeals', { transaction_id: tx.id, reason, time_slot_id: Number(slot) })
      onDone()
    } catch (err) { setError(err.message) }
  }
  return (
    <Modal title="File a Council Appeal" onClose={onClose}>
      <p className="text-xs text-slate-600"><b>{tx.actor.display_name}</b> took <b>{tx.amount} RB</b> from you: “{tx.reason}”</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Why are you appealing?">
          <textarea rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}
            placeholder="Explain why this was unfair or inaccurate…" />
        </Field>
        <Field label="Pick an appeal hearing time">
          {slots?.length === 0 ? <p className="text-xs text-rose-500 italic">All hearing times are booked - try again after an appeal is resolved.</p> : (
            <select required value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
              <option value="">-- Choose a time --</option>
              {slots?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </Field>
        <ErrorBox error={error} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!slots?.length}>Submit Appeal</Button>
        </div>
      </form>
    </Modal>
  )
}

function MakeTransaction({ onClose, onDone }) {
  const { user } = useAuth()
  const { data: people } = useLoad(() => api.get('/bucks/balances'), [])
  const [form, setForm] = useState({ target_id: '', type: 'give', amount: 5, reason: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/bucks/transactions', { ...form, target_id: Number(form.target_id), amount: Number(form.amount) })
      onDone()
    } catch (err) { setError(err.message) }
  }
  return (
    <Modal title="Make a Transaction" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Person">
          <select required value={form.target_id} onChange={set('target_id')} className={inputCls}>
            <option value="">-- Choose a learner --</option>
            {people?.filter((p) => p.id !== user.id).map((p) => <option key={p.id} value={p.id}>{p.avatar} {p.display_name}</option>)}
          </select>
        </Field>
        <Field label="Giving or taking?">
          <select value={form.type} onChange={set('type')} className={inputCls}>
            <option value="give">Give Revel Bucks (+)</option>
            <option value="take">Take Revel Bucks (-)</option>
          </select>
        </Field>
        <Field label="Amount">
          <input type="number" min={1} max={500} required value={form.amount} onChange={set('amount')} className={`${inputCls} font-bold`} />
        </Field>
        <Field label="Explanation / reason">
          <textarea rows={2} required minLength={3} value={form.reason} onChange={set('reason')} className={inputCls}
            placeholder="Why are you giving or taking these Revel Bucks?" />
        </Field>
        {user.role === 'admin' && <p className="text-[11px] text-slate-500">As a Guide, giving creates new bucks and taking removes them - your own balance doesn’t change.</p>}
        <ErrorBox error={error} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="amber">Confirm Transaction</Button>
        </div>
      </form>
    </Modal>
  )
}
