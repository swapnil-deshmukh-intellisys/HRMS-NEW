import { useState } from "react";
import "./EmployeeOverviewTab.css";
import { Briefcase, User, Users, Wallet, Link2, Bell, Calendar, Shield, ChevronRight } from "lucide-react";
import type { Employee } from "../../types";
import { formatDateLabel } from "../../utils/format";
import { apiRequest } from "../../services/api";
import { usePushNotifications } from "../../hooks/usePushNotifications";

type EmployeeOverviewTabProps = {
  employee: Employee;
  token?: string | null;
};

type DetailItem = {
  label: string;
  value: string;
  accent?: boolean;
};

const sectionIcons: Record<string, React.ReactNode> = {
  Employment: <Briefcase size={18} />,
  "Personal Details": <User size={18} />,
  Reporting: <Users size={18} />,
  Compensation: <Wallet size={18} />,
};

export default function EmployeeOverviewTab({ employee, token }: EmployeeOverviewTabProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { subscribeUser, isSubscribing } = usePushNotifications(token || null);
  
  const handleEnableNotifications = async () => {
    try {
      await subscribeUser();
      alert("Desktop notifications enabled successfully! ✅");
    } catch (err: any) {
      alert(err.message || "Failed to enable notifications");
    }
  };

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
      alert(`Successfully synced ${res.data?.syncedCount} items to your calendar.`);
    } catch (err: any) {
      alert(err.message || "Failed to sync schedule");
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting(true);
      const res = await apiRequest<{ url: string }>("/google/auth-url", { token });
      if (res.data?.url) {
        // Log the URL for debugging
        console.log("Redirecting to Google with URL:", res.data.url);
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
    { label: "Annual Package", value: employee.annualPackageLpa != null ? "₹" + numberFormatter.format(employee.annualPackageLpa) : "-", accent: true },
    { label: "Gross Monthly", value: employee.grossMonthlySalary != null ? "₹ " + numberFormatter.format(employee.grossMonthlySalary) : "-" },
    { label: "Basic Monthly", value: employee.basicMonthlySalary != null ? "₹ " + numberFormatter.format(employee.basicMonthlySalary) : "-" },
    { label: "Probation", value: employee.isOnProbation ? "On probation" : "Not on probation" },
    { label: "Probation End", value: employee.probationEndDate ? formatDateLabel(employee.probationEndDate) : "-" },
  ];

  const employmentDetails: DetailItem[] = [
    { label: "Department", value: employee.department?.name ?? "-" },
    { label: "Role", value: employee.user?.role.name ?? "-" },
    { label: "Joining Date", value: formatDateLabel(employee.joiningDate) },
    { label: "Employment Status", value: employee.employmentStatus },
    { label: "Workspace Access", value: employee.isActive ? "Active" : "Inactive" },
  ];

  const reportingDetails: DetailItem[] = [
    { label: "Manager", value: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "-" },
    { label: "Department Code", value: employee.department?.code ?? "-" },
    { label: "Employment Type", value: employee.employmentStatus === "ACTIVE" ? "Current employee" : "Restricted access" },
  ];

  const personalDetails: DetailItem[] = [
    { label: "Date of Birth", value: employee.dateOfBirth ? formatDateLabel(employee.dateOfBirth) : "-" },
    { label: "PAN Card No.", value: employee.panCardNumber ?? "-" },
  ];

  const sections = [
    { title: "Employment", items: employmentDetails },
    { title: "Personal Details", items: personalDetails },
    { title: "Reporting", items: reportingDetails },
    { title: "Compensation", items: compensationDetails },
  ];

  const isGoogleLinked = employee.user?.isGoogleLinked;

  return (
    <div className="overview-tab">
      <div className="overview-tab__grid">
        {sections.map((section) => (
          <section key={section.title} className="overview-section-card">
            <div className="overview-section-card__header">
              <div className="overview-section-card__icon">
                {sectionIcons[section.title]}
              </div>
              <h4>{section.title}</h4>
            </div>
            <div className="overview-detail-list">
              {section.items.map((item) => (
                <div key={item.label} className={`overview-detail-row${item.accent ? " overview-detail-row--accent" : ""}`}>
                  <span className="overview-detail-row__label">{item.label}</span>
                  <span className="overview-detail-row__value">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {false && (
        <section className="overview-integrations">
          <div className="overview-integrations__header">
            <div className="overview-section-card__icon">
              <Link2 size={18} />
            </div>
            <h4>Integrations & Connectivity</h4>
          </div>
          <div className="overview-integrations__grid">
            <div className={`overview-integration-tile${isGoogleLinked ? " overview-integration-tile--connected" : ""}`}>
              <div className="overview-integration-tile__icon google">
                <Calendar size={20} />
              </div>
              <div className="overview-integration-tile__content">
                <div className="overview-integration-tile__header">
                  <strong>Google Workspace</strong>
                  <span className={`overview-integration-status${isGoogleLinked ? " connected" : ""}`}>
                    <span className="overview-integration-status__dot" />
                    {isGoogleLinked ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p>{isGoogleLinked ? `Linked to ${employee.user?.googleEmail || "Workspace"}` : "Connect to sync Calendar & Meet"}</p>
              </div>
              <div className="overview-integration-tile__actions">
                {isGoogleLinked ? (
                  <>
                    <button className="overview-integration-btn" onClick={handleSyncHolidays} disabled={isSyncingHolidays}>
                      {isSyncingHolidays ? "Syncing..." : "Sync Schedule"}
                    </button>
                    <button className="overview-integration-btn overview-integration-btn--danger" onClick={handleUnlinkGoogle} disabled={isConnecting}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button className="overview-integration-btn overview-integration-btn--primary" onClick={handleConnectGoogle} disabled={isConnecting}>
                    {isConnecting ? "Connecting..." : "Connect"}
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="overview-integration-tile">
              <div className="overview-integration-tile__icon notifications">
                <Bell size={20} />
              </div>
              <div className="overview-integration-tile__content">
                <div className="overview-integration-tile__header">
                  <strong>Desktop Notifications</strong>
                  <span className="overview-integration-status">
                    <Shield size={12} />
                    Browser permission
                  </span>
                </div>
                <p>Receive background alerts for leave status, announcements, and more.</p>
              </div>
              <div className="overview-integration-tile__actions">
                <button className="overview-integration-btn overview-integration-btn--primary" onClick={handleEnableNotifications} disabled={isSubscribing}>
                  {isSubscribing ? "Enabling..." : "Enable"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
