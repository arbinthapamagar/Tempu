import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, canSeeDashboard, homePath } from './store/authStore'
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
import TicketList from './pages/support/TicketList'
import TicketDetail from './pages/support/TicketDetail'
import EmergencyList from './pages/emergencies/EmergencyList'
import SupplierList from './pages/suppliers/SupplierList'
import AdminList from './pages/admins/AdminList'
import Analytics from './pages/analytics/Analytics'
import Notifications from './pages/notifications/Notifications'

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
        <Route path="support" element={<TicketList />} />
        <Route path="support/:id" element={<TicketDetail />} />
        <Route path="emergencies" element={<EmergencyList />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="admins" element={<AdminList />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
