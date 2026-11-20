import { Link } from 'react-router-dom'
import { Award, Calendar, Coins, ShieldAlert, Trophy } from 'lucide-react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Card, ProgressBar, useLoad } from '../components/ui.jsx'

export default function MissionControl() {
  const { user, isGuest, isAdmin } = useAuth()
  const { data } = useLoad(() => api.get('/dashboard'), [])
  const xpInLevel = user.xp % 1000

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-md">
        <h2 className="text-2xl font-extrabold">Welcome, {user.display_name}! 🏛️</h2>
        <p className="text-blue-100 text-xs mt-1">
          {isGuest ? 'You are visiting Revel Academy as a guest - explore the badge catalog and Hero portfolios.'
            : isAdmin ? 'Guide console: review badge evidence, manage the Council, and keep the studio economy fair.'
            : "Revel Academy Hero's Journey Tracker"}
        </p>
        {user.role === 'user' && (
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-[11px] font-bold text-blue-100 mb-1">
              <span>Level {user.level}</span><span>{xpInLevel} / 1000 XP to Level {user.level + 1}</span>
            </div>
            <ProgressBar value={xpInLevel / 10} color="bg-amber-400" />
          </div>
        )}
      </div>

      {user.role === 'user' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Revel Bucks" value={`⚡ ${user.balance}`} cls="text-amber-600" />
          <Stat label="Streak" value={`${user.streak} Days`} cls="text-orange-500" />
          <Stat label="Level" value={`Lvl ${user.level} (${user.xp} XP)`} cls="text-blue-600" />
          <Stat label="Badges earned" value={data ? `${data.badges_earned} 🏅` : '…'} cls="text-emerald-600" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {user.role === 'user' && <Quick to="/weekly" icon={Calendar} label="Weekly goals" sub={data ? `${data.goals_active} active · ${data.goals_done} done` : ''} />}
        <Quick to="/badges" icon={Award} label="Badge catalog" sub={data && user.role === 'user' ? `${data.badges_in_review} in review` : 'Explore'} />
        <Quick to="/portfolio" icon={Trophy} label="Hero portfolio" sub="Showcase" />
        {!isGuest && <Quick to="/revel-bucks" icon={ShieldAlert} label="Appeals" sub={data ? `${data.pending_appeals} pending` : ''} />}
        {isGuest && <Quick to="/revel-bucks" icon={Coins} label="Studio balances" sub="Read-only" />}
      </div>

      {!isGuest && data?.recent_transactions?.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="font-extrabold text-base flex items-center gap-2"><Coins className="w-5 h-5 text-amber-500" /> Recent Revel Bucks activity</h3>
          {data.recent_transactions.map((tx) => {
            const plus = tx.target.id === user.id ? tx.type === 'give' : tx.type === 'take'
            return (
              <div key={tx.id} className={`flex justify-between items-center text-xs p-3 rounded-xl border border-slate-100 ${tx.is_reversed ? 'tx-reversed' : ''}`}>
                <span className="strike"><b>{tx.actor.display_name}</b> {tx.type === 'give' ? 'gave' : 'took'} {tx.type === 'give' ? 'to' : 'from'} <b>{tx.target.display_name}</b> · <span className="text-slate-400">{fmtDate(tx.created_at)}</span></span>
                <span className={`font-black strike ${plus ? 'text-emerald-600' : 'text-rose-600'}`}>{plus ? '+' : '-'}{tx.amount} RB</span>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, cls }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-xl font-extrabold mt-1 ${cls}`}>{value}</div>
    </Card>
  )
}

function Quick({ to, icon: Icon, label, sub }) {
  return (
    <Link to={to} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-400 transition flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-xs font-bold text-slate-900">{label}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
    </Link>
  )
}
