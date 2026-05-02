import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const getAuthToken = () => localStorage.getItem('token') || localStorage.getItem('adminToken') || null;

class MonitoringService {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.heartbeatInterval = null;
    this.flushInterval = null;
    this.currentPath = window.location.pathname;
    this.buffer = { interactions: [], errors: [], performance: [] };
    this.isInitialized = false;
  }
  getOrCreateSessionId() {
    let sid = sessionStorage.getItem('monitoring_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now();
      sessionStorage.setItem('monitoring_session_id', sid);
    }
    return sid;
  }
  init() {
    if (this.isInitialized) return;
    const token = getAuthToken();
    if (!token || token === 'null') { console.log('[Monitoring] No auth token'); return; }
    this.isInitialized = true;
    this.initializeSession();
    this.trackPerformance();
    this.trackErrors();
    this.trackInteractions();
    this.trackPageViews();
    this.startHeartbeat();
    this.startFlushInterval();
  }
  detectDevice() {
    const ua = navigator.userAgent;
    let type = 'desktop', os = 'unknown', browser = 'unknown';
    if (/Mobi|Android|iPhone|iPad|iPod/.test(ua)) type = 'mobile';
    if (/Windows/.test(ua)) os = 'Windows'; else if (/Mac/.test(ua)) os = 'MacOS'; else if (/Linux/.test(ua)) os = 'Linux'; else if (/Android/.test(ua)) os = 'Android'; else if (/iOS|iPhone|iPad/.test(ua)) os = 'iOS';
    if (/Chrome/.test(ua)) browser = 'Chrome'; else if (/Firefox/.test(ua)) browser = 'Firefox'; else if (/Safari/.test(ua)) browser = 'Safari'; else if (/Edge/.test(ua)) browser = 'Edge';
    return { type, os, browser };
  }
  initializeSession() {
    const token = getAuthToken();
    if (!token) return;
    const d = this.detectDevice();
    const payload = { sessionId: this.sessionId, userAgent: navigator.userAgent, screenResolution: `${window.screen.width}x${window.screen.height}`, language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, deviceType: d.type, os: d.os, browser: d.browser, url: window.location.pathname, referrer: document.referrer };
    axios.post(`${API_URL}/api/monitoring/collect/session`, payload, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  startHeartbeat() { this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000); }
  startFlushInterval() { this.flushInterval = setInterval(() => this.flush(), 60000); }
  trackPerformance() {
    if ('PerformanceObserver' in window) {
      try {
        const o = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) this.buffer.performance.push({ name: e.name, duration: e.duration, startTime: e.startTime, type: e.entryType, timestamp: Date.now() });
        });
        o.observe({ entryTypes: ['navigation', 'resource', 'paint', 'measure'] });
      } catch (e) {}
    }
    if (window.performance && window.performance.timing) {
      const t = window.performance.timing;
      this.buffer.performance.push({ name: 'page-load', type: 'navigation', metrics: { dns: t.domainLookupEnd - t.domainLookupStart, connect: t.connectEnd - t.connectStart, ttfb: t.responseStart - t.navigationStart, domInteractive: t.domInteractive - t.navigationStart, domComplete: t.domComplete - t.navigationStart, loadComplete: t.loadEventEnd - t.navigationStart }, timestamp: Date.now() });
    }
  }
  trackErrors() {
    window.addEventListener('error', (e) => this.buffer.errors.push({ message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: e.error?.stack, timestamp: Date.now(), url: window.location.href }));
    window.addEventListener('unhandledrejection', (e) => this.buffer.errors.push({ message: e.reason?.message || String(e.reason), stack: e.reason?.stack, timestamp: Date.now(), url: window.location.href, type: 'unhandledrejection' }));
  }
  trackInteractions() {
    const track = (e) => this.buffer.interactions.push({ type: e.type, target: this.getTargetInfo(e.target), timestamp: Date.now(), url: window.location.href });
    document.addEventListener('click', track, true);
    document.addEventListener('submit', track, true);
  }
  getTargetInfo(el) { return { tagName: el?.tagName?.toLowerCase() || 'unknown', id: el?.id || '', className: el?.className || '', text: el?.innerText?.substring(0, 50) || '' }; }
  trackPageViews() {
    this.trackPageView(window.location.pathname);
    let last = window.location.pathname;
    const oPush = window.history.pushState, oReplace = window.history.replaceState;
    window.history.pushState = (...a) => { oPush.apply(window.history, a); this.handleNavigation(); };
    window.history.replaceState = (...a) => { oReplace.apply(window.history, a); this.handleNavigation(); };
    window.addEventListener('popstate', () => this.handleNavigation());
  }
  handleNavigation() { const p = window.location.pathname; if (p !== this.currentPath) { this.currentPath = p; this.trackPageView(p); } }
  trackPageView(url) {
    const token = getAuthToken();
    if (!token) return;
    axios.post(`${API_URL}/api/monitoring/collect/pageview`, { sessionId: this.sessionId, url, timestamp: new Date().toISOString(), referrer: document.referrer }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  sendHeartbeat() {
    const token = getAuthToken();
    if (!token) return;
    axios.post(`${API_URL}/api/monitoring/collect/heartbeat`, { sessionId: this.sessionId, timestamp: new Date().toISOString(), url: window.location.pathname }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  flush() {
    const token = getAuthToken();
    if (!token) return;
    const data = { interactions: [...this.buffer.interactions], errors: [...this.buffer.errors], performance: [...this.buffer.performance] };
    this.buffer = { interactions: [], errors: [], performance: [] };
    axios.post(`${API_URL}/api/monitoring/collect/batch`, data, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  async endSession() {
    const token = getAuthToken();
    if (!token) return;
    try { await axios.post(`${API_URL}/api/monitoring/collect/session/end`, { sessionId: this.sessionId }, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) {}
  }
  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.endSession();
  }
}
const monitoringService = new MonitoringService();
export default monitoringService;
