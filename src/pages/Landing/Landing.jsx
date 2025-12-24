import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './landing.scss';
import EventPreview from './EventPreview';

const Landing = () => {
  const [counters, setCounters] = useState({ events: 0, attendees: 0, organizers: 0 });

  // --- NEW: reduced motion toggle ---
  const [reducedMotion, setReducedMotion] = useState(() => {
    try {
      const saved = localStorage.getItem('hf:reducedMotion');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    try { localStorage.setItem('hf:reducedMotion', reducedMotion ? 'true' : 'false'); } catch (e) {}
  }, [reducedMotion]);

  // --- NEW: analytics helper (simple) ---
  const trackEvent = (name, payload = {}) => {
    if (window?.dataLayer) {
      window.dataLayer.push({ event: name, ...payload });
    } else {
      // fallback for development
      console.info('analytics:', name, payload);
    }
  };

  // keep categories
  const categories = ['Workshops', 'Networking', 'Arts', 'Tech Talks', 'Career Fairs', 'Sports'];

  // REPLACE dynamic fetch with a small mock (max 3) for clean visuals
  const mockFeatured = [
    { slug: 'design-sprint-workshop', title: 'Design Sprint Workshop', img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=60' },
    { slug: 'campus-hack-night', title: 'Campus Hack Night', img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=60' },
    { slug: 'visual-arts-showcase', title: 'Visual Arts Showcase', img: 'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=900&q=60' }
  ];

  // --- NEW: IntersectionObserver to start counter animation when stats visible ---
  const statsRef = useRef(null);
  const counterAnimatedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      // immediately set final values if user prefers reduced motion
      setCounters({ events: 1245, attendees: 45231, organizers: 312 });
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !counterAnimatedRef.current) {
          counterAnimatedRef.current = true;
          const targets = { events: 1245, attendees: 45231, organizers: 312 };
          const duration = 900;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            setCounters({
              events: Math.floor(targets.events * t),
              attendees: Math.floor(targets.attendees * t),
              organizers: Math.floor(targets.organizers * t),
            });
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          // track that counters were seen
          trackEvent('counters_visible');
        }
      });
    }, { threshold: 0.4 });

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // --- NEW: preload hero image for LCP (first mock tile) + inject JSON-LD for mock events ---
  useEffect(() => {
    const first = mockFeatured[0];
    if (first?.img) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = first.img;
      document.head.appendChild(link);
    }

    // inject JSON-LD
    const ld = {
      "@context": "https://schema.org",
      "@graph": mockFeatured.map((e, i) => ({
        "@type": "Event",
        "name": e.title,
        "startDate": new Date(Date.now() + (i + 1) * 86400000).toISOString(),
        "image": [e.img],
        "url": `${window.location.origin}/events/${e.slug}`,
        "description": `${e.title} — sample preview`
      }))
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);

    return () => {
      if (first?.img) {
        const links = Array.from(document.head.querySelectorAll(`link[rel="preload"][href="${first.img}"]`));
        links.forEach(n => n.remove());
      }
      document.head.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        if (s.textContent && s.textContent.includes(mockFeatured[0].title)) s.remove();
      });
    };
  }, []);

  // --- NEW: mobile nav state ---
  const [mobileOpen, setMobileOpen] = useState(false);

  // close mobile menu on escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="landingPage" role="main">
      <nav className="landingNav" role="navigation" aria-label="Main">
        <div className="navInner">
          <div className="navLeft">
            <Link to="/" className="navLogo" onClick={() => setMobileOpen(false)}>
              <span className="brand">Heron Fusion</span>
            </Link>
          </div>

          {/* --- NEW: hamburger button --- */}
          <button
            className={`hamburger ${mobileOpen ? 'is-active' : ''}`}
            aria-label="Toggle navigation"
            aria-controls="primary-navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(v => !v)}
          >
            <span className="hamburgerBox">
              <span className="hamburgerInner" />
            </span>
          </button>

          {/* navRight becomes collapsible on small screens */}
          <div id="primary-navigation" className={`navRight ${mobileOpen ? 'isOpen' : ''}`}>
            <a href="#about" className="navLink" onClick={() => setMobileOpen(false)}>About</a>
            <Link to="/events" className="navLink" onClick={() => setMobileOpen(false)}>Explore</Link>
            <Link to="/register" className="navLink primary" onClick={() => { trackEvent('cta_click', { label: 'Get Started' }); setMobileOpen(false); }}>Get Started</Link>
            <Link to="/login" className="navLink" onClick={() => setMobileOpen(false)}>Login</Link>

            {/* reduced motion toggle */}
            <button
              className="navLink motionToggle"
              aria-pressed={reducedMotion}
              title="Toggle reduced motion"
              onClick={() => { setReducedMotion(v => !v); setMobileOpen(false); }}
            >
              {reducedMotion ? 'Motion Off' : 'Motion On'}
            </button>
          </div>
        </div>
      </nav>

      <header className="landingHero">
        <div className="heroInner">
          <div className="heroText">
            <h1 className="heroTitle">Welcome to Heron Fusion</h1>

            {/* primary descriptive paragraph for Heron Fusion */}
            <p className="heroDesc">
              Heron Fusion is where creativity meets connection — a vibrant digital space built for artists and art enthusiasts to showcase work, discover inspiration, and grow together. Whether you’re a seasoned creator or just beginning your artistic journey, Heron Fusion empowers you with an intuitive platform that highlights your vision and connects you with a community that truly values art. Dive into curated collections, explore trending styles, and find collaborators who spark your next masterpiece. It’s not just a portfolio — it’s your creative home.
            </p>

            {/* -- NEW: quick hero badges to highlight value props -- */}
            <div className="badges" aria-hidden>
              <div className="badge"><strong>1.2k+</strong><span>Events</span></div>
              <div className="badge"><strong>45k+</strong><span>Attendees</span></div>
              <div className="badge"><strong>300+</strong><span>Orgs</span></div>
            </div>

            <div className="ctaRow">
              <Link className="btn primary" to="/register">Get Started</Link>
              <Link className="btn ghost" to="/events">Explore Events</Link>
            </div>

            <div className="quickLinks">
              <Link to="/login" className="link">Login</Link>
              <span className="sep">·</span>
              <Link to="/admin/login" className="link muted">Admin Login</Link>
            </div>
          </div>

          <div className="heroVisual" aria-hidden>
            <div className="mockup">
              {/* Replaced empty SVG with a responsive mock image */}
              <img
                src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"
                alt="Events preview mock"
                className="mockSvg"
                loading="eager"
                width="1200"
                height="800"
              />
            </div>
          </div>
        </div>
      </header>

      {/* new: feature showcase (text + mock image) */}
      <section className="featureShowcase">
        <div className="container">
          <div className="showcaseGrid">
            <div className="showcaseText">
              <h2 className="sectionTitle">Powerful event discovery & effortless management</h2>
              <p className="lead">
                Heron Fusion surfaces curated campus activities and makes RSVP, ticketing and post-event analytics seamless for everyone.
              </p>
              <p className="sub">
                Tailored recommendations, simple registration flows and actionable insights — all in one place.
              </p>
              <ul>
                <li>Personalized recommendations</li>
                <li>Quick RSVPs & ticketing</li>
                <li>Organizer dashboards & reporting</li>
              </ul>
            </div>
            <div className="showcaseImage" aria-hidden>
              {/* mock image — replace with real screenshot later */}
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=60" alt="App features preview" />
            </div>
          </div>
        </div>
      </section>

      {/* statsStrip: attach ref for intersection */}
      <section className="statsStrip" aria-label="Platform stats" ref={statsRef}>
        <div className="container statsInner">
          <div className="statCard">
            <div className="statValue">{counters.events.toLocaleString()}</div>
            <div className="statLabel">Events</div>
          </div>
          <div className="statCard">
            <div className="statValue">{counters.attendees.toLocaleString()}</div>
            <div className="statLabel">Attendees</div>
          </div>
          <div className="statCard">
            <div className="statValue">{counters.organizers.toLocaleString()}</div>
            <div className="statLabel">Organizers</div>
          </div>
        </div>
      </section>

      {/* recent events: use mockFeatured (max 3) */}
      <section className="recentStrip" aria-label="Recent events">
        <div className="container">
          <div className="headerRow">
            <h3 className="sectionTitle animateIn">Recent events</h3>
            <span className="sep" aria-hidden>•</span>
            <p className="muted">A quick glance at a few recent events on Heron Fusion.</p>
          </div>

          {/* vertical, content-forward previews (EventPreview renders vertical grid) */}
          <EventPreview
            featured={mockFeatured}
            variant="vertical"
            onItemClick={(meta) => trackEvent('preview_click', meta)}
          />
        </div>
      </section>

      <section className="features">
          <div className="container">
          <h2 className="srOnly">Features</h2>
          <div className="featureGrid">
            <article className="featureCard">
              <div className="icon" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18"/><path d="M12 3v18"/></svg>
              </div>
              <h3>Curated Events</h3>
              <p>Personalized recommendations so you never miss relevant activities.</p>
            </article>
            <article className="featureCard">
              <div className="icon" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></svg>
              </div>
              <h3>Instant RSVPs</h3>
              <p>Quickly register, share with friends, and track attendance.</p>
            </article>
            <article className="featureCard">
              <div className="icon" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
              </div>
              <h3>Admin Insights</h3>
              <p>Real-time analytics to measure engagement and grow participation.</p>
            </article>
          </div>
        </div>
      </section>

      {/* -- NEW: category pill strip for fast discovery -- */}
      <section className="categoryStrip" aria-label="Event categories">
        <div className="container">
          <h3 className="srOnly">Browse by category</h3>
          <div className="pills" role="list">
            {categories.map((c) => (
              <Link key={c} to={`/events?cat=${encodeURIComponent(c)}`} className="pill" role="listitem">{c}</Link>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <div className="container">
          <h2>About Heron Fusion</h2>
          <p>
            Heron Fusion helps students, organizers, and campus communities discover meaningful
            events and experiences. We combine a simple event discovery experience with powerful
            registration tools and real-time analytics so organizers can focus on delivering great
            experiences while attendees find relevant activities.
          </p>

          <div className="aboutGrid">
            <div>
              <h3>Our Mission</h3>
              <p>
                To empower campus communities by making event discovery effortless, inclusive and
                measurable. We believe that strong communities are built around shared experiences.
              </p>
            </div>

            <div>
              <h3>What We Offer</h3>
              <ul>
                <li>Personalized event recommendations</li>
                <li>Fast RSVPs and ticketing</li>
                <li>Admin dashboards with real-time insights</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="gallery" aria-label="Event gallery">
        <div className="container">
          <h2 style={{marginBottom:12}}>Event Moments</h2>
          <p style={{marginBottom:18, color:'#556', maxWidth: '64ch'}}>A glimpse of real moments — workshops, showcases and meetups hosted on Heron Fusion. These visuals show how your events will appear to attendees.</p>
          <div className="grid">
            <article className="card">
              <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=60" alt="Event" />
              <div className="cardBody">
                <h4>Campus Open Mic Night</h4>
                <p>Students gathered to share performances, connect, and celebrate talent.</p>
              </div>
            </article>
            <article className="card">
              <img src="https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=800&q=60" alt="Workshop" />
              <div className="cardBody">
                <h4>Hands-on Workshop</h4>
                <p>Small-group sessions and interactive learning drive engagement.</p>
              </div>
            </article>
            <article className="card">
              <img src="https://images.unsplash.com/photo-1515165562835-c4f2b9f97b3c?auto=format&fit=crop&w=800&q=60" alt="Conference" />
              <div className="cardBody">
                <h4>Student Conference</h4>
                <p>Organizers track registrations and attendance with real-time analytics.</p>
              </div>
            </article>
          </div>
        </div>
      </section>


      <section className="statsStrip" aria-label="Platform stats" ref={statsRef}>
        <div className="container statsInner">
          <div className="statCard">
            <div className="statValue">{counters.events.toLocaleString()}</div>
            <div className="statLabel">Events</div>
          </div>
          <div className="statCard">
            <div className="statValue">{counters.attendees.toLocaleString()}</div>
            <div className="statLabel">Attendees</div>
          </div>
          <div className="statCard">
            <div className="statValue">{counters.organizers.toLocaleString()}</div>
            <div className="statLabel">Organizers</div>
          </div>
        </div>
      </section>

      <section className="testimonial">
        <div className="container">
          <blockquote>
            "Heron Fusion made organizing campus events effortless — attendance climbed 40% in a month."
            <footer>— Prof. L. Santiago, Student Affairs</footer>
          </blockquote>
        </div>
      </section>
      <section className="ctaStrip">
        <div className="container">
          <div className="stripInner">
            <div>
              <strong>Ready to get started?</strong>
              <div className="small">Create an account and start exploring events in minutes.</div>
            </div>
            <div>
              <Link className="btn primary" to="/register">Create Account</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landingFooter">
        <div className="container">
          <div className="left">© {new Date().getFullYear()} HeronProto</div>
          <div className="right">
            <Link to="/terms">Terms</Link>
            <span className="sep">·</span>
            <Link to="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Landing;