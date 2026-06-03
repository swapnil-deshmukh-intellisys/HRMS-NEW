import "./Sidebar.css";
import { Building2, Calendar, CalendarDays, Clock3, Gift, Home, Users, Wallet, UserRound, ClipboardList, Mail, SendHorizontal, Trophy, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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
  exact?: boolean;
};

function getNavItems(sessionUser: SessionUser): NavItem[] {
  const role = sessionUser.role;
  const isTeamLead = Boolean(sessionUser.employee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const items: NavItem[] = [{ to: "/", label: "Dashboard", icon: Home }];



  if (role !== "EMPLOYEE") {
    items.push({ to: "/departments", label: "Departments", icon: Building2 });
    items.push({ to: "/employees", label: "Employees", icon: Users });
  }

  items.push({ to: "/calendar", label: "Calendar", icon: Calendar });
  items.push({ to: "/attendance", label: "Attendance", icon: Clock3 });
  items.push({ to: "/leaves", label: "Leaves", icon: CalendarDays });
  items.push({ to: "/team/leaderboard", label: "Leaderboard", icon: Trophy });
  const isManager = role === "MANAGER";
  if (isTeamLead || isManager) {
    items.push({ to: "/team", label: "Team", icon: Users, exact: true });
  }
  items.push({ to: "/tasks/manage", label: "Manage Tasks", icon: ClipboardList });
  items.push({ to: "/payroll", label: "Payroll", icon: Wallet });
  items.push({ to: "/incentives", label: "Incentives", icon: Gift });
  if (role === "ADMIN" || role === "HR") {
    items.push({ to: "/templates", label: "Templates", icon: Mail });
    items.push({ to: "/email-broadcaster", label: "Broadcaster", icon: SendHorizontal });
  }
  return items;
}

export default function Sidebar({ sessionUser, navOpen, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navItems = getNavItems(sessionUser);

  function isActivePath(item: NavItem) {
    if (item.to === "/" || item.exact) {
      return location.pathname === item.to;
    }

    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  return (
    <aside className={`sidebar ${navOpen ? "open" : ""}`}>
      <div className="stack">
        <div className="sidebar-intro">
          <div className="sidebar-brand">
            <img src="/assets/images/Logo.png" alt="HRMS" className="sidebar-logo" />
          </div>
          <div className="sidebar-user-card">
            <div className="sidebar-user-name">
              {sessionUser.employee ? `${sessionUser.employee.firstName} ${sessionUser.employee.lastName}` : "Workspace access"}
            </div>
            <div className="sidebar-user-box">
              <div className="sidebar-user-avatar">
                <UserRound size={20} strokeWidth={2.5} />
              </div>
              <div className="sidebar-user-info">
                {sessionUser.employee?.employeeCode && (
                  <span className="sidebar-user-id">#{sessionUser.employee.employeeCode}</span>
                )}
                <div className="sidebar-role-badge">{sessionUser.role}</div>
              </div>
            </div>
          </div>
        </div>
        <nav className="nav-stack">
          {navItems.map((item) => (
            <Link
              key={item.to}
              className={isActivePath(item) ? "nav-link active" : "nav-link"}
              to={item.to}
              onClick={onNavigate}
            >
              <item.icon size={16} strokeWidth={2} />
              <span className="nav-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
