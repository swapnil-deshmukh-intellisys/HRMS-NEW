import "./EmployeeTable.css";
import { useMemo, useState } from "react";
import type { Employee } from "../../types";

type EmployeeTableProps = {
  employees: Employee[];
  onAdd: () => void;
  onSelect: (employee: Employee) => void;
};

export default function EmployeeTable({ employees, onAdd, onSelect }: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  function getStatusLabel(employee: Employee) {
    return employee.isActive ? employee.employmentStatus : "INACTIVE";
  }

  function getStatusClass(status: string) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
  }

  function isTeamLead(employee: Employee) {
    return employee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD");
  }

  function getDesignationBadgeClass(jobTitle?: string | null) {
    const normalizedTitle = jobTitle?.trim().toLowerCase();

    if (!normalizedTitle) {
      return null;
    }

    if (normalizedTitle === "managing director") {
      return "employee-designation-badge employee-designation-badge--managing-director";
    }

    if (normalizedTitle === "ceo" || normalizedTitle === "chief executive officer") {
      return "employee-designation-badge employee-designation-badge--ceo";
    }

    if (normalizedTitle === "hr" || normalizedTitle === "hr manager" || normalizedTitle.includes("human resources")) {
      return "employee-designation-badge employee-designation-badge--hr";
    }

    if (normalizedTitle === "manager") {
      return "employee-designation-badge employee-designation-badge--manager";
    }

    return null;
  }

  function renderJobTitle(employee: Employee) {
    if (!employee.jobTitle) {
      return employee.user?.email ?? employee.employeeCode;
    }

    const designationBadgeClass = getDesignationBadgeClass(employee.jobTitle);

    return (
      <>
        {designationBadgeClass ? <span className={designationBadgeClass}>{employee.jobTitle}</span> : employee.jobTitle}
        {isTeamLead(employee) ? " · TL" : ""}
      </>
    );
  }

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const fields = [
        fullName,
        employee.employeeCode,
        employee.jobTitle ?? "",
        employee.department?.name ?? "",
        employee.user?.role.name ?? "",
        employee.user?.email ?? "",
      ];

      return fields.some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [employees, searchTerm]);

  return (
    <div className="card dense-table-card employee-directory-card">
      <div className="action-row">
        <div className="employee-directory-heading">
          <h3>Employee directory</h3>
        </div>
        <div className="employee-directory-actions">
          <label className="employee-directory-search" aria-label="Search employees">
            <span className="employee-directory-search__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M8.75 3.75a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm-6.5 5a6.5 6.5 0 1 1 11.11 4.596l3.022 3.022a.75.75 0 1 1-1.06 1.06L12.3 14.407A6.5 6.5 0 0 1 2.25 8.75Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employees"
            />
          </label>
          <button type="button" onClick={onAdd}>
            Add employee
          </button>
        </div>
      </div>

      <div className="table-wrap employee-directory-table">
        <table className="table table--dense">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr
                key={employee.id}
                className="employee-row"
                onClick={() => onSelect(employee)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(employee);
                  }
                }}
                tabIndex={0}
              >
                <td>
                  <div className="table-cell-stack">
                    <span className="table-cell-primary">{`${employee.firstName} ${employee.lastName}`}</span>
                    <span className="table-cell-secondary">{renderJobTitle(employee)}</span>
                  </div>
                </td>
                <td>
                  <span className="mono">{employee.employeeCode}</span>
                </td>
                <td>{employee.department?.name ?? "-"}</td>
                <td>{employee.user?.role.name ?? "-"}</td>
                <td>
                  <span className={getStatusClass(getStatusLabel(employee))}>{getStatusLabel(employee)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="employee-directory-mobile-list">
        {filteredEmployees.map((employee) => (
          <article key={employee.id} className="employee-mobile-card" onClick={() => onSelect(employee)}>
            <div className="employee-mobile-card__header">
              <div className="table-cell-stack">
                <span className="table-cell-primary">{`${employee.firstName} ${employee.lastName}`}</span>
                <span className="table-cell-secondary">{renderJobTitle(employee)}</span>
              </div>
              <span className={getStatusClass(getStatusLabel(employee))}>{getStatusLabel(employee)}</span>
            </div>

            <div className="employee-mobile-card__meta">
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Code</span>
                <span className="table-cell-primary mono">{employee.employeeCode}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Department</span>
                <span className="table-cell-primary">{employee.department?.name ?? "-"}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Role</span>
                <span className="table-cell-primary">{employee.user?.role.name ?? "-"}</span>
              </div>
            </div>

          </article>
        ))}
      </div>
    </div>
  );
}
