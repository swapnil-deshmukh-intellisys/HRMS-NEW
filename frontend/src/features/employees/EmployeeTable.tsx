import "./EmployeeTable.css";
import type { Employee } from "../../types";

type EmployeeTableProps = {
  employees: Employee[];
  onAdd: () => void;
  onEdit: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void | Promise<void>;
  onSelect: (employee: Employee) => void;
};

export default function EmployeeTable({ employees, onAdd, onEdit, onToggleStatus, onSelect }: EmployeeTableProps) {
  function getStatusLabel(employee: Employee) {
    return employee.isActive ? employee.employmentStatus : "INACTIVE";
  }

  function getStatusClass(status: string) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
  }

  function isTeamLead(employee: Employee) {
    return employee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD");
  }

  return (
    <div className="card dense-table-card">
      <div className="action-row">
        <div>
          <h3>Employee directory</h3>
        </div>
        <button type="button" onClick={onAdd}>
          Add employee
        </button>
      </div>
      <div className="table-wrap">
        <table className="table table--dense">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
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
                    <span className="table-cell-secondary">
                      {employee.jobTitle
                        ? `${employee.jobTitle}${isTeamLead(employee) ? " · TL" : ""}`
                        : employee.user?.email ?? employee.employeeCode}
                    </span>
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
                <td>
                  <div className="button-row row-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(employee);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleStatus(employee);
                      }}
                    >
                      {employee.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
