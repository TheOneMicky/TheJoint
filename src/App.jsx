import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContextProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import InviteListener from './components/InviteListener'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import WorkoutDashboard from './pages/WorkoutDashboard'
import WorkoutTracker from './pages/WorkoutTracker'
import SessionLobby from './pages/SessionLobby'
import UserMatching from './pages/UserMatching'
import CreateTemplate from './pages/CreateTemplate'
import Profile from './pages/Profile'
import DatabaseInspector from './components/DatabaseInspector'

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [])
  return (
    <ThemeProvider>
      <AuthContextProvider>
        <Router>
          <InviteListener />
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <WorkoutDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/new"
            element={
              <ProtectedRoute>
                <WorkoutTracker />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/session/:sessionId"
            element={
              <ProtectedRoute>
                <WorkoutTracker />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/session/:sessionId/lobby"
            element={
              <ProtectedRoute>
                <SessionLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/matches"
            element={
              <ProtectedRoute>
                <UserMatching />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-template"
            element={
              <ProtectedRoute>
                <CreateTemplate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/inspect" element={<DatabaseInspector />} />
        </Routes>
      </Router>
      </AuthContextProvider>
    </ThemeProvider>
  )
}

export default App
