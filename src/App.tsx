import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { PassProvider } from './context/PassContext';
import RequireAuth from './components/common/RequireAuth';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import InsightsPage from './pages/InsightsPage';
import GrowthPage from './pages/GrowthPage';
import AccountPage from './pages/AccountPage';
import ProductTastePage from './pages/ProductTastePage';
import TransparencyHubPage from './pages/TransparencyHubPage';
import InfluencePage from './pages/InfluencePage';
import SignalsPage from './pages/SignalsPage';
import ActionsPage from './pages/ActionsPage';
import { Analytics } from '@vercel/analytics/react';

const UsageDashboardPage  = lazy(() => import('./pages/UsageDashboardPage'));
const SignInPage          = lazy(() => import('./pages/SignInPage'));
const UnauthorizedPage    = lazy(() => import('./pages/UnauthorizedPage'));
const PublicProfilePage   = lazy(() => import('./pages/PublicProfilePage'));
const ValidatorIndexPage   = lazy(() => import('./pages/ValidatorIndexPage'));
const ValidatorNewPage     = lazy(() => import('./pages/ValidatorNewPage'));
const ValidatorSessionPage = lazy(() => import('./pages/ValidatorSessionPage'));
const AdminPage            = lazy(() => import('./pages/AdminPage'));
// Drilloop — creator-led subscription learning membership (member + creator tabs).
const DrilloopMemberPage   = lazy(() => import('./pages/DrilloopMemberPage'));
const DrilloopCreatorPage  = lazy(() => import('./pages/DrilloopCreatorPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
      <PassProvider>
        <Routes>
          {/* ── Public routes — no auth required ── */}
          <Route path="/auth/signin" element={<Suspense fallback={null}><SignInPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense fallback={null}><UnauthorizedPage /></Suspense>} />
          <Route path="/p/:slug" element={<Suspense fallback={null}><PublicProfilePage /></Suspense>} />

          {/* ── Protected routes — auth required ── */}
          <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/product" element={<RequireAuth><ProductTastePage /></RequireAuth>} />
          <Route path="/insights" element={<RequireAuth><InsightsPage /></RequireAuth>} />
          <Route path="/growth" element={<RequireAuth><GrowthPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/transparency" element={<RequireAuth><TransparencyHubPage /></RequireAuth>} />
          <Route path="/influence" element={<RequireAuth><InfluencePage /></RequireAuth>} />
          <Route path="/signals" element={<RequireAuth><SignalsPage /></RequireAuth>} />
          <Route path="/actions" element={<RequireAuth><ActionsPage /></RequireAuth>} />

          {/* ── Idea Validator (auth required) ── */}
          <Route path="/validator" element={<RequireAuth><Suspense fallback={null}><ValidatorIndexPage /></Suspense></RequireAuth>} />
          <Route path="/validator/new" element={<RequireAuth><Suspense fallback={null}><ValidatorNewPage /></Suspense></RequireAuth>} />
          <Route path="/validator/:sessionId" element={<RequireAuth><Suspense fallback={null}><ValidatorSessionPage /></Suspense></RequireAuth>} />

          {/* ── Drilloop (auth required) ── */}
          <Route path="/drilloop" element={<RequireAuth><Suspense fallback={null}><DrilloopMemberPage /></Suspense></RequireAuth>} />
          <Route path="/drilloop/creator" element={<RequireAuth><Suspense fallback={null}><DrilloopCreatorPage /></Suspense></RequireAuth>} />

          {/* ── Admin (auth + admin email required) ── */}
          <Route path="/admin" element={<RequireAuth><Suspense fallback={null}><AdminPage /></Suspense></RequireAuth>} />

          {/* ── Usage dashboard ── */}
          <Route path="/dashboard" element={<RequireAuth><Suspense fallback={null}><UsageDashboardPage /></Suspense></RequireAuth>} />

          {/* Legacy redirects */}
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/goals" element={<Navigate to="/growth" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/add-emotion" element={<Navigate to="/" replace />} />
          <Route path="/add-event" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PassProvider>
      </AppProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}
