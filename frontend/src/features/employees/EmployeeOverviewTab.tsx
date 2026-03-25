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
  const details: DetailItem[] = [
    { label: "Employee code", value: employee.employeeCode },
    { label: "Email", value: employee.user?.email ?? "-" },
    { label: "Phone", value: employee.phone || "-" },
    { label: "Department", value: employee.department?.name ?? "-" },
    { label: "Role", value: employee.user?.role.name ?? "-" },
    { label: "Manager", value: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned" },
    { label: "Joining date", value: formatDateLabel(employee.joiningDate) },
    { label: "Employment status", value: employee.employmentStatus },
    { label: "Workspace access", value: employee.isActive ? "Active" : "Inactive" },
  ];

  return (
    <div className="card employee-profile-section">
      <h3>Employee details</h3>
      <div className="employee-overview-grid">
        {details.map((item) => (
          <div key={item.label} className="employee-detail-card">
            <span className="employee-detail-card__label">{item.label}</span>
            <strong className="employee-detail-card__value">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
