import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider, useSession, ROLE_HOME } from './store/session'
import { ToastProvider } from './components/ui'
import Shell from './components/layout/Shell'
import Login from './pages/Login'
import Cockpit from './pages/cockpit/Cockpit'
import Ledger from './pages/projects/Ledger'
import ProjectDetail from './pages/projects/Detail'
import Approvals from './pages/approvals/Approvals'
import Alerts from './pages/alerts/Alerts'
import Evaluations from './pages/evaluation/Evaluations'
import Transformations from './pages/transformations/Transformations'
import TransitionTool from './pages/transition/TransitionTool'
import Workbench from './pages/team/Workbench'
import Declare from './pages/team/Declare'
import Milestones from './pages/team/Milestones'
import Plans from './pages/team/Plans'
import Changes from './pages/team/Changes'
import Assessments from './pages/team/Assessments'
import Review from './pages/review/Review'
import Finance from './pages/finance/Finance'
import Funding from './pages/finance/Funding'
import Admin from './pages/admin/Admin'

function Guarded() {
  const { user, boot } = useSession()
  if (!boot) return <div className="h-full flex items-center justify-center text-faint text-sm">正在连接平台…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Shell />
}

function HomeRedirect() {
  const { user, boot } = useSession()
  if (!boot) return null
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Guarded />}>
              <Route path="/cockpit" element={<Cockpit />} />
              <Route path="/projects" element={<Ledger />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/evaluations" element={<Evaluations tab="collab" />} />
              <Route path="/post-evals" element={<Navigate to="/evaluations" replace />} />
              <Route path="/transformations" element={<Transformations />} />
              <Route path="/transition-tool" element={<TransitionTool />} />
              <Route path="/workbench" element={<Workbench />} />
              <Route path="/declare" element={<Declare />} />
              <Route path="/milestones" element={<Milestones />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/changes" element={<Changes />} />
              <Route path="/assessments" element={<Assessments />} />
              <Route path="/review" element={<Review />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/funding" element={<Funding />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  )
}
