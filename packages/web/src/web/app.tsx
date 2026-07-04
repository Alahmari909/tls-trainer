import { Route, Switch, useLocation, Redirect } from "wouter";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { telegramTrack, getSession, clearSession } from "./hooks/useTelegramTrack";
import type { TraineeSession } from "./hooks/useTelegramTrack";
import NavMenu from "./components/NavMenu";
import Sidebar from "./components/Sidebar";
import { Provider } from "./components/provider";
import { unlockAudio, _toastListeners, showToast } from "./lib/audio";
import type { ToastItem } from "./lib/audio";
import { AlertTriangle, AlertOctagon, Volume2, MessageSquare, Megaphone, RotateCcw } from "lucide-react";

// ── PWA Loading Fallback ──────────────────────────────────────────────────────
const PWAFallback = (
  <div style={{
    background: '#03080f', minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
  }}>
    <div style={{
      width: 32, height: 32, border: '2px solid rgba(0,174,239,0.2)',
      borderTop: '2px solid #00AEEF', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    <div style={{ color: 'rgba(0,174,239,0.5)', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'Inter' }}>LOADING</div>
  </div>
);

// ── Error Boundary ────────────────────────────────────────────────────────────
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#03080f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
          <AlertTriangle size={40} strokeWidth={1.5} color="#FF4D4D" />
          <div style={{ color: '#FF4D4D', fontFamily: 'Inter', fontSize: 14, textAlign: 'center' }}>
            Page failed to load
          </div>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ background: 'rgba(0,174,239,0.1)', border: '1px solid rgba(0,174,239,0.3)', borderRadius: 8, color: '#00AEEF', padding: '10px 24px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, display:"flex", alignItems:"center", gap:6 }}>
            <RotateCcw size={14} strokeWidth={2} /> Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}



// Lazy-loaded pages — split into separate chunks to reduce initial bundle size
const Index = lazy(() => import("./pages/index"));

const QuizList = lazy(() => import("./pages/quiz-list"));
const QuizHistory = lazy(() => import("./pages/quiz-history"));
const Quiz = lazy(() => import("./pages/quiz"));
const Achievements = lazy(() => import("./pages/achievements"));
const Chat = lazy(() => import("./pages/chat"));
const Card = lazy(() => import("./pages/card"));
const Basics = lazy(() => import("./pages/basics"));
const Advanced = lazy(() => import("./pages/advanced"));
const Manuals = lazy(() => import("./pages/manuals"));
const Status = lazy(() => import("./pages/status"));
const Notifications = lazy(() => import("./pages/notifications"));
const Settings = lazy(() => import("./pages/settings"));
const PrivateChat = lazy(() => import("./pages/private-chat"));
const About = lazy(() => import("./pages/about"));
const Admin = lazy(() => import("./pages/admin"));
const Leaderboard = lazy(() => import("./pages/leaderboard"));
const Faults = lazy(() => import("./pages/faults"));
const Simulator = lazy(() => import("./pages/simulator"));
const ErrorCodes = lazy(() => import("./pages/error-codes"));
const Specs = lazy(() => import("./pages/specs"));

// ── V2 Pages (new kimi-style UI) ──────────────────────────────────────────────
const V2Home = lazy(() => import("./pages/v2/index"));
const V2Trainee = lazy(() => import("./pages/v2/trainee"));
const V2Module = lazy(() => import("./pages/v2/module"));
const V2Quiz = lazy(() => import("./pages/v2/quiz"));
const V2Simulator = lazy(() => import("./pages/v2/simulator"));
const V2Documents = lazy(() => import("./pages/v2/documents"));
const V2Profile = lazy(() => import("./pages/v2/profile"));
const V2Admin = lazy(() => import("./pages/v2/admin"));

// Re-export for anything that imported from app.tsx directly
export { unlockAudio, showToast } from "./lib/audio";
export { playAlertTone, vibrate } from "./lib/audio";

// ── Send heartbeat every 30s — checks account status, handles force-logout ────
function useHeartbeat() {
  const [location] = useLocation();
  useEffect(() => {
    const ping = async () => {
      const session = getSession();
      if (!session) return;
      try {
        const res = await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.id, page: location }),
        });
        const data = await res.json() as { ok: boolean; forceLogout?: boolean; reason?: string; message?: string; status?: string };
        if (data.forceLogout && data.reason === 'blocked') {
          // Force logout blocked trainee immediately
          clearSession();
          sessionStorage.setItem('tls_force_logout_reason', data.message ?? 'Your account has been blocked.');
          window.location.href = '/';
        } else if (data.ok && data.status) {
          // Update cached status so pages can read it
          sessionStorage.setItem('tls_account_status', data.status);
        }
      } catch { /* non-fatal */ }
    };
    ping();
    const id = setInterval(ping, 30_000); // 30s — fast enough for moderation actions
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── PWA manifest + title switcher ─────────────────────────────────────────────
// Safari reads manifest/apple-touch-icon at page load (handled in index.html script).
// This hook keeps <title> in sync as SPA navigates, so Safari shows the right name
// in the "Add to Home Screen" sheet when opened on /admin after SPA navigation.
function usePWAMeta() {
  const [location] = useLocation();
  useEffect(() => {
    const isAdmin = location === "/admin" || location.startsWith("/admin/");
    // Swap manifest link
    const manifest = document.getElementById("pwa-manifest") as HTMLLinkElement | null;
    if (manifest) manifest.href = isAdmin ? "/manifest-admin.json" : "/manifest-trainee.json";
    // Swap apple-touch-icon
    const ati = document.getElementById("apple-touch-icon") as HTMLLinkElement | null;
    if (ati) ati.href = isAdmin ? "/apple-touch-icon-admin.png" : "/apple-touch-icon.png";
    // Swap title meta
    const titleMeta = document.getElementById("pwa-title-meta") as HTMLMetaElement | null;
    if (titleMeta) titleMeta.content = isAdmin ? "TLS Admin" : "TLS Trainer";
    // Swap document title
    document.title = isAdmin ? "TLS Admin" : "TLS Trainer";
  }, [location]);
}

