import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Landing from './pages/Landing'
import Search from './pages/Search'
import Dashboard from './pages/Dashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'search', element: <Search /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'company', element: <CompanyDashboard /> },
      { path: 'admin', element: <AdminPanel /> },
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
