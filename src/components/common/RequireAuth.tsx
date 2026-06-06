import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) return null;

  if (!user) {
    return <Navigate to={`/auth/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