// ── Persist + restore last page ───────────────────────────────────────────────
// Strategy:
//   - sessionStorage holds a "active session token" (random ID per browser session tab lifetime)
//   - localStorage holds the last visited page AND the token that wrote it
//   - On mount: if sessionStorage token === localStorage token → iOS forced reload → restore page
//   - If no sessionStorage token → fresh app open → do NOT restore → go to Dashboard (/)
//   - This means: close app → reopen → always lands on Dashboard (or Login if not logged in)
//   - But: iOS forces a full page reload while app is still "open" → restores correctly
//
function PagePersistence() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const session = getSession();

    // Get or create session token in sessionStorage
    // sessionStorage is cleared when the user fully closes the app / tab
    // It survives iOS forced reloads (bfcache / memory pressure reloads)
    let sessionToken = sessionStorage.getItem("tls_session_token");
    if (!sessionToken) {
      // Fresh open — generate a new token, do NOT restore last page
      sessionToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("tls_session_token", sessionToken);
      // Clear stale persisted page so next restore attempt won't trigger
      localStorage.removeItem("tls_last_page");
      localStorage.removeItem("tls_last_page_token");
      return; // fresh open → stay on "/" → AuthGate will handle login/dashboard
    }

    // sessionToken exists → this is a reload within the same browser session
    if (!session) return; // not logged in — don't restore

    const savedPage = localStorage.getItem("tls_last_page");
    const savedToken = localStorage.getItem("tls_last_page_token");

    // Only restore if the saved page was written by THIS session token
    if (savedPage && savedPage !== "/" && savedToken === sessionToken && location === "/") {
      navigate(savedPage, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Save current page with current session token so we can verify on reload
    if (location !== "/") {
      const token = sessionStorage.getItem("tls_session_token");
      if (token) {
        localStorage.setItem("tls_last_page", location);
        localStorage.setItem("tls_last_page_token", token);
      }
    }
  }, [location]);

  return null;
}

