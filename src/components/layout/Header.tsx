import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, LogOut, Settings, BarChart3, TrendingUp, User } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

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

  // Top-level navigation tabs
  const pillarTabs = [
    { path: '/', label: '🧠 Product Coach', pillar: 'coach', activeColor: '#4A5FC1', activeBg: 'rgba(74,95,193,0.08)' },
    { path: '/product', label: '🧪 Product Thinking', pillar: 'product', activeColor: '#7C3AED', activeBg: 'rgba(124,58,237,0.08)' },
    { path: '/transparency', label: '🛡️ Self Evals', pillar: 'transparency', activeColor: '#0891B2', activeBg: 'rgba(8,145,178,0.08)' },
  ];

  // A tab is "active" based on current pathname
  const isTabActive = (pillar: string) => {
    if (pillar === 'transparency') return location.pathname === '/transparency';
    if (pillar === 'product') return location.pathname === '/product';
    if (pillar === 'coach') return location.pathname === '/';
    return false;
  };

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

          {/* Desktop pillar tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="hidden md:flex">
            {pillarTabs.map(tab => {
              const active = isTabActive(tab.pillar);
              return (
                <Link
                  key={tab.pillar}
                  to={tab.path}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '10px', fontSize: '0.875rem',
                    fontWeight: 500, transition: 'all 0.2s', textDecoration: 'none',
                    backgroundColor: active ? tab.activeBg : 'transparent',
                    color: active ? tab.activeColor : '#6B7280',
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
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

          {/* Hamburger menu — contains Growth, Insights, Account + account actions */}
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

                  {/* Mobile pillar links */}
                  <div className="md:hidden">
                    <div style={{ padding: '0.5rem 0.875rem 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pillars
                    </div>
                    {pillarTabs.map(tab => (
                      <Link
                        key={tab.pillar}
                        to={tab.path}
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.625rem',
                          padding: '0.625rem 0.875rem', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                          color: isTabActive(tab.pillar) ? tab.activeColor : '#374151',
                          backgroundColor: isTabActive(tab.pillar) ? tab.activeBg : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!isTabActive(tab.pillar)) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={(e) => { if (!isTabActive(tab.pillar)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {tab.label}
                      </Link>
                    ))}
                    <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0.375rem 0' }} />
                  </div>

                  {/* Growth & Insights */}
                  <div style={{ padding: '0.25rem 0.875rem 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    More
                  </div>
                  <Link
                    to="/growth"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.625rem 0.875rem', borderRadius: '8px',
                      fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                      color: location.pathname === '/growth' ? '#4A5FC1' : '#374151',
                      backgroundColor: location.pathname === '/growth' ? 'rgba(74,95,193,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (location.pathname !== '/growth') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { if (location.pathname !== '/growth') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <TrendingUp size={15} color="#6B7280" /> Growth
                  </Link>
                  <Link
                    to="/insights"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.625rem 0.875rem', borderRadius: '8px',
                      fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                      color: location.pathname === '/insights' ? '#4A5FC1' : '#374151',
                      backgroundColor: location.pathname === '/insights' ? 'rgba(74,95,193,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (location.pathname !== '/insights') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { if (location.pathname !== '/insights') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <BarChart3 size={15} color="#6B7280" /> Insights
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.625rem 0.875rem', borderRadius: '8px',
                      fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                      color: location.pathname === '/account' ? '#4A5FC1' : '#374151',
                      backgroundColor: location.pathname === '/account' ? 'rgba(74,95,193,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (location.pathname !== '/account') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { if (location.pathname !== '/account') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <User size={15} color="#6B7280" /> Account
                  </Link>
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
