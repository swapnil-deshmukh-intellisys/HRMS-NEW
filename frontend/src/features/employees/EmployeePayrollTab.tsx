import Table from "../../components/common/Table";
import type { PayrollRecord } from "../../types";

type EmployeePayrollTabProps = {
  payroll: PayrollRecord[];
};

function getStatusClass(status: PayrollRecord["status"]) {
  return `status-pill status-pill--${status.toLowerCase()}`;
}

function formatMonthYear(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function EmployeePayrollTab({ payroll }: EmployeePayrollTabProps) {
  const latestPayroll = payroll[0];
  const finalizedCount = payroll.filter((record) => record.status === "FINALIZED").length;
  const draftCount = payroll.filter((record) => record.status === "DRAFT").length;

  return (
    <div className="stack">
      <div className="grid cols-3 employee-profile-payroll-summary">
        <article className="card employee-profile-summary-card">
          <p className="eyebrow">Latest payroll</p>
          <strong>{latestPayroll ? formatMonthYear(latestPayroll.month, latestPayroll.year) : "No payroll yet"}</strong>
          <p className="muted">{latestPayroll ? latestPayroll.status : "No payroll records available"}</p>
        </article>
        <article className="card employee-profile-summary-card">
          <p className="eyebrow">Finalized records</p>
          <strong>{finalizedCount}</strong>
          <p className="muted">Payroll entries locked and ready</p>
        </article>
        <article className="card employee-profile-summary-card">
          <p className="eyebrow">Draft records</p>
          <strong>{draftCount}</strong>
          <p className="muted">Payroll entries still in progress</p>
        </article>
      </div>
      <div className="card employee-profile-section">
        <h3>Payroll history</h3>
        <div className="employee-profile-payroll-table">
          <Table
            compact
            columns={["Period", "Salary", "Status"]}
            rows={payroll.map((record) => [
              <div className="table-cell-stack" key={`period-${record.id}`}>
                <span className="table-cell-primary">{formatMonthYear(record.month, record.year)}</span>
                <span className="table-cell-secondary">{`${record.month}/${record.year}`}</span>
              </div>,
              record.salary,
              <span key={`status-${record.id}`} className={getStatusClass(record.status)}>
                {record.status}
              </span>,
            ])}
          />
        </div>
      </div>
    </div>
  );
}
