import "./AppLayout.css";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { SessionUser } from "../types";
import { getPageTitle } from "../utils/routes";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

type AppLayoutProps = {
  token: string | null;
  sessionUser: SessionUser;
  onLogout: () => Promise<void>;
};

export default function AppLayout({ token, sessionUser, onLogout }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const currentPageTitle = getPageTitle(location.pathname);

  async function handleLogout() {
    await onLogout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      {navOpen ? <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
      <Sidebar sessionUser={sessionUser} navOpen={navOpen} onNavigate={() => setNavOpen(false)} onLogout={handleLogout} />
      <main className="content">
        <Navbar
          title={currentPageTitle}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((current) => !current)}
          token={token}
          currentEmployeeId={sessionUser.employee?.id ?? null}
        />
        <div className="content-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
