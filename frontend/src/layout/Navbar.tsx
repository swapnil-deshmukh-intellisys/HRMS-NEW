import "./Navbar.css";
import { Bell, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  return (
    <div className="topbar">
      <div className="topbar-copy">
        <Button className="mobile-nav-toggle" variant="secondary" type="button" onClick={onToggleNav}>
          {navOpen ? "Close menu" : "Menu"}
        </Button>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-attendance-action">
          <AttendanceQuickAction token={token} currentEmployeeId={currentEmployeeId} size="compact" />
        </div>
        <label className="topbar-search-wrap" aria-label="Search workspace">
          <Search className="topbar-search-icon" size={16} strokeWidth={2} />
          <input className="topbar-search" type="search" placeholder="Search..." />
        </label>
        <Button type="button" className="topbar-icon-button" variant="secondary" aria-label="Notifications">
          <Bell size={18} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          className="topbar-icon-button"
          variant="secondary"
          aria-label="Open profile"
          onClick={() => {
            if (currentEmployeeId) {
              navigate(`/employees/${currentEmployeeId}`);
            }
          }}
          disabled={!currentEmployeeId}
        >
          <UserRound size={18} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
