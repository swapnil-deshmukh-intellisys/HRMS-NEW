import "./PayrollPage.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  absentDeductionDays: number;
  halfDayDeductionDays: number;
  deductibleDays: number;
  deductionAmount: number;
  finalSalaryBeforeProbation: number;
  probationMultiplier: number;
  probationAdjustedSalary: number;
  finalSalary: number;
};

type PayrollSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

const initialPayrollForm = (): PayrollFormValues => ({
  employeeId: "",
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  salary: "",
  status: "DRAFT",
});

const payrollMonthOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const payrollStatusOptions: PayrollSelectOption[] = [
  { value: "DRAFT", label: "Draft", hint: "Editable payroll record" },
  { value: "FINALIZED", label: "Finalized", hint: "Locked payroll record" },
];

type PayrollSelectFieldProps = {
  label: string;
  value: string;
  options: PayrollSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

function PayrollSelectField({ label, value, options, onChange, placeholder = "Select an option", required = false }: PayrollSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerId = `${label.toLowerCase().replace(/\s+/g, "-")}-trigger`;
  const listboxId = `${label.toLowerCase().replace(/\s+/g, "-")}-listbox`;
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const searchable = label === "Employee";
  const filteredOptions = searchable
    ? options.filter((option) => {
        const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase();
        return haystack.includes(searchTerm.trim().toLowerCase());
      })
    : options;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open && searchTerm) {
      setSearchTerm("");
    }
  }, [open, searchTerm]);

  return (
    <label className="payroll-field">
      {label}
      <div className={`payroll-select ${open ? "payroll-select--open" : ""}`} ref={containerRef}>
        <button
          type="button"
          id={triggerId}
          className="payroll-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-required={required}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={`payroll-select__value ${selectedOption ? "" : "payroll-select__value--placeholder"}`.trim()}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="payroll-select__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false">
              <path d="M4 6.5 8 10l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <input type="hidden" value={value} required={required} />
        {open ? (
          <div className="payroll-select__menu" role="listbox" id={listboxId} aria-labelledby={triggerId}>
            {searchable ? (
              <div className="payroll-select__search">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search employee"
                />
              </div>
            ) : null}
            {filteredOptions.length ? filteredOptions.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`payroll-select__option ${selected ? "payroll-select__option--selected" : ""}`.trim()}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="payroll-select__option-label">{option.label}</span>
                  {option.hint ? <span className="payroll-select__option-hint">{option.hint}</span> : null}
                </button>
              );
            }) : (
              <div className="payroll-select__empty">No matching employees</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function PayrollPage({ token, role }: PayrollPageProps) {
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [message, setMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null);
  const [form, setForm] = useState<PayrollFormValues>(initialPayrollForm);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  const reloadData = useCallback(async () => {
    setLoading(true);
    const requests: [Promise<{ data: PayrollRecord[] }>, Promise<{ data: { items: Employee[] } }> | Promise<null>] = [
      apiRequest<PayrollRecord[]>("/payroll", { token }),
      role === "ADMIN" || role === "HR" ? apiRequest<{ items: Employee[] }>("/employees?limit=100", { token }) : Promise.resolve(null),
    ];

    const [payrollResponse, employeeResponse] = await Promise.all(requests);
    setPayroll(payrollResponse.data);
    setEmployees(employeeResponse?.data.items ?? []);
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
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    const timeoutId = window.setTimeout(() => {
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
        })
        .finally(() => {
          setPreviewLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      setPreviewLoading(false);
    };
  }, [editingPayrollId, form.employeeId, form.month, form.year, role, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.employeeId || !form.month || !form.year || !form.salary) {
      return;
    }

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

  function getMonthLabel(month: number | string) {
    return payrollMonthOptions.find((option) => option.value === String(month))?.label ?? String(month);
  }

  const employeeOptions = useMemo<PayrollSelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: `${employee.firstName} ${employee.lastName}`,
        hint: employee.employeeCode,
      })),
    [employees],
  );

  const monthOptions = useMemo<PayrollSelectOption[]>(() => payrollMonthOptions.map((option) => ({ ...option })), []);
  const isPayrollFormValid = Boolean(form.employeeId && form.month && form.year && form.salary);
  const visiblePayroll = useMemo(
    () => (role === "EMPLOYEE" ? payroll.filter((record) => record.status !== "DRAFT") : payroll),
    [payroll, role],
  );

  return (
    <section className="stack">
      {message ? <p className="success-text">{message}</p> : null}
      {(role === "ADMIN" || role === "HR") && !loading ? (
        <form className="card stack compact-form payroll-form-card" onSubmit={handleSubmit}>
          <div className="payroll-form-card__header">
            <div>
              <p className="eyebrow">Payroll</p>
              <h3>{editingPayrollId ? "Update payroll record" : "Create payroll record"}</h3>
            </div>
          </div>
          <div className="grid cols-4 payroll-form-grid">
            <PayrollSelectField
              label="Employee"
              value={form.employeeId}
              options={employeeOptions}
              placeholder="Select employee"
              required
              onChange={(value) => setForm({ ...form, employeeId: value })}
            />
            <PayrollSelectField
              label="Month"
              value={form.month}
              options={monthOptions}
              required
              onChange={(value) => setForm({ ...form, month: value })}
            />
            <label className="payroll-field">
              Year
              <input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} type="number" required />
            </label>
            <label className="payroll-field">
              Salary
              <input
                value={form.salary}
                onChange={(event) => setForm({ ...form, salary: event.target.value })}
                type="number"
                required
                readOnly={Boolean(preview) && !editingPayrollId}
              />
            </label>
            <PayrollSelectField
              label="Status"
              value={form.status}
              options={payrollStatusOptions}
              required
              onChange={(value) => setForm({ ...form, status: value as PayrollFormValues["status"] })}
            />
          </div>
          {preview ? (
            <div className="grid cols-4 payroll-preview-grid">
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Net salary</span>
                <span className="table-cell-primary">{preview.netSalary}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Absent days</span>
                <span className="table-cell-primary">{preview.absentDeductionDays}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Half days</span>
                <span className="table-cell-primary">{preview.halfDayDeductionDays}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Deductible days</span>
                <span className="table-cell-primary">{preview.deductibleDays}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Deduction amount</span>
                <span className="table-cell-primary">{preview.deductionAmount}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Before probation</span>
                <span className="table-cell-primary">{preview.finalSalaryBeforeProbation}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat">
                <span className="table-cell-secondary">Probation pay</span>
                <span className="table-cell-primary">{preview.probationMultiplier === 0.5 ? "50%" : "100%"}</span>
              </div>
              <div className="table-cell-stack payroll-preview-stat payroll-preview-stat--highlight">
                <span className="table-cell-secondary">Final salary</span>
                <span className="table-cell-primary">{preview.finalSalary}</span>
              </div>
              {(preview as any).grossSalary && (preview as any).grossSalary !== preview.finalSalary ? (
                <>
                  <div className="table-cell-stack payroll-preview-stat">
                    <span className="table-cell-secondary">Base salary</span>
                    <span className="table-cell-primary">{(preview as any).baseSalary}</span>
                  </div>
                  <div className="table-cell-stack payroll-preview-stat">
                    <span className="table-cell-secondary">Total incentives</span>
                    <span className="table-cell-primary">{(preview as any).totalIncentives}</span>
                  </div>
                  <div className="table-cell-stack payroll-preview-stat payroll-preview-stat--highlight">
                    <span className="table-cell-secondary">Gross salary (with incentives)</span>
                    <span className="table-cell-primary">{(preview as any).grossSalary}</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {preview?.employee.isOnProbation ? <p className="muted payroll-note">Probation rule is active, so only 50% of the final salary is payable for this payroll cycle.</p> : null}
          {preview && editingPayrollId ? <p className="muted payroll-note">Preview is shown for reference only. The saved salary will stay unchanged unless you edit it.</p> : null}
          {previewLoading ? <p className="muted payroll-note">Refreshing payroll preview...</p> : null}
          
          {/* Incentive Breakdown */}
          {(preview as any)?.incentives && (preview as any).incentives.length > 0 ? (
            <div className="card" style={{ marginTop: '2rem' }}>
              <div className="card__header">
                <h4>Incentive Breakdown</h4>
                <span className="eyebrow">{(preview as any).incentives.length} incentive(s) included</span>
              </div>
              <div className="table-wrap">
                <table className="table table--dense">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview as any).incentives.map((incentive: any) => (
                      <tr key={incentive.id}>
                        <td>{incentive.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                        <td className="amount">Rs {incentive.amount.toLocaleString()}</td>
                        <td>{incentive.reason}</td>
                        <td>
                          <span className={`status-badge status-${incentive.status.toLowerCase()}`}>
                            {incentive.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="button-row payroll-form-actions">
            <button type="submit" className="payroll-action-button payroll-action-button--primary" disabled={!isPayrollFormValid}>
              {editingPayrollId ? "Update payroll" : "Create payroll"}
            </button>
            {editingPayrollId ? (
              <button type="button" className="secondary payroll-action-button" onClick={cancelEdit}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      <div className="card dense-table-card payroll-table-card">
        <div className="payroll-table-card__header">
          <div>
            <p className="eyebrow">Payroll</p>
            <h3>Payroll records</h3>
          </div>
        </div>
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
                {visiblePayroll.length ? (
                  visiblePayroll.map((record) => (
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
                      <td>{getMonthLabel(record.month)}</td>
                      <td>{record.year}</td>
                      <td>{record.salary}</td>
                      <td>
                        <span className={getStatusClass(record.status)}>{record.status}</span>
                      </td>
                      {role === "ADMIN" || role === "HR" ? (
                        <td className="row-actions">
                          {record.status === "DRAFT" ? (
                            <button type="button" className="payroll-action-button payroll-action-button--primary" onClick={() => startPayrollEdit(record)}>
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
