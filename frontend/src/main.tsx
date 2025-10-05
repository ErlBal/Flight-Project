import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './global.css'
import './styles/tokens.css'
import App from './App'
import { Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminPanel from './pages/AdminPanel'

function useAuthMeta() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('auth_token')
      if (!raw) return { roles: [] as string[], email: null as string | null }
      const payload = JSON.parse(atob(raw.split('.')[1]))
      return { roles: payload.roles || [], email: payload.sub || null }
    } catch {
      return { roles: [], email: null as string | null }
    }
  }, [typeof window !== 'undefined' && localStorage.getItem('auth_token')])
}

const ProtectedRoute: React.FC<{ allow: (roles: string[]) => boolean; children: React.ReactElement }> = ({ allow, children }) => {
  const { roles, email } = useAuthMeta()
  if (!email) return <Navigate to="/login" replace />
  if (!allow(roles)) return <Navigate to="/" replace />
  return children
}
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'company', element: (
        <ProtectedRoute allow={(r)=> r.includes('company_manager') || r.includes('admin')}>
          <CompanyDashboard />
        </ProtectedRoute>
      ) },
      { path: 'admin', element: (
        <ProtectedRoute allow={(r)=> r.includes('admin')}>
          <AdminPanel />
        </ProtectedRoute>
      ) },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
