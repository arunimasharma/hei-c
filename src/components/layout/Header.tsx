import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Header() {
  const { state } = useApp();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/insights', label: 'Insights' },
    { path: '/growth', label: 'Growth' },
    { path: '/account', label: 'Account' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header style={{
      backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid #F3F4F6', width: '100%',
    }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo.svg" alt="HEI-C" style={{ width: '36px', height: '36px' }} />
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#4A5FC1', letterSpacing: '-0.01em' }}>HEI-C</span>
          </Link>

          {state.user && (
            <>
              {/* Desktop nav */}
              <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="hidden md:flex">
                {navItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      padding: '0.5rem 0.875rem', borderRadius: '10px', fontSize: '0.875rem',
                      fontWeight: 500, transition: 'all 0.2s', textDecoration: 'none',
                      backgroundColor: isActive(item.path) ? 'rgba(74,95,193,0.08)' : 'transparent',
                      color: isActive(item.path) ? '#4A5FC1' : '#6B7280',
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Desktop user */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }} className="hidden md:flex">
                <div style={{
                  width: '32px', height: '32px', backgroundColor: 'rgba(74,95,193,0.1)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4A5FC1' }}>
                    {state.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280' }}>
                  {state.user.name}
                </span>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden"
                style={{
                  padding: '0.5rem', borderRadius: '10px', border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                }}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={22} color="#1F2937" /> : <Menu size={22} color="#1F2937" />}
              </button>
            </>
          )}
        </div>

        {/* Mobile nav */}
        {mobileOpen && state.user && (
          <nav className="md:hidden" style={{ padding: '0.75rem 0', borderTop: '1px solid #F3F4F6' }}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'block', padding: '0.75rem 1rem', borderRadius: '10px',
                  fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                  marginBottom: '0.25rem', transition: 'all 0.2s',
                  backgroundColor: isActive(item.path) ? 'rgba(74,95,193,0.08)' : 'transparent',
                  color: isActive(item.path) ? '#4A5FC1' : '#6B7280',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
