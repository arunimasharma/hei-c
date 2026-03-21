import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, LogOut, Settings, BarChart3, TrendingUp, User, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import FlowJourney from '../common/FlowJourney';

export default function Header() {
  const { state, logout } = useApp();
  const { user: authUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/onboarding');
  };

  return (
    <header style={{
      backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid #F3F4F6', width: '100%',
    }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo.svg" alt="Hello-EQ" style={{ width: '36px', height: '36px' }} />
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#4A5FC1', letterSpacing: '-0.01em' }}>Hello-EQ</span>
          </Link>

          {/* Desktop — FlowJourney as primary nav */}
          <nav className="hidden md:flex" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FlowJourney variant="nav" />
            <a
              href="https://forms.gle/qZAfUaUeYH4FNJnQ9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.5rem 0.875rem', borderRadius: '10px', fontSize: '0.875rem',
                fontWeight: 600, transition: 'all 0.2s', textDecoration: 'none',
                backgroundColor: '#4A5FC1', color: '#FFFFFF', marginLeft: '0.5rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3A4FA1')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4A5FC1')}
            >
              Join HEQ Club!
            </a>
          </nav>

          {/* Hamburger menu */}
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

            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)',
                backgroundColor: 'white', borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1px solid #F3F4F6',
                minWidth: '200px', overflow: 'hidden', zIndex: 100,
              }}>
                <div style={{ padding: '0.5rem' }}>

                  {/* Mobile: full journey nav */}
                  <div className="md:hidden">
                    <div style={{ padding: '0.5rem 0.875rem 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Your Journey
                    </div>
                    {[
                      { path: '/',          label: '🧠 Coach',     active: location.pathname === '/' },
                      { path: '/signals',   label: '📡 Signals',   active: location.pathname === '/signals' },
                      { path: '/product',   label: '🧪 Product',   active: location.pathname === '/product' },
                      { path: '/influence', label: '⚡ Influence',  active: location.pathname === '/influence' },
                      { path: '/actions',   label: '💡 Actions',   active: location.pathname === '/actions' },
                    ].map(item => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.625rem',
                          padding: '0.625rem 0.875rem', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: item.active ? 600 : 500,
                          textDecoration: 'none',
                          color: item.active ? '#1F2937' : '#374151',
                          backgroundColor: item.active ? 'rgba(0,0,0,0.04)' : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0.375rem 0' }} />
                  </div>

                  {/* More section */}
                  <div style={{ padding: '0.25rem 0.875rem 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    More
                  </div>
                  {[
                    { path: '/growth',   label: 'Growth',   icon: <TrendingUp size={15} color="#6B7280" /> },
                    { path: '/insights', label: 'Insights', icon: <BarChart3 size={15} color="#6B7280" /> },
                    { path: '/account',  label: 'Account',  icon: <User size={15} color="#6B7280" /> },
                  ].map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.625rem 0.875rem', borderRadius: '8px',
                        fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                        color: location.pathname === item.path ? '#4A5FC1' : '#374151',
                        backgroundColor: location.pathname === item.path ? 'rgba(74,95,193,0.08)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (location.pathname !== item.path) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                      onMouseLeave={(e) => { if (location.pathname !== item.path) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}

                  {/* Sign in CTA for unauthenticated users */}
                  {!authUser && (
                    <>
                      <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0.375rem 0' }} />
                      <Link
                        to="/auth/signin"
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.625rem',
                          padding: '0.625rem 0.875rem', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                          color: '#4A5FC1',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(74,95,193,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <LogIn size={15} color="#4A5FC1" /> Sign In
                      </Link>
                    </>
                  )}

                  {/* Account actions */}
                  {state.user && (
                    <>
                      <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0.375rem 0' }} />
                      {state.user.name !== 'Friend' && (
                        <div style={{ padding: '0.25rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {state.user.name}
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
                      {(state.user?.onboardingComplete || authUser) && (
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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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
