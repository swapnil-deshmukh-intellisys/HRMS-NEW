import "./DepartmentTable.css";
import Table from "../../components/common/Table";
import type { Department } from "../../types";

type DepartmentTableProps = {
  departments: Department[];
};

export default function DepartmentTable({ departments }: DepartmentTableProps) {
  return (
    <div className="card compact-table-card">
      <h3>Departments</h3>
      <Table compact columns={["Name", "Code"]} rows={departments.map((department) => [department.name, department.code])} />
    </div>
  );
}
