import "./EmployeeProfileHeader.css";
import Button from "../../components/common/Button";
import type { Employee, Role } from "../../types";
import { formatDateLabel } from "../../utils/format";

type EmployeeProfileHeaderProps = {
  employee: Employee;
  role: Role;
  onEdit: () => void;
  onToggleStatus: () => void | Promise<void>;
};

function getStatusLabel(employee: Employee) {
  return employee.isActive ? employee.employmentStatus : "INACTIVE";
}

function getStatusClass(status: string) {
  return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
}

export default function EmployeeProfileHeader({ employee, role, onEdit, onToggleStatus }: EmployeeProfileHeaderProps) {
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  const canManageEmployee = role === "ADMIN" || role === "HR";

  return (
    <article className="card employee-profile-header">
      <div className="employee-profile-header__identity">
        <div className="employee-profile-header__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="employee-profile-header__copy">
          <div className="employee-profile-header__headline">
            <h2>{`${employee.firstName} ${employee.lastName}`}</h2>
            <span className={getStatusClass(getStatusLabel(employee))}>{getStatusLabel(employee)}</span>
          </div>
          <p className="employee-profile-header__meta">
            <span className="mono">{employee.employeeCode}</span>
            <span>{employee.user?.role.name ?? "-"}</span>
            <span>{employee.department?.name ?? "-"}</span>
          </p>
          <div className="employee-profile-header__summary">
            <div className="employee-profile-header__primary-contact">
              <span className="employee-profile-header__detail-label">Email</span>
              <strong>{employee.user?.email ?? "Not available"}</strong>
            </div>
            <div className="employee-profile-header__detail-list">
              <div className="employee-profile-header__detail-row">
                <span className="employee-profile-header__detail-label">Phone</span>
                <strong>{employee.phone || "Not provided"}</strong>
              </div>
              <div className="employee-profile-header__detail-row">
                <span className="employee-profile-header__detail-label">Joined</span>
                <strong>{formatDateLabel(employee.joiningDate)}</strong>
              </div>
              <div className="employee-profile-header__detail-row">
                <span className="employee-profile-header__detail-label">Manager</span>
                <strong>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      {canManageEmployee ? (
        <div className="employee-profile-header__actions">
          <Button type="button" onClick={onEdit}>
            Edit employee
          </Button>
          <Button type="button" variant="secondary" onClick={onToggleStatus}>
            {employee.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
