import "./AppLayout.css";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { SessionUser } from "../types";
import { getPageTitle } from "../utils/routes";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import SessionWarning from "../components/SessionWarning";
import { useBreakReminder } from "../hooks/useBreakReminder";
import BreakReminderModal from "../components/common/BreakReminderModal";
import { useApp } from "../context/AppContext";

type AppLayoutProps = {
  token: string | null;
  sessionUser: SessionUser;
  onLogout: () => Promise<void>;
  sessionWarning: boolean;
  onRefreshSession: () => void | Promise<void>;
  onUserActivity: () => void;
};

export default function AppLayout({ token, sessionUser, onLogout, sessionWarning, onRefreshSession, onUserActivity }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const currentPageTitle = getPageTitle(location.pathname);
  const { showModal, startBreak, snoozeBreak, dismissBreak } = useBreakReminder(token);
  const { isTimeDrifted } = useApp();

  async function handleLogout() {
    await onLogout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      {navOpen ? <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
      <Sidebar sessionUser={sessionUser} navOpen={navOpen} onNavigate={() => setNavOpen(false)} />
      <main className="content">
        <Navbar
          title={currentPageTitle}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((current) => !current)}
          token={token}
          currentEmployeeId={sessionUser.employee?.id ?? null}
          role={sessionUser.role}
          onLogout={handleLogout}
        />
        {isTimeDrifted && (
          <div className="time-drift-banner" role="alert">
            <span style={{ fontSize: "20px" }}>⏰</span>
            <div>
              <strong style={{ display: "block", marginBottom: "2px", fontSize: "15px" }}>System Clock Out of Sync</strong>
              <span style={{ opacity: 0.95, fontWeight: 500 }}>
                Your device's local clock deviates significantly from the secure server time. Please enable "Set time automatically" in your system settings to ensure attendance logging and other features work properly.
              </span>
            </div>
          </div>
        )}
        <div className="content-body">
          <Outlet />
        </div>
      </main>
      <SessionWarning
        sessionWarning={sessionWarning}
        onRefreshSession={onRefreshSession}
        onLogout={handleLogout}
        onUserActivity={onUserActivity}
      />
      
      <BreakReminderModal 
        open={showModal} 
        onClose={dismissBreak} 
        onStartBreak={startBreak} 
        onSnooze={snoozeBreak} 
      />
    </div>
  );
}