// ── Scroll position save/restore per page ─────────────────────────────────────
// iOS Safari does NOT restore scroll on bfcache pop or forced reload.
// We save scroll every 500ms and on visibilitychange, restore on pageshow.
function useScrollPersistence() {
  const [location] = useLocation();
  const saveScroll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollKey = (path: string) => `tls_scroll_${path.replace(/\//g, "_") || "home"}`;

  // Save scroll position debounced
  useEffect(() => {
    const key = scrollKey(location);
    const handler = () => {
      if (saveScroll.current) clearTimeout(saveScroll.current);
      saveScroll.current = setTimeout(() => {
        try { localStorage.setItem(key, String(window.scrollY)); } catch {}
      }, 200);
    };
    window.addEventListener("scroll", handler, { passive: true });
    // Also save immediately on visibility hidden (app switch)
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        try { localStorage.setItem(key, String(window.scrollY)); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("scroll", handler);
      document.removeEventListener("visibilitychange", onHide);
      if (saveScroll.current) clearTimeout(saveScroll.current);
    };
  }, [location]);

  // Restore scroll on page navigation and on bfcache restore
  useEffect(() => {
    const key = scrollKey(location);
    const restore = () => {
      const saved = localStorage.getItem(key);
      if (saved) {
        // Small delay to let page render first
        setTimeout(() => { window.scrollTo({ top: parseInt(saved, 10), behavior: "instant" as ScrollBehavior }); }, 80);
      }
    };
    restore();

    // iOS bfcache: pageshow fires with persisted=true when user returns via app switch
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) restore();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [location]);
}

// ── Telegram lifecycle ────────────────────────────────────────────────────────
// Design intent:
//   - Fire siteOpen() ONCE per real session, guarded by localStorage timestamp
//   - localStorage survives iOS forced full page reloads (sessionStorage does not)
//   - Cooldown: 15 min — if reload happens within 15 min, skip siteOpen entirely
//   - Do NOT fire offline on visibilitychange (app switch, screen lock = NOT logout)
//   - Do NOT fire offline on beforeunload (refresh = NOT logout)
//   - Offline determined server-side by heartbeat timeout (5 min ONLINE_THRESHOLD_MS)
//   - Real logout fires offline via /trainee/logout endpoint directly
const SITE_OPEN_COOLDOWN_MS = 15 * 60 * 1000; // 15 min
function useTelegramLifecycle() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const session = getSession();
    if (!session) return;
    // Check localStorage timestamp — if fired within 15 min, skip (handles iOS reload)
    const lastFired = parseInt(localStorage.getItem("tls_site_open_ts") ?? "0", 10);
    if (Date.now() - lastFired < SITE_OPEN_COOLDOWN_MS) return;
    localStorage.setItem("tls_site_open_ts", String(Date.now()));
    telegramTrack.siteOpen();
    // No visibilitychange listener — switching apps / locking phone is NOT logout
    // No beforeunload listener — page refresh is NOT logout
    // Server heartbeat timeout handles offline detection naturally
  }, []);
}

