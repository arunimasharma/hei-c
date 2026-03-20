import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { useFrictionFeedback } from './hooks/useFrictionFeedback';
import FrictionFeedbackWidget from './components/common/FrictionFeedbackWidget';
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
const UsageDashboardPage = lazy(() => import('./pages/UsageDashboardPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));

function FrictionLayer() {
  const friction = useFrictionFeedback();
  return <FrictionFeedbackWidget {...friction} />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;
  const isGuest = sessionStorage.getItem('heq_guest_session') === 'true';
  if (!user && !isGuest) return <Navigate to="/auth/signin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
        <Routes>
          {/* ── Protected app routes — require sign-in ── */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/product" element={<ProtectedRoute><ProductTastePage /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
          <Route path="/growth" element={<ProtectedRoute><GrowthPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/transparency" element={<ProtectedRoute><TransparencyHubPage /></ProtectedRoute>} />

          {/* ── Auth + admin routes — public ── */}
          <Route path="/auth/signin" element={<Suspense fallback={null}><SignInPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense fallback={null}><UnauthorizedPage /></Suspense>} />
          <Route path="/dashboard" element={<Suspense fallback={null}><UsageDashboardPage /></Suspense>} />

          <Route path="/influence" element={<ProtectedRoute><InfluencePage /></ProtectedRoute>} />
          <Route path="/signals" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
          <Route path="/actions" element={<ProtectedRoute><ActionsPage /></ProtectedRoute>} />

          {/* Legacy redirects */}
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/goals" element={<Navigate to="/growth" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/add-emotion" element={<Navigate to="/" replace />} />
          <Route path="/add-event" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <FrictionLayer />
      </AppProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>

  );
}
