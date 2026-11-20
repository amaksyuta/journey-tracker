import { Link, useParams } from 'react-router-dom'
import { ExternalLink, Trophy } from 'lucide-react'
import { api, fmtDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, Card, Chip, Empty, ErrorBox, PageHeader, ProgressBar, useLoad } from '../components/ui.jsx'

export default function Portfolio() {
  const { user } = useAuth()
  const { userId } = useParams()
  // Learners land on their own portfolio; guides/guests pick a learner from the list.
  const id = userId || (user.role === 'user' ? user.id : null)
  return id ? <OnePortfolio id={id} /> : <PickLearner />
}

function PickLearner() {
  const { data } = useLoad(() => api.get('/bucks/balances'), [])
  return (
    <div className="space-y-6">
      <PageHeader icon={Trophy} iconClass="text-amber-500" title="Hero Portfolios" subtitle="Choose a learner to see their earned badges and reflections." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.map((p) => (
          <Link key={p.id} to={`/portfolio/${p.id}`} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-blue-400 flex items-center gap-3">
            <Avatar emoji={p.avatar} size="lg" />
            <div><div className="font-bold text-sm">{p.display_name}</div><div className="text-xs text-slate-500">{p.top_skill}</div></div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function OnePortfolio({ id }) {
  const { data, error } = useLoad(() => api.get(`/portfolio/${id}`), [id])
  if (error) return <ErrorBox error={error} />
  if (!data) return null
  const skills = [...new Set(data.earned.flatMap((s) => s.badge.skills))]
  const byCat = data.earned.reduce((acc, s) => ({ ...acc, [s.badge.category]: (acc[s.badge.category] || 0) + 1 }), {})
  return (
    <div className="space-y-6">
      <Card className="p-6 flex flex-col md:flex-row gap-6 md:items-center">
        <Avatar emoji={data.user.avatar} size="xl" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold">{data.user.display_name}’s Hero Portfolio</h2>
            {data.user.is_council && <Chip color="amber">Council</Chip>}
          </div>
          <p className="text-xs text-slate-500">{data.user.top_skill} · Level {data.level} · {data.xp} XP · {data.earned.length} badges earned</p>
          <div className="max-w-sm"><ProgressBar value={(data.xp % 1000) / 10} color="bg-amber-400" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          {Object.entries(byCat).map(([c, n]) => (
            <div key={c} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"><div className="text-lg font-black text-blue-600">{n}</div><div className="text-[10px] font-bold text-slate-500">{c}</div></div>
          ))}
        </div>
      </Card>

      {skills.length > 0 && (
        <Card className="p-5 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Skills demonstrated</div>
          <div className="flex gap-1.5 flex-wrap">{skills.map((s) => <Chip key={s} color="purple">{s}</Chip>)}</div>
        </Card>
      )}

      {data.earned.length === 0 && <Empty icon={Trophy} title="No badges earned yet" text="Earned badges will appear here as a record of growth." />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.earned.map((s) => (
          <Card key={s.id} className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{s.badge.icon}</div>
              <div>
                <h3 className="font-extrabold text-sm">{s.badge.title}</h3>
                <div className="text-[11px] text-slate-500">{s.badge.category} · earned {fmtDate(s.reviewed_at)}</div>
              </div>
            </div>
            {s.reflection && <p className="text-xs italic text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">“{s.reflection}”</p>}
            {s.evidence_url && (
              <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600 inline-flex items-center gap-1 hover:underline">
                View evidence <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
