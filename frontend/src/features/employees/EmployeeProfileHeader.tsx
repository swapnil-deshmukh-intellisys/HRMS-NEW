
import "./EmployeeProfileHeader.css";
import { Pencil, Power, Mail, Phone, CalendarDays, UserCheck } from "lucide-react";
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

  const contactItems = [
    { icon: <Mail size={14} />, label: "Email", value: employee.user?.email ?? "-" },
    { icon: <Phone size={14} />, label: "Phone", value: employee.phone || "-" },
    { icon: <CalendarDays size={14} />, label: "Joined", value: formatDateLabel(employee.joiningDate) },
    { icon: <UserCheck size={14} />, label: "Manager", value: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "-" },
  ];

  return (
    <article className="card profile-header">
      {/* Top section: Avatar + Identity + Actions */}
      <div className="profile-header__top">
        <div className="profile-header__avatar-wrap">
          <div className="profile-header__avatar" aria-hidden="true">
            {initials}
          </div>
        </div>

        <div className="profile-header__identity">
          <div className="profile-header__name-row">
            <h2>{`${employee.firstName} ${employee.lastName}`}</h2>
            <div className="profile-header__badges">
              <span className={getStatusClass(getStatusLabel(employee))}>{getStatusLabel(employee)}</span>
              {employee.isOnProbation ? <span className="status-pill status-pill--pending">ON PROBATION</span> : null}
            </div>
          </div>
          <div className="profile-header__meta">
            <span className="profile-header__meta-chip mono">{employee.employeeCode}</span>
            <span className="profile-header__meta-divider" />
            <span className="profile-header__meta-chip">{employee.user?.role.name ?? "-"}</span>
            <span className="profile-header__meta-divider" />
            <span className="profile-header__meta-chip">{employee.department?.name ?? "-"}</span>
            {employee.jobTitle && (
              <>
                <span className="profile-header__meta-divider" />
                <span className="profile-header__meta-chip">{employee.jobTitle}</span>
              </>
            )}
          </div>
        </div>

        <div className="profile-header__actions">
          {employee.user?.email && (
            <a
              href={`https://chat.google.com/dm/${employee.user.email}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-header__action-btn profile-header__action-btn--chat"
            >
              <img
                src="/assets/images/google-chat-icon.jpg"
                alt=""
                className="profile-header__chat-icon"
              />
              <span>Chat</span>
            </a>
          )}
          {canManageEmployee && (
            <>
              <button type="button" className="profile-header__action-btn profile-header__action-btn--primary" onClick={onEdit}>
                <Pencil size={15} />
                <span>Edit</span>
              </button>
              <button type="button" className="profile-header__action-btn profile-header__action-btn--secondary" onClick={onToggleStatus}>
                <Power size={15} />
                <span>{employee.isActive ? "Deactivate" : "Activate"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom section: Contact info chips */}
      <div className="profile-header__contact-strip">
        {contactItems.map((item) => (
          <div key={item.label} className="profile-header__contact-item">
            <div className="profile-header__contact-icon">{item.icon}</div>
            <div className="profile-header__contact-copy">
              <span className="profile-header__contact-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
