import { type ReactNode } from 'react';
import Header from './Header';
import AiGateModal from '../common/AiGateModal';
import { Link, useLocation } from 'react-router';
import { Brain, FlaskConical, ShieldCheck } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();

  // Top-level tabs for bottom nav
  const bottomNav = [
    { path: '/', pillar: 'coach', icon: Brain, label: 'Product Coach', activeColor: '#4A5FC1' },
    { path: '/product', pillar: 'product', icon: FlaskConical, label: 'Product Thinking', activeColor: '#7C3AED' },
    { path: '/transparency', pillar: 'transparency', icon: ShieldCheck, label: 'Self Evals', activeColor: '#0891B2' },
  ];

  const isTabActive = (pillar: string) => {
    if (pillar === 'product') return location.pathname === '/product';
    if (pillar === 'transparency') return location.pathname === '/transparency';
    if (pillar === 'coach') return location.pathname === '/';
    return false;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8F9FE', width: '100%' }}>
      <Header />
      <AiGateModal />
      <main style={{ flex: 1, width: '100%' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — three pillars */}
      <nav className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0.5rem' }}>
          {bottomNav.map(item => {
            const active = isTabActive(item.pillar);
            return (
              <Link
                key={item.pillar}
                to={item.path}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '0.125rem', padding: '0.5rem 0.75rem', borderRadius: '12px',
                  transition: 'all 0.2s', textDecoration: 'none',
                  color: active ? item.activeColor : '#9CA3AF',
                  backgroundColor: active ? `${item.activeColor}0D` : 'transparent',
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
