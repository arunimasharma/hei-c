import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Header() {
  const { state, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/onboarding');
  };

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
            <img src="/logo.svg" alt="Hello-EQ" style={{ width: '36px', height: '36px' }} />
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#4A5FC1', letterSpacing: '-0.01em' }}>Hello-EQ</span>
          </Link>

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
            <a
              href="https://forms.gle/qZAfUaUeYH4FNJnQ9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.5rem 0.875rem', borderRadius: '10px', fontSize: '0.875rem',
                fontWeight: 600, transition: 'all 0.2s', textDecoration: 'none',
                backgroundColor: '#4A5FC1', color: '#FFFFFF', marginLeft: '0.25rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3A4FA1')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4A5FC1')}
            >
              Join HEQ Club!
            </a>
          </nav>

          {/* Right side: always-visible menu button */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                padding: '0.5rem', borderRadius: '10px', border: 'none',
                backgroundColor: menuOpen ? 'rgba(74,95,193,0.08)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                color: menuOpen ? '#4A5FC1' : '#6B7280',
              }}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)',
                backgroundColor: 'white', borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1px solid #F3F4F6',
                minWidth: '200px', overflow: 'hidden', zIndex: 100,
              }}>
                {/* Mobile-only nav items */}
                <div className="md:hidden" style={{ padding: '0.5rem', borderBottom: '1px solid #F3F4F6' }}>
                  {navItems.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'block', padding: '0.625rem 0.875rem', borderRadius: '8px',
                        fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                        backgroundColor: isActive(item.path) ? 'rgba(74,95,193,0.08)' : 'transparent',
                        color: isActive(item.path) ? '#4A5FC1' : '#374151',
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Setup + account actions */}
                <div style={{ padding: '0.5rem' }}>
                  {state.user && (
                    <div style={{
                      padding: '0.5rem 0.875rem 0.375rem',
                      fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {state.user.name !== 'Friend' ? state.user.name : 'Account'}
                    </div>
                  )}
                  <Link
                    to="/onboarding"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.625rem 0.875rem', borderRadius: '8px',
                      fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                      color: '#374151',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Settings size={15} color="#6B7280" /> Setup Profile
                  </Link>
                  {state.user?.onboardingComplete && (
                    <button
                      onClick={() => { handleLogout(); setMenuOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.625rem 0.875rem', borderRadius: '8px',
                        fontSize: '0.875rem', fontWeight: 500, border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer',
                        color: '#DC2626', width: '100%', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Click-outside overlay */}
        {menuOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </div>

    </header>
  );
}
