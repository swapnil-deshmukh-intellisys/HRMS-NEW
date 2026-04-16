import "./Sidebar.css";
import { BarChart3, Building2, Calendar, CalendarDays, Clock3, Gift, Home, Users, Wallet, UserRound, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Button from "../components/common/Button";
import type { SessionUser } from "../types";

type SidebarProps = {
  sessionUser: SessionUser;
  navOpen: boolean;
  onNavigate: () => void;
};

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

function getNavItems(sessionUser: SessionUser): NavItem[] {
  const role = sessionUser.role;
  const isTeamLead = Boolean(sessionUser.employee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const items: NavItem[] = [{ to: "/", label: "Dashboard", icon: Home }];
  
  items.push({ to: "/analytics", label: "Analytics", icon: BarChart3 });

  if (role !== "EMPLOYEE") {
    items.push({ to: "/departments", label: "Departments", icon: Building2 });
    items.push({ to: "/employees", label: "Employees", icon: Users });
  }

  items.push({ to: "/calendar", label: "Calendar", icon: Calendar });
  items.push({ to: "/attendance", label: "Attendance", icon: Clock3 });
  items.push({ to: "/leaves", label: "Leaves", icon: CalendarDays });
  if (isTeamLead) {
    items.push({ to: "/team", label: "Team", icon: Users });
  }
  items.push({ to: "/payroll", label: "Payroll", icon: Wallet });
  items.push({ to: "/incentives", label: "Incentives", icon: Gift });
  return items;
}

export default function Sidebar({ sessionUser, navOpen, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navItems = getNavItems(sessionUser);

  function isActivePath(path: string) {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <aside className={`sidebar ${navOpen ? "open" : ""}`}>
      <div className="stack">
        <div className="sidebar-intro">
          <div className="sidebar-brand">
            <img src="/assets/images/Logo.png" alt="HRMS" className="sidebar-logo" />
          </div>
          <div className="sidebar-user-box">
            <div className="sidebar-user-avatar">
              <UserRound size={20} strokeWidth={2.5} />
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-role-badge">{sessionUser.role}</div>
              <p className="muted">{sessionUser.employee ? `${sessionUser.employee.firstName} ${sessionUser.employee.lastName}` : "Workspace access"}</p>
            </div>
          </div>
        </div>
        <nav className="nav-stack">
          {navItems.map((item) => (
            <Link
              key={item.to}
              className={isActivePath(item.to) ? "nav-link active" : "nav-link"}
              to={item.to}
              onClick={onNavigate}
            >
              <item.icon size={18} strokeWidth={2} />
              <span className="nav-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
