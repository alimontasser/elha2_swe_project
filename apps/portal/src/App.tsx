import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HOME_FOR_ROLE } from './domain/roles'
import type { Role } from './domain/types'
import { AdminOrgDetail } from './pages/AdminOrgDetail'
import { AdminQueue } from './pages/AdminQueue'
import { Notifications } from './pages/Notifications'
import { OrgDashboard } from './pages/OrgDashboard'
import { RegisterBusiness } from './pages/RegisterBusiness'
import { RegisterNgo } from './pages/RegisterNgo'
import { SignIn } from './pages/SignIn'
import { ComingSoon, TodaysOrders } from './pages/TodaysOrders'
import { SessionProvider, useSession } from './state/session'

// Role-based routes (NFR-10): each role only reaches its own area of the portal.
function RequireRole({ roles, children }: { roles: Role[]; children: ReactElement }) {
  const { session } = useSession()
  if (!session) return <Navigate to="/signin" replace />
  if (!roles.includes(session.role)) return <Navigate to={HOME_FOR_ROLE[session.role]} replace />
  return children
}

function AppRoutes() {
  const { t } = useTranslation()
  const { session } = useSession()
  const org: Role[] = ['businessOwner', 'ngoCoordinator']
  return (
    <Routes>
      <Route path="/signin" element={session ? <Navigate to={HOME_FOR_ROLE[session.role]} replace /> : <SignIn />} />
      <Route element={session ? <Layout /> : <Navigate to="/signin" replace />}>
        <Route path="/organisation" element={<RequireRole roles={org}><OrgDashboard /></RequireRole>} />
        <Route path="/register/business" element={<RequireRole roles={['businessOwner']}><RegisterBusiness /></RequireRole>} />
        <Route path="/register/ngo" element={<RequireRole roles={['ngoCoordinator']}><RegisterNgo /></RequireRole>} />
        <Route path="/orders" element={<RequireRole roles={['businessOwner']}><TodaysOrders /></RequireRole>} />
        <Route path="/listings" element={<RequireRole roles={['businessOwner']}><ComingSoon sprint={2} title={t('nav.listings')} /></RequireRole>} />
        <Route path="/offers" element={<RequireRole roles={['ngoCoordinator']}><ComingSoon sprint={3} title={t('nav.offers')} /></RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={['admin']}><AdminQueue /></RequireRole>} />
        <Route path="/admin/organisations/:id" element={<RequireRole roles={['admin']}><AdminOrgDetail /></RequireRole>} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? HOME_FOR_ROLE[session.role] : '/signin'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </SessionProvider>
  )
}
