import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import InsightsPage from './pages/InsightsPage';
import GrowthPage from './pages/GrowthPage';
import AccountPage from './pages/AccountPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/growth" element={<GrowthPage />} />
      <Route path="/account" element={<AccountPage />} />
      {/* Legacy routes - redirect to new consolidated routes */}
      <Route path="/dashboard" element={<Navigate to="/insights" replace />} />
      <Route path="/timeline" element={<Navigate to="/insights" replace />} />
      <Route path="/actions" element={<Navigate to="/growth" replace />} />
      <Route path="/goals" element={<Navigate to="/growth" replace />} />
      <Route path="/profile" element={<Navigate to="/account" replace />} />
      <Route path="/settings" element={<Navigate to="/account" replace />} />
      <Route path="/add-emotion" element={<Navigate to="/" replace />} />
      <Route path="/add-event" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
