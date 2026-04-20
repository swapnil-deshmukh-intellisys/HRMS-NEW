import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Role } from "../../types";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";

type DashboardData = Record<string, number | string | boolean | null | undefined | object>;

function getDashboardContent(role: Role) {
  if (role === "MANAGER") {
    return {
      eyebrow: "Team operations",
      title: "Team overview",
      description: "Stay on top of the main team counters and move into analytics when you need trends.",
    };
  }

  if (role === "HR") {
    return {
      eyebrow: "HR operations",
      title: "Workforce in motion",
      description: "Keep the dashboard focused on essential operations and use analytics for deeper visual review.",
    };
  }

  return {
    eyebrow: "Executive overview",
    title: "Operations command center",
    description: "Track the key workforce numbers here and open analytics for detailed patterns and trends.",
  };
}

export default function ManagementDashboard({ token, role }: { token: string | null; role: Role }) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const bannerContent = getDashboardContent(role);

  useEffect(() => {
    const endpoint = role === "MANAGER" ? "/dashboard/manager" : "/dashboard/hr";

    setLoading(true);
    apiRequest<DashboardData>(endpoint, { token })
      .then((response) => {
        setData(response.data);
      })
      .catch((requestError) => console.error(requestError instanceof Error ? requestError.message : "Failed to load management dashboard"))
      .finally(() => setLoading(false));
  }, [role, token]);

  if (loading) {
    return (
      <div className="page-loading">
        <article className="card skeleton-card skeleton-card--hero">
          <span className="skeleton-line skeleton-line--short" />
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      </div>
    );
  }

  return (
    <>
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row">
            <ThoughtOfTheDay />
            <div className="dashboard-hero-header">
              {bannerContent.eyebrow ? <p className="eyebrow">{bannerContent.eyebrow}</p> : null}
              <h3>{bannerContent.title}</h3>
            </div>
          </div>
          <DashboardHeroClocks />
        </div>
      </article>

      <div className="grid cols-2 dashboard-grid">
        {Object.entries(data).map(([key, value]) => {
          const getNavigationPath = () => {
            switch (key) {
              case "employees": return "/employees";
              case "pendingLeaves": return "/leaves";
              case "payrollCount": return "/payroll";
              case "departments": return "/departments";
              default: return null;
            }
          };

          const navigationPath = getNavigationPath();
          
          return (
            <article 
              key={key} 
              className={`card metric-card metric-card--${typeof value === "object" ? "status" : "numeric"}${navigationPath ? " metric-card--clickable" : ""}`}
              onClick={navigationPath ? () => navigate(navigationPath) : undefined}
              style={navigationPath ? { cursor: "pointer" } : undefined}
            >
              <p className="eyebrow">
                {key === "teamCount" ? "Team members" : key === "pendingApprovals" ? "Pending approvals" : key === "pendingLeaves" ? "Pending leaves" : key === "employees" ? "Employees" : key === "departments" ? "Departments" : key === "payrollCount" ? "Payroll records" : key}
              </p>
              <strong>{String(value ?? "-")}</strong>
              <p className="muted">
                {key === "pendingApprovals" ? "Action needed soon" : key === "pendingLeaves" ? "Currently awaiting action" : "Live summary"}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
