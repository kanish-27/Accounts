import React, { useState, useEffect } from 'react';
import { Wine, Users, Gamepad2, Utensils, ShieldAlert, Clock, ChevronRight, Sun, Moon, Snowflake, Home } from 'lucide-react';

export default function LandingPage({ 
  onLogin, 
  password, 
  setPassword, 
  toast, 
  theme, 
  toggleTheme, 
  isClubOpen 
}) {
  const [showLogin, setShowLogin] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-dark)', transition: 'var(--transition-normal)' }}>
      
      {/* Navbar */}
      <nav className="landing-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Wine size={28} color="var(--accent-gold-glow)" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.4))' }} />
          <div>
            <span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
              UDUMALAI COSMO
            </span>
            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-gold-glow)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Recreation Club
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button 
            onClick={() => setShowLogin(true)} 
            className="btn btn-primary btn-sm"
          >
            Admin Portal
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-wrapper">
        <div className="hero-grid-bg"></div>
        <div className="hero-container">
          <div className="hero-left">
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: isClubOpen() ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', 
              color: isClubOpen() ? 'var(--accent-green)' : 'var(--accent-crimson)', 
              border: `1px solid ${isClubOpen() ? 'var(--accent-green-border)' : 'var(--accent-crimson-border)'}`,
              padding: '0.4rem 1rem', 
              borderRadius: '20px', 
              fontWeight: 600, 
              fontSize: '0.75rem',
              marginBottom: '1.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <Clock size={12} />
              {isClubOpen() ? 'Club is Active (Open Now)' : 'Club is Closed (11 AM - 11 PM)'}
            </div>

            <h1 style={{ 
              fontFamily: 'Montserrat', 
              fontSize: '3rem', 
              fontWeight: 800, 
              maxWidth: '800px', 
              lineHeight: '1.2', 
              letterSpacing: '-1px',
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Elite Social Lounge & Licensed Club Recreation
            </h1>
            
            <p style={{ 
              fontSize: '1.1rem', 
              color: 'var(--text-secondary)', 
              maxWidth: '600px', 
              lineHeight: '1.6',
              marginBottom: '2.5rem'
            }}>
              Welcome to Udumalai Cosmo Recreation Club. Experience licensed FL2 bar service, premium cards and recreation suites, and custom dining features for members.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => setShowLogin(true)} className="btn btn-primary">
                Access Staff Console <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
              </button>
              <a href="#amenities" className="btn btn-secondary" style={{ border: '1px solid var(--border-color)' }}>
                Explore Club Amenities
              </a>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-status-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold-glow)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Live Club Desk
                </span>
                <span className={`badge ${isClubOpen() ? 'badge-present' : 'badge-active'}`} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                  {isClubOpen() ? '● Live' : '● Offline'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current Local Time</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                  {time}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold-glow)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Licence:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>FL2 Bar Licensed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Facilities:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AC & Kudil Cabin Bars</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                  <a href="https://maps.app.goo.gl/jCz8pXZwxWBWqq2VA" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--accent-gold-glow)', textDecoration: 'none' }}>
                    Udumalpet, TN ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Amenities Section */}
      <section id="amenities" style={{ padding: '5rem 2.5rem', background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Exclusive Member Facilities
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Curated offerings designed for premier recreation and corporate relaxation.
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.5rem', 
          maxWidth: '1200px', 
          margin: '0 auto' 
        }}>
          <div className="card blue-header" style={{ padding: '2rem' }}>
            <div style={{ color: 'var(--accent-blue)', marginBottom: '1.25rem' }}>
              <Snowflake size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>AC Bar Lounge</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Premium fully air-conditioned bar lounge providing a luxurious ambiance, elite spirits, and comfortable seating.
            </p>
          </div>

          <div className="card gold-header" style={{ padding: '2rem' }}>
            <div style={{ color: 'var(--accent-gold-glow)', marginBottom: '1.25rem' }}>
              <Wine size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Normal Bar</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Casual and lively standard bar counters offering swift service, local favorites, and a classic club bar experience.
            </p>
          </div>

          <div className="card gold-header" style={{ padding: '2rem' }}>
            <div style={{ color: 'var(--accent-gold-glow)', marginBottom: '1.25rem' }}>
              <Home size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>KUDIL Cabin Bar</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Relaxing outdoor cabin huts (Kudils) providing a comfortable, traditional setting for private groups and families.
            </p>
          </div>

          <div className="card green-header" style={{ padding: '2rem' }}>
            <div style={{ color: 'var(--accent-green)', marginBottom: '1.25rem' }}>
              <Utensils size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Foods & Side Dishes</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Extensive multicuisine menu featuring delicious meals, bites, and a wide array of premium side dishes prepared fresh.
            </p>
          </div>
        </div>
      </section>

      {/* Contact & Location Section */}
      <section style={{ 
        padding: '4rem 2.5rem', 
        borderTop: '1px solid var(--border-color)', 
        background: 'rgba(255, 255, 255, 0.01)',
        textAlign: 'center' 
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.85rem', fontWeight: 700, marginBottom: '1rem' }}>
            Location & Directions
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
            Udumalai Cosmo Recreation Club is located on Kalpana Road, Udumalpet. Click below to view the location and navigate using Google Maps.
          </p>
          
          <div style={{ 
            display: 'inline-flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            padding: '2rem', 
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📍</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Club Address</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              <strong>Udumalai Cosmo Recreation Club</strong><br />
              Kalpana Road, Udumalpet - 642126<br />
              Tiruppur District, Tamil Nadu
            </p>
            <a 
              href="https://maps.app.goo.gl/jCz8pXZwxWBWqq2VA" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}
            >
              Navigate via Google Maps ↗
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        padding: '2.5rem', 
        borderTop: '1px solid var(--border-color)', 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)',
        background: 'rgba(0, 0, 0, 0.05)'
      }}>
        <div>© 2026 Udumalai Cosmo Recreation Club. All rights reserved.</div>
        <div style={{ marginTop: '0.25rem' }}>FL2 Licensed Club Lounge Bar • Timings: 11:00 AM to 11:00 PM</div>
        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          📍 <a href="https://maps.app.goo.gl/jCz8pXZwxWBWqq2VA" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold-glow)', textDecoration: 'none', fontWeight: 600 }}>Kalpana Road, Udumalpet - 642126, Tamil Nadu</a>
        </div>
      </footer>

      {/* Login Modal Overlay */}
      {showLogin && (
        <div className="modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.85)' }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '2.5rem' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--accent-gold-bg)', borderRadius: '50%', marginBottom: '1rem' }}>
                <Wine size={32} color="var(--accent-gold-glow)" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.5))' }} />
              </div>
              <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Udumalai Cosmo
              </h2>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-gold-glow)', letterSpacing: '1px', marginTop: '0.25rem' }}>
                Admin Portal Lock
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Please verify credentials to access database ledgers.
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              onLogin(e);
            }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  Admin Password
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password..."
                  className="form-control"
                  style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '2px' }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowLogin(false);
                    setPassword('');
                  }} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 2 }}
                >
                  Unlock Portal
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Global Toast Alert inside landing screen */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : 'success'}`} style={{ zIndex: 1100 }}>
          {toast.type === 'error' ? <ShieldAlert size={18} color="var(--accent-crimson)" /> : <Clock size={18} color="var(--accent-green)" />}
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
