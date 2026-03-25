import "./Navbar.css";
import { Bell, Search, Settings } from "lucide-react";
import AttendanceQuickAction from "../components/common/AttendanceQuickAction";
import Button from "../components/common/Button";

type NavbarProps = {
  title: string;
  navOpen: boolean;
  onToggleNav: () => void;
  token: string | null;
  currentEmployeeId: number | null;
};

export default function Navbar({ title, navOpen, onToggleNav, token, currentEmployeeId }: NavbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-copy">
        <Button className="mobile-nav-toggle" variant="secondary" type="button" onClick={onToggleNav}>
          {navOpen ? "Close menu" : "Menu"}
        </Button>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <AttendanceQuickAction token={token} currentEmployeeId={currentEmployeeId} size="compact" />
        <label className="topbar-search-wrap" aria-label="Search workspace">
          <Search className="topbar-search-icon" size={16} strokeWidth={2} />
          <input className="topbar-search" type="search" placeholder="Search..." />
        </label>
        <Button type="button" className="topbar-icon-button" variant="secondary" aria-label="Notifications">
          <Bell size={18} strokeWidth={2} />
        </Button>
        <Button type="button" className="topbar-icon-button" variant="secondary" aria-label="Settings">
          <Settings size={18} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
