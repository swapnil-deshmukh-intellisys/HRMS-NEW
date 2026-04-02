import "./DepartmentTable.css";
import Table from "../../components/common/Table";
import type { Department } from "../../types";

type DepartmentTableProps = {
  departments: Department[];
  onAddDepartment?: () => void;
};

export default function DepartmentTable({ departments, onAddDepartment }: DepartmentTableProps) {
  return (
    <div className="card dense-table-card department-table-card">
      <div className="action-row">
        <div>
          <h3>Departments</h3>
        </div>
        {onAddDepartment ? (
          <div className="button-row row-actions">
            <button type="button" onClick={onAddDepartment}>
              Add department
            </button>
          </div>
        ) : null}
      </div>
      <Table compact columns={["Name", "Code"]} rows={departments.map((department) => [department.name, department.code])} />
    </div>
  );
}
