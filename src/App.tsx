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
import { Analytics } from '@vercel/analytics/react';

// Lazy-load admin pages so next-auth/react is code-split into a separate chunk
// and never bundled with the main app (keeps regular routes free of NextAuth).
const UsageDashboardPage = lazy(() => import('./pages/UsageDashboardPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
        <Routes>
          {/* ── Regular app routes — no auth involved ── */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/product" element={<ProductTastePage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/growth" element={<GrowthPage />} />
          <Route path="/account" element={<AccountPage />} />

          {/* ── Admin dashboard routes — lazy-loaded with SessionProvider inside each page ── */}
          <Route path="/auth/signin" element={<Suspense><SignInPage /></Suspense>} />
          <Route path="/unauthorized" element={<Suspense><UnauthorizedPage /></Suspense>} />
          <Route path="/dashboard" element={<Suspense><UsageDashboardPage /></Suspense>} />

          {/* Legacy redirects */}
          <Route path="/timeline" element={<Navigate to="/insights" replace />} />
          <Route path="/actions" element={<Navigate to="/growth" replace />} />
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
