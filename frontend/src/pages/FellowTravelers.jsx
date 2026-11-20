import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { api } from '../api.js'
import { Avatar, Chip, PageHeader, useLoad } from '../components/ui.jsx'

export default function FellowTravelers() {
  const { data } = useLoad(() => api.get('/people'), [])
  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title="Fellow Travelers" subtitle="Your studio tribe - learners and Guides on the journey together." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.map((p) => {
          const inner = (
            <>
              <div className="flex items-center gap-3">
                <Avatar emoji={p.avatar} size="lg" />
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    {p.display_name}
                    {p.role === 'admin' && <Chip color="blue">Guide</Chip>}
                    {p.is_council && <Chip color="amber">Council</Chip>}
                  </div>
                  <span className="text-xs text-slate-500">{p.top_skill}</span>
                </div>
              </div>
              {p.role === 'user' && <span className="text-xs font-bold text-amber-600">⚡ {p.balance} RB</span>}
            </>
          )
          const cls = 'bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex justify-between items-center'
          return p.role === 'user'
            ? <Link key={p.id} to={`/portfolio/${p.id}`} className={`${cls} hover:border-blue-400`}>{inner}</Link>
            : <div key={p.id} className={cls}>{inner}</div>
        })}
      </div>
    </div>
  )
}
