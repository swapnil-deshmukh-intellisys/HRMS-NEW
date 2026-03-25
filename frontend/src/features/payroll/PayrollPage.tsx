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
  const [message, setMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null);
  const [form, setForm] = useState<PayrollFormValues>(initialPayrollForm);
  const [loading, setLoading] = useState(true);

  const reloadData = useCallback(async () => {
    setLoading(true);
    const payrollResponse = await apiRequest<PayrollRecord[]>("/payroll", { token });
    setPayroll(payrollResponse.data);

    if (role === "ADMIN" || role === "HR") {
      const employeeResponse = await apiRequest<{ items: Employee[] }>("/employees", { token });
      setEmployees(employeeResponse.data.items);
    }
    setLoading(false);
  }, [role, token]);

  useEffect(() => {
    reloadData().catch(() => setLoading(false));
  }, [reloadData]);

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
        salary: Number(form.salary),
        status: form.status,
      },
    });

    setMessage(editingPayrollId ? "Payroll updated." : "Payroll created.");
    setEditingPayrollId(null);
    setForm(initialPayrollForm());
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
              <input value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} type="number" required />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PayrollFormValues["status"] })}>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </label>
          </div>
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
