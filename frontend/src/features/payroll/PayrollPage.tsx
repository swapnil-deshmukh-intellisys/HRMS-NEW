import "./PayrollPage.css";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../../services/api";
import type { Employee, PayrollRecord, Role } from "../../types";

type PayrollPageProps = {
  token: string | null;
  role: Role;
};

type PayrollFormValues = {
  employeeId: string;
  month: string;
  year: string;
  salary: string;
  status: "DRAFT" | "FINALIZED";
};

type PayrollPreview = {
  employee: Pick<Employee, "id" | "firstName" | "lastName" | "annualPackageLpa" | "grossMonthlySalary" | "basicMonthlySalary" | "isOnProbation" | "probationEndDate">;
  month: number;
  year: number;
  pf: number;
  gratuity: number;
  pt: number;
  netSalary: number;
  perDaySalary: number;
  perHourSalary: number;
  deductibleDays: number;
  deductionAmount: number;
  finalSalaryBeforeProbation: number;
  probationMultiplier: number;
  probationAdjustedSalary: number;
  finalSalary: number;
};

const initialPayrollForm = (): PayrollFormValues => ({
  employeeId: "",
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  salary: "",
  status: "DRAFT",
});

export default function PayrollPage({ token, role }: PayrollPageProps) {
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [message, setMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null);
  const [form, setForm] = useState<PayrollFormValues>(initialPayrollForm);
  const [loading, setLoading] = useState(true);

  const reloadData = useCallback(async () => {
    setLoading(true);
    const payrollResponse = await apiRequest<PayrollRecord[]>("/payroll", { token });
    setPayroll(payrollResponse.data);

    if (role === "ADMIN" || role === "HR") {
      const employeeResponse = await apiRequest<{ items: Employee[] }>("/employees?limit=100", { token });
      setEmployees(employeeResponse.data.items);
    }
    setLoading(false);
  }, [role, token]);

  useEffect(() => {
    reloadData().catch(() => setLoading(false));
  }, [reloadData]);

  useEffect(() => {
    if (role !== "ADMIN" && role !== "HR") {
      setPreview(null);
      return;
    }

    if (!form.employeeId || !form.month || !form.year) {
      setPreview(null);
      return;
    }

    apiRequest<PayrollPreview>(`/payroll/preview?employeeId=${form.employeeId}&month=${form.month}&year=${form.year}`, { token })
      .then((response) => {
        setPreview(response.data);
        if (!editingPayrollId) {
          setForm((current) =>
            current.salary === String(response.data.finalSalary)
              ? current
              : { ...current, salary: String(response.data.finalSalary) },
          );
        }
      })
      .catch(() => {
        setPreview(null);
      });
  }, [editingPayrollId, form.employeeId, form.month, form.year, role, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = editingPayrollId ? `/payroll/${editingPayrollId}` : "/payroll";

    await apiRequest<PayrollRecord>(endpoint, {
      method: editingPayrollId ? "PUT" : "POST",
      token,
      body: {
        employeeId: Number(form.employeeId),
        month: Number(form.month),
        year: Number(form.year),
        ...(form.salary ? { salary: Number(form.salary) } : {}),
        status: form.status,
      },
    });

    setMessage(editingPayrollId ? "Payroll updated." : "Payroll created.");
    setEditingPayrollId(null);
    setForm(initialPayrollForm());
    setPreview(null);
    await reloadData();
  }

  function startPayrollEdit(record: PayrollRecord) {
    setEditingPayrollId(record.id);
    setForm({
      employeeId: String(record.employeeId),
      month: String(record.month),
      year: String(record.year),
      salary: String(record.salary),
      status: record.status,
    });
  }

  function cancelEdit() {
    setEditingPayrollId(null);
    setForm(initialPayrollForm());
    setPreview(null);
  }

  function getStatusClass(status: PayrollRecord["status"]) {
    return `status-pill status-pill--${status.toLowerCase()}`;
  }

  return (
    <section className="stack">
      {message ? <p className="success-text">{message}</p> : null}
      {(role === "ADMIN" || role === "HR") && !loading ? (
        <form className="card stack compact-form payroll-form-card" onSubmit={handleSubmit}>
          <h3>{editingPayrollId ? "Update payroll record" : "Create payroll record"}</h3>
          <div className="grid cols-4">
            <label>
              Employee
              <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{`${employee.firstName} ${employee.lastName}`}</option>
                ))}
              </select>
            </label>
            <label>
              Month
              <input value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} type="number" min="1" max="12" required />
            </label>
            <label>
              Year
              <input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} type="number" required />
            </label>
            <label>
              Salary
              <input
                value={form.salary}
                onChange={(event) => setForm({ ...form, salary: event.target.value })}
                type="number"
                required
                readOnly={Boolean(preview) && !editingPayrollId}
              />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PayrollFormValues["status"] })}>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </label>
          </div>
          {preview ? (
            <div className="grid cols-4">
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Net salary</span>
                <span className="table-cell-primary">{preview.netSalary}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Deductible days</span>
                <span className="table-cell-primary">{preview.deductibleDays}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Deduction amount</span>
                <span className="table-cell-primary">{preview.deductionAmount}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Before probation</span>
                <span className="table-cell-primary">{preview.finalSalaryBeforeProbation}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Probation pay</span>
                <span className="table-cell-primary">{preview.probationMultiplier === 0.5 ? "50%" : "100%"}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Final salary</span>
                <span className="table-cell-primary">{preview.finalSalary}</span>
              </div>
            </div>
          ) : null}
          {preview?.employee.isOnProbation ? <p className="muted">Probation rule is active, so only 50% of the final salary is payable for this payroll cycle.</p> : null}
          {preview && editingPayrollId ? <p className="muted">Preview is shown for reference only. The saved salary will stay unchanged unless you edit it.</p> : null}
          <div className="button-row">
            <button type="submit">{editingPayrollId ? "Update payroll" : "Create payroll"}</button>
            {editingPayrollId ? (
              <button type="button" className="secondary" onClick={cancelEdit}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      <div className="card dense-table-card">
        <h3>Payroll records</h3>
        {loading ? (
          <div className="page-loading">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--dense">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Salary</th>
                  <th>Status</th>
                  {role === "ADMIN" || role === "HR" ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {payroll.length ? (
                  payroll.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {record.employee ? (
                          <div className="table-cell-stack">
                            <span className="table-cell-primary">{`${record.employee.firstName} ${record.employee.lastName}`}</span>
                            <span className="table-cell-secondary">{record.employee.employeeCode}</span>
                          </div>
                        ) : (
                          String(record.employeeId)
                        )}
                      </td>
                      <td>{record.month}</td>
                      <td>{record.year}</td>
                      <td>{record.salary}</td>
                      <td>
                        <span className={getStatusClass(record.status)}>{record.status}</span>
                      </td>
                      {role === "ADMIN" || role === "HR" ? (
                        <td className="row-actions">
                          {record.status === "DRAFT" ? (
                            <button type="button" onClick={() => startPayrollEdit(record)}>
                              Edit
                            </button>
                          ) : (
                            "Locked"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={role === "ADMIN" || role === "HR" ? 6 : 5}>No records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