// ── Auth Gate — wraps all protected routes ────────────────────────────────────
// Admin and /about routes are public. Everything else requires login.
function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [session, setSessionState] = useState<TraineeSession | null>(() => getSession());

  // ALL hooks must be called before any conditional return
  useEffect(() => {
    const check = () => setSessionState(getSession());
    window.addEventListener("storage", check);
    const id = setInterval(check, 2000);
    return () => {
      window.removeEventListener("storage", check);
      clearInterval(id);
    };
  }, []);

  // Navigate to intended destination after login
  useEffect(() => {
    if (!session) return;
    const intended = localStorage.getItem("tls_intended");
    if (intended && intended !== "/") {
      localStorage.removeItem("tls_intended");
      navigate(intended, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Admin and about pages are always accessible
  if (location === "/admin" || location === "/about") {
    return <>{children}</>;
  }

  // Guest mode — allow read-only pages without a real session
  const GUEST_PAGES = ["/basics", "/advanced", "/manuals", "/about", "/error-codes"];
  if (sessionStorage.getItem("tls_guest_mode") === "1") {
    if (GUEST_PAGES.some(p => location === p || location.startsWith(p + "/"))) {
      return <>{children}</>;
    }
    // Guest tried a locked page — go back to guest home
    return <Suspense fallback={PWAFallback}><Index /></Suspense>;
  }

  // Not logged in — show Index (which renders LoginScreen internally)
  if (!session) {
    // Save intended destination for redirect after login (localStorage survives iOS reload)
    if (location !== "/") {
      localStorage.setItem("tls_intended", location);
    }
    return <Suspense fallback={PWAFallback}><Index /></Suspense>;
  }

  return <>{children}</>;
}

// ── Global toast alert system ─────────────────────────────────────────────────
function GlobalToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 5000);
    };
    _toastListeners.add(handler);
    return () => { _toastListeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  const colorMap: Record<string, string> = {
    danger:  "#FF4D4D",
    warning: "#FFD166",
    sound:   "#FF4D4D",
    info:    "#00AEEF",
    message: "#00D26A",
  };

  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 99999, display: "flex", flexDirection: "column", gap: 8,
      width: "min(90vw, 360px)", pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const color = colorMap[t.alertType] ?? "#00AEEF";
        const ToastIcon = t.alertType === "danger" ? AlertOctagon
          : t.alertType === "warning" ? AlertTriangle
          : t.alertType === "sound" ? Volume2
          : t.alertType === "message" ? MessageSquare
          : Megaphone;
        return (
          <div key={t.id} style={{
            background: "#0a1628",
            border: `1px solid ${color}60`,
            borderLeft: `4px solid ${color}`,
            borderRadius: 10,
            padding: "12px 16px",
            boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 20px ${color}20`,
            animation: "toast-in 0.3s ease",
            display: "flex", alignItems: "flex-start", gap: 10,
            pointerEvents: "auto",
          }}>
            <ToastIcon size={20} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9, fontFamily: "Inter", letterSpacing: "0.12em",
                color, marginBottom: 4, textTransform: "uppercase",
              }}>
                {t.alertType === "message" ? "MESSAGE FROM INSTRUCTOR" : `INSTRUCTOR ALERT · ${t.alertType.toUpperCase()}`}
              </div>
              <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{t.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  useHeartbeat();
  useTelegramLifecycle();
  useScrollPersistence();
  usePWAMeta();

  const [location] = useLocation();
  const isV2Route = location === "/v2" || location.startsWith("/v2/");
  const isAdminRoute = location === "/admin" || location.startsWith("/admin");

  // Unlock audio on any user interaction
  useEffect(() => {
    const unlock = () => { unlockAudio(); };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  // V2 routes — fully isolated shell (new kimi-style UI)
  if (isV2Route) {
    return (
      <Provider>
        <Suspense fallback={null}>
          <Switch>
            <Route path="/v2" component={V2Home} />
            <Route path="/v2/trainee" component={V2Trainee} />
            <Route path="/v2/module/:id" component={V2Module} />
            <Route path="/v2/quiz" component={V2Quiz} />
            <Route path="/v2/simulator" component={V2Simulator} />
            <Route path="/v2/documents" component={V2Documents} />
            <Route path="/v2/profile" component={V2Profile} />
            <Route path="/v2/admin" component={V2Admin} />
            <Route path="/v2/admin/trainees" component={V2Admin} />
            <Route path="/v2/admin/reports" component={V2Admin} />
          </Switch>
        </Suspense>
      </Provider>
    );
  }

  // Admin gets its own fully isolated shell — no sidebar, no nav, no shared elements
  if (isAdminRoute) {
    return (
      <Provider>
        <Suspense fallback={null}>
          <Admin />
        </Suspense>
      </Provider>
    );
  }

  return (
    <Provider>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <PagePersistence />
      <GlobalToast />
      <div className="app-shell">
        <Sidebar />
        <div className="app-content">
          <NavMenu />
          <AuthGate>
            <RouteErrorBoundary>
            <Suspense fallback={PWAFallback}>
              <Switch>
                <Route path="/" component={Index} />
                <Route path="/basics" component={Basics} />
                <Route path="/advanced" component={Advanced} />

                <Route path="/manuals" component={Manuals} />
                <Route path="/quiz" component={QuizList} />
                <Route path="/quiz/:moduleId" component={Quiz} />
                <Route path="/quiz-history" component={QuizHistory} />
                <Route path="/achievements" component={Achievements} />
                <Route path="/chat" component={Chat} />
                <Route path="/private-chat" component={PrivateChat} />
                <Route path="/status" component={Status} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/settings" component={Settings} />
                <Route path="/card" component={Card} />
                <Route path="/about" component={About} />
                <Route path="/leaderboard" component={Leaderboard} />
                <Route path="/faults" component={Faults} />
                <Route path="/error-codes" component={ErrorCodes} />
                <Route path="/simulator" component={Simulator} />
                <Route path="/specs" component={Specs} />
                {/* Redirect legacy/deep-link routes to dashboard */}
                <Route path="/menu">{() => <Redirect to="/" />}</Route>
                <Route path="/modules">{() => <Redirect to="/" />}</Route>
              </Switch>
            </Suspense>
            </RouteErrorBoundary>
          </AuthGate>
        </div>
      </div>
    </Provider>
  );
}

export default App;
