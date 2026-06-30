import "./DepartmentTable.css";
import type { Department } from "../../types";

type DepartmentTableProps = {
  departments: Department[];
  onAddDepartment?: () => void;
};

// Curated modern gradients for department avatars
const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", // Blue
  "linear-gradient(135deg, #10b981 0%, #047857 100%)", // Emerald
  "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", // Purple
  "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", // Amber
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", // Pink
  "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", // Cyan
];

export default function DepartmentTable({ departments, onAddDepartment }: DepartmentTableProps) {
  return (
    <div className="departments-container">
      <div className="action-row" style={{ marginBottom: "24px" }}>
        <div>
          <span className="eyebrow eyebrow--purple">Organization</span>
          <h2 className="page-title" style={{ marginTop: "4px" }}>Departments</h2>
        </div>
        {onAddDepartment ? (
          <div className="button-row row-actions">
            <button type="button" className="add-dept-btn" onClick={onAddDepartment}>
              Add department
            </button>
          </div>
        ) : null}
      </div>

      <div className="departments-grid">
        {departments.map((department, index) => {
          const gradient = GRADIENTS[index % GRADIENTS.length];
          const initials = department.name.slice(0, 2).toUpperCase();
          const employeeCount = department._count?.employees ?? 0;

          return (
            <article key={department.id} className="card department-card">
              <div className="department-card__top">
                <div 
                  className="department-card__avatar" 
                  style={{ background: gradient }}
                >
                  {initials}
                </div>
                <span className="department-card__code">{department.code}</span>
              </div>
              
              <div className="department-card__content">
                <h3 className="department-card__name">{department.name}</h3>
                <p className="department-card__count">
                  <strong>{employeeCount}</strong> {employeeCount === 1 ? "Employee" : "Employees"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
