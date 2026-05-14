import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

// TEMP: auth gate disabled in dev (`npm run dev`). Production builds keep
// the gate on. To force off in dev too, hard-code `false`.
const BYPASS_AUTH = import.meta.env.MODE === 'development';

// Gate that defers render until auth state is known. If the user is not
// signed in, redirect to the existing /auth/signin route, preserving the
// requested path as `?next=<path>` so post-login can return them here.

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { authReady, user } = useAuth();
  const location = useLocation();

  if (BYPASS_AUTH) return <>{children}</>;

  if (!authReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/signin?next=${next}`} replace />;
  }

  return <>{children}</>;
}
