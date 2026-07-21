import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, canSeeDashboard, homePath } from './store/authStore'
import { authApi } from './api/auth.api'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import UserList from './pages/users/UserList'
import DriverList from './pages/drivers/DriverList'
import DriverDetail from './pages/drivers/DriverDetail'
import TripList from './pages/trips/TripList'
import TripDetail from './pages/trips/TripDetail'
import SubscriptionList from './pages/subscriptions/SubscriptionList'
import TransactionList from './pages/transactions/TransactionList'
import WithdrawalList from './pages/withdrawals/WithdrawalList'
import PricingControl from './pages/pricing/PricingControl'
import DocumentQueue from './pages/documents/DocumentQueue'
import SupportInbox, { EmptyConversation } from './pages/support/SupportInbox'
import TicketChat from './pages/support/TicketChat'
import EmergencyList from './pages/emergencies/EmergencyList'
import SupplierList from './pages/suppliers/SupplierList'
import AdminList from './pages/admins/AdminList'
import Analytics from './pages/analytics/Analytics'
import Notifications from './pages/notifications/Notifications'
import KnowledgeBase from './pages/knowledge/KnowledgeBase'
import Ai from './pages/ai/Ai'
import ApiLogs from './pages/apiLogs/ApiLogs'
import MapSettings from './pages/settings/MapSettings'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Send each admin to their landing page (dashboard, or support for roles without it).
function HomeRedirect() {
  const { admin } = useAuthStore()
  return <Navigate to={homePath(admin)} replace />
}

// Dashboard is restricted to superadmin/admin.
function RequireDashboard({ children }) {
  const { admin } = useAuthStore()
  return canSeeDashboard(admin) ? children : <Navigate to={homePath(admin)} replace />
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const updateAdmin = useAuthStore((s) => s.updateAdmin)

  // Re-sync the logged-in admin (name, avatar, role AND permissions) on load.
  // Permissions can change server-side after login - e.g. a superadmin grants a
  // moderator more access - so without this the UI would keep showing stale,
  // login-time permissions until a full re-login.
  useEffect(() => {
    if (!isAuthenticated) return
    authApi.me()
      .then((res) => {
        const fresh = res?.data
        // Guard against a race: if the user logged out while this request was
        // in flight, don't resurrect the admin identity in the persisted store.
        if (fresh && useAuthStore.getState().isAuthenticated) updateAdmin(fresh)
      })
      .catch(() => { /* interceptor handles auth/session failures */ })
  }, [isAuthenticated, updateAdmin])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<RequireDashboard><Dashboard /></RequireDashboard>} />
        <Route path="profile" element={<Profile />} />
        <Route path="users" element={<UserList />} />
        <Route path="drivers" element={<DriverList />} />
        <Route path="drivers/:id" element={<DriverDetail />} />
        <Route path="trips" element={<TripList />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="subscriptions" element={<SubscriptionList />} />
        <Route path="transactions" element={<TransactionList />} />
        <Route path="withdrawals" element={<WithdrawalList />} />
        <Route path="pricing" element={<PricingControl />} />
        <Route path="documents" element={<DocumentQueue />} />
        <Route path="support" element={<SupportInbox />}>
          <Route index element={<EmptyConversation />} />
          <Route path=":id" element={<TicketChat />} />
        </Route>
        <Route path="emergencies" element={<EmergencyList />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="admins" element={<AdminList />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="rag" element={<KnowledgeBase />} />
        <Route path="agentic" element={<Ai />} />
        <Route path="api-logs" element={<ApiLogs />} />
        <Route path="map-settings" element={<MapSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
