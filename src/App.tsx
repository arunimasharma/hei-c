import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
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

// Lazy-load admin pages so next-auth/react is code-split into a separate chunk
// and never bundled with the main app (keeps regular routes free of NextAuth).
const UsageDashboardPage  = lazy(() => import('./pages/UsageDashboardPage'));
const SignInPage          = lazy(() => import('./pages/SignInPage'));
const UnauthorizedPage    = lazy(() => import('./pages/UnauthorizedPage'));
// Public profile page — no auth required, minimal bundle
const PublicProfilePage   = lazy(() => import('./pages/PublicProfilePage'));
// Idea Validator — lazy so it only loads when accessed.
const ValidatorIndexPage   = lazy(() => import('./pages/ValidatorIndexPage'));
const ValidatorNewPage     = lazy(() => import('./pages/ValidatorNewPage'));
const ValidatorSessionPage = lazy(() => import('./pages/ValidatorSessionPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
        <Routes>
          {/* ── App routes — no sign-in required ── */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/product" element={<ProductTastePage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/growth" element={<GrowthPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/transparency" element={<TransparencyHubPage />} />
          <Route path="/influence" element={<InfluencePage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/actions" element={<ActionsPage />} />

          {/* ── Idea Validator (no auth required) ── */}
          <Route path="/validator"             element={<Suspense fallback={null}><ValidatorIndexPage /></Suspense>} />
          <Route path="/validator/new"         element={<Suspense fallback={null}><ValidatorNewPage /></Suspense>} />
          <Route path="/validator/:sessionId"  element={<Suspense fallback={null}><ValidatorSessionPage /></Suspense>} />

          {/* ── Public profile (no auth required) ── */}
          <Route path="/p/:slug" element={<Suspense fallback={null}><PublicProfilePage /></Suspense>} />

          {/* ── Auth + admin routes ── */}
          <Route path="/auth/signin" element={<Suspense fallback={null}><SignInPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense fallback={null}><UnauthorizedPage /></Suspense>} />
          <Route path="/dashboard" element={<Suspense fallback={null}><UsageDashboardPage /></Suspense>} />

          {/* Legacy redirects */}
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/goals" element={<Navigate to="/growth" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/add-emotion" element={<Navigate to="/" replace />} />
          <Route path="/add-event" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>

  );
}
