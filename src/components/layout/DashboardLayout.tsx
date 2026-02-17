import { type ReactNode } from 'react';
import Header from './Header';
import { Link, useLocation } from 'react-router';
import { Home, PlusCircle, Calendar, Zap, Settings } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();

  const bottomNav = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/add-emotion', icon: PlusCircle, label: 'Log' },
    { path: '/timeline', icon: Calendar, label: 'Timeline' },
    { path: '/actions', icon: Zap, label: 'Actions' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8F9FE', width: '100%' }}>
      <Header />
      <main style={{ flex: 1, width: '100%' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0.5rem' }}>
          {bottomNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '0.125rem', padding: '0.5rem 0.75rem', borderRadius: '12px',
                  transition: 'all 0.2s', textDecoration: 'none',
                  color: active ? '#4A5FC1' : '#9CA3AF',
                  backgroundColor: active ? 'rgba(74,95,193,0.06)' : 'transparent',
                }}
              >
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
