import { useLocation, Link } from "wouter";

const navItems = [
  {
    path: "/",
    label: "HOME",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    path: "/modules",
    label: "MODULES",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="7" height="7"/><rect x="15" y="3" width="7" height="7"/>
        <rect x="15" y="14" width="7" height="7"/><rect x="2" y="14" width="7" height="7"/>
      </svg>
    )
  },
  {
    path: "/achievements",
    label: "BADGES",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    )
  },
  {
    path: "/quiz",
    label: "QUIZ",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  },
  {
    path: "/card",
    label: "ID CARD",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <circle cx="8" cy="12" r="2"/>
        <path d="M14 9h4M14 12h4M14 15h4"/>
      </svg>
    )
  }
];

export default function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const active = location === item.path || (item.path === "/quiz" && location.startsWith("/quiz"));
        return (
          <Link key={item.path} href={item.path} className={`nav-item${active ? " active" : ""}`}>
            {item.icon(active)}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
