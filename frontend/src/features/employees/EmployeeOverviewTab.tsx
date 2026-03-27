import type { Employee } from "../../types";
import { formatDateLabel } from "../../utils/format";

type EmployeeOverviewTabProps = {
  employee: Employee;
};

type DetailItem = {
  label: string;
  value: string;
};

export default function EmployeeOverviewTab({ employee }: EmployeeOverviewTabProps) {
  const numberFormatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
      <section className="employee-identity-panel">
        <div className="employee-identity-panel__header">
          <div>
            <h4>Identity & contact</h4>
            <p className="muted">Primary contact details and employee identifiers.</p>
          </div>
        </div>
        <div className="employee-identity-panel__body">
          <div className="employee-identity-panel__lead">
            <span className="employee-identity-panel__label">Email</span>
            <strong className="employee-identity-panel__email">{employee.user?.email ?? "Not available"}</strong>
          </div>
          <div className="employee-identity-panel__meta">
            <div className="employee-identity-chip">
              <span>Employee code</span>
              <strong>{employee.employeeCode}</strong>
            </div>
            <div className="employee-identity-chip">
              <span>Phone</span>
              <strong>{employee.phone || "Not provided"}</strong>
            </div>
          </div>
        </div>
      </section>
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
      </div>
    </div>
  );
}
