import { useState } from "react";
import type { Employee } from "../../types";
import { formatDateLabel } from "../../utils/format";
import { apiRequest } from "../../services/api";

type EmployeeOverviewTabProps = {
  employee: Employee;
  token?: string | null;
};

type DetailItem = {
  label: string;
  value: string;
};

export default function EmployeeOverviewTab({ employee, token }: EmployeeOverviewTabProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  
  const numberFormatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);

  const handleSyncHolidays = async () => {
    try {
      setIsSyncingHolidays(true);
      const res = await apiRequest<{ syncedCount: number }>("/google/sync-holidays", {
        method: "POST",
        token,
      });
      alert(`Successfully synced ${res.data?.syncedCount} holidays to your calendar.`);
    } catch (err: any) {
      alert(err.message || "Failed to sync holidays");
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting(true);
      const res = await apiRequest<{ url: string }>("/google/auth-url", { token });
      if (res.data?.url) {
        // Store current URL to return back after OAuth callback
        localStorage.setItem("hrms_google_callback_return", window.location.pathname);
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      alert(err.message || "Failed to initiate Google connection");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect your Google Workspace account?")) return;
    try {
      setIsConnecting(true);
      await apiRequest("/google/unlink", { method: "DELETE", token });
      window.location.reload(); // Refresh to show unlinked state
    } catch (err: any) {
      alert(err.message || "Failed to unlink Google account");
    } finally {
      setIsConnecting(false);
    }
  };

  const compensationDetails: DetailItem[] = [
    { label: "Package (LPA)", value: employee.annualPackageLpa != null ? numberFormatter.format(employee.annualPackageLpa) : "Not set" },
    { label: "Gross monthly", value: employee.grossMonthlySalary != null ? numberFormatter.format(employee.grossMonthlySalary) : "Not set" },
    { label: "Basic monthly", value: employee.basicMonthlySalary != null ? numberFormatter.format(employee.basicMonthlySalary) : "Not set" },
    { label: "Probation", value: employee.isOnProbation ? "On probation" : "Not on probation" },
    { label: "Probation end", value: employee.probationEndDate ? formatDateLabel(employee.probationEndDate) : "Not set" },
  ];

  const employmentDetails: DetailItem[] = [
    { label: "Department", value: employee.department?.name ?? "-" },
    { label: "Role", value: employee.user?.role.name ?? "-" },
    { label: "Joining date", value: formatDateLabel(employee.joiningDate) },
    { label: "Employment status", value: employee.employmentStatus },
    { label: "Workspace access", value: employee.isActive ? "Active" : "Inactive" },
  ];

  const reportingDetails: DetailItem[] = [
    { label: "Manager", value: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned" },
    { label: "Department code", value: employee.department?.code ?? "-" },
    { label: "Employment type", value: employee.employmentStatus === "ACTIVE" ? "Current employee" : "Restricted access" },
  ];

  const sections = [
    { title: "Employment", items: employmentDetails },
    { title: "Reporting", items: reportingDetails },
    { title: "Compensation", items: compensationDetails },
  ];

  return (
    <div className="card employee-profile-section">
      <div className="employee-overview-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h3>Employee details</h3>
        </div>
      </div>
      <div className="employee-overview-sections">
        {sections.map((section) => (
          <section key={section.title} className="employee-detail-section">
            <h4>{section.title}</h4>
            <div className="employee-detail-list">
              {section.items.map((item) => (
                <div key={item.label} className="employee-detail-row">
                  <span className="employee-detail-row__label">{item.label}</span>
                  <strong className="employee-detail-row__value">{item.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="employee-detail-section">
          <h4>Integrations</h4>
          <div className="integration-card google-workspace">
             <div className="integration-meta">
                <strong>Google Workspace</strong>
                <p>{employee.user?.isGoogleLinked ? `Linked to ${employee.user.googleEmail || "Workspace Group"}` : "Unlinked - Connect to sync Calendar & Meet"}</p>
             </div>
             <div className="integration-controls">
               {employee.user?.isGoogleLinked ? (
                 <>
                   <button className="secondary sm" onClick={handleSyncHolidays} disabled={isSyncingHolidays}>
                     {isSyncingHolidays ? "Syncing..." : "Sync Holidays"}
                   </button>
                   <button className="secondary danger sm" onClick={handleUnlinkGoogle} disabled={isConnecting}>
                     Disconnect
                   </button>
                 </>
               ) : (
                 <button className="primary sm" onClick={handleConnectGoogle} disabled={isConnecting}>
                   {isConnecting ? "Connecting..." : "Connect Google"}
                 </button>
               )}
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
