import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Award, Calendar, Coins, Flame, LogOut, Rocket, Settings, Shield, Trophy, Users, Zap } from 'lucide-react'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import MissionControl from './pages/MissionControl.jsx'
import RevelBucks from './pages/RevelBucks.jsx'
import WeeklyTracking from './pages/WeeklyTracking.jsx'
import BadgeCatalog from './pages/BadgeCatalog.jsx'
import Portfolio from './pages/Portfolio.jsx'
import FellowTravelers from './pages/FellowTravelers.jsx'
import Admin from './pages/Admin.jsx'

// Which roles see which page. The API enforces the same rules server-side.
const NAV = [
  { to: '/', label: 'Mission Control', icon: Rocket, roles: ['admin', 'user', 'guest'] },
  { to: '/revel-bucks', label: 'Revel Bucks', icon: Coins, roles: ['admin', 'user', 'guest'] },
  { to: '/weekly', label: 'Weekly Tracking', icon: Calendar, roles: ['user'] },
  { to: '/badges', label: 'Badge Catalog', icon: Award, roles: ['admin', 'user', 'guest'] },
  { to: '/portfolio', label: 'Hero Portfolio', icon: Trophy, roles: ['admin', 'user', 'guest'] },
  { to: '/travelers', label: 'Fellow Travelers', icon: Users, roles: ['admin', 'user', 'guest'] },
  { to: '/admin', label: 'Guide Console', icon: Settings, roles: ['admin'] },
]

const ROLE_LABEL = { admin: 'GUIDE / ADMIN', user: 'LEARNER', guest: 'GUEST' }

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>
  if (!user) return <Login />
  const allowed = NAV.filter((n) => n.roles.includes(user.role))
  const can = (path) => allowed.some((n) => n.to === path)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto px-4 md:px-8 py-6 gap-6">
        <aside className="w-full md:w-60 bg-white border border-slate-200 rounded-2xl p-4 h-fit shadow-xs shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Navigation</div>
          <nav className="space-y-1">
            {allowed.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 space-y-6 min-w-0">
          <Routes>
            <Route path="/" element={<MissionControl />} />
            <Route path="/revel-bucks" element={<RevelBucks />} />
            {can('/weekly') && <Route path="/weekly" element={<WeeklyTracking />} />}
            <Route path="/badges" element={<BadgeCatalog />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/portfolio/:userId" element={<Portfolio />} />
            <Route path="/travelers" element={<FellowTravelers />} />
            {can('/admin') && <Route path="/admin" element={<Admin />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-8 py-3 shadow-xs flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">R</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-900 text-base leading-none">REVEL JOURNEY TRACKER</h1>
            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
              {ROLE_LABEL[user.role]}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">{user.studio || 'Revel Academy'} Studio</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user.is_council && (
          <span className="hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-bold border items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300">
            <Shield className="w-3.5 h-3.5 text-amber-600" /> Council Member
          </span>
        )}
        {user.role === 'user' && (
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-900 text-xs font-bold">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{user.balance} Revel Bucks</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl text-orange-900 text-xs font-bold">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>{user.streak}d Streak</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-lg" title={user.display_name}>
            {user.avatar}
          </div>
          <span className="hidden md:block text-xs font-bold text-slate-700">{user.display_name}</span>
        </div>
        <button onClick={() => { logout(); navigate('/') }} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Log out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
