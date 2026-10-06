import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import { canAccess, homePath } from './roles'
import Login from './pages/Login'
import Analytics from './pages/top/Analytics'
import Branches from './pages/top/Branches'
import Staff from './pages/top/Staff'
import Orders from './pages/Orders'
import Inventory from './pages/warehouse/Inventory'
import SalesKanban from './pages/sales/SalesKanban'
import CarCatalog from './pages/sales/CarCatalog'
import ServiceBoard from './pages/service/ServiceBoard'

/** Auth Guard: token bo'lmasa — login, rolga ruxsat bo'lmasa — bosh sahifa. */
function Guard({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-10"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!canAccess(user.role, location.pathname)) return <Navigate to={homePath(user.role)} replace />
  return children
}

const PAGES = {
  '/analytics': <Analytics />,
  '/branches': <Branches />,
  '/staff': <Staff />,
  '/inventory': <Inventory />,
  '/orders': <Orders />,
  '/sales': <SalesKanban />,
  '/catalog': <CarCatalog />,
  '/service': <ServiceBoard />,
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        {Object.entries(PAGES).map(([path, element]) => (
          <Route key={path} path={path} element={<Guard>{element}</Guard>} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to={user ? homePath(user.role) : '/login'} replace />} />
    </Routes>
  )
}
