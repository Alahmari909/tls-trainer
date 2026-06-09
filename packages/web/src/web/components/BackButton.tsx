import { useLocation } from "wouter";
import { useAdminNav } from "../lib/admin-context";

interface BackButtonProps {
  label?: string;
  to?: string;
  style?: React.CSSProperties;
}

export default function BackButton({ label, to, style }: BackButtonProps) {
  const [, navigate] = useLocation();
  const { goBack } = useAdminNav();

  const handleBack = () => {
    // When rendered inside admin panel, AdminNavContext provides goBack()
    // which resets activeView to "dashboard" — avoids wouter navigate("/")
    // accidentally rendering the trainee login screen.
    if (goBack) {
      goBack();
      return;
    }

    // Normal trainee context — go to actual previous page if available
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // No history (direct URL access) — fall back to explicit destination or home
    navigate(to ?? '/');
  };

  return (
    <button
      onClick={handleBack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px 6px 10px",
        background: "rgba(0,174,239,0.08)",
        border: "1px solid rgba(0,174,239,0.25)",
        borderRadius: 8,
        cursor: "pointer",
        color: "#00AEEF",
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        letterSpacing: "0.04em",
        transition: "all 0.15s",
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,174,239,0.16)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,174,239,0.5)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,174,239,0.08)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,174,239,0.25)";
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label ?? "BACK"}
    </button>
  );
}
