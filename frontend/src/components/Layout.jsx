import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MENU, ROLE_LABELS } from '../roles'

export default function Layout() {
  const { user, logout } = useAuth()
  const menu = MENU[user?.role] ?? []

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-ink-900 text-stone-300">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-400 text-lg font-black text-ink-900">L</div>
          <div>
            <div className="text-sm font-bold tracking-[0.2em] text-gold-400">LAMBORGHINI</div>
            <div className="text-xs text-stone-500">ERP System</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-gold-400 text-ink-900' : 'hover:bg-ink-700 hover:text-white'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="border-t border-ink-700 px-6 py-4">
            <div className="text-sm font-semibold text-white">
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
            </div>
            <div className="text-xs text-gold-400">{ROLE_LABELS[user.role]}</div>
            <div className="text-xs text-stone-500">{user.branch_name ?? 'Barcha filiallar'}</div>
            <button onClick={logout} className="mt-3 text-xs font-medium text-stone-400 hover:text-white">
              Chiqish →
            </button>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
