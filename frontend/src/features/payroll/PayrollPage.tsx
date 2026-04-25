import "./PayrollPage.css";
import "../../components/common/Table.css";
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
  employee: Pick<Employee, "id" | "firstName" | "lastName" | "annualPackageLpa" | "grossMonthlySalary" | "basicMonthlySalary" | "isOnProbation" | "probationEndDate" | "joiningDate">;
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
  netBaseSalary: number;
  totalIncentives: number;
  totalPayableAmount: number;
  incentives: Array<{
    id: number;
    type: string;
    amount: number;
    reason: string;
    status: string;
  }>;
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
  const [printingPayrollId, setPrintingPayrollId] = useState<number | null>(null);

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
              current.salary === String(response.data.totalPayableAmount)
                ? current
                : { ...current, salary: String(response.data.totalPayableAmount) },
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

    if (!form.employeeId || !form.month) {
      return;
    }

    const effectiveYear = Number(form.year) || new Date().getFullYear();
    const effectiveSalary = Number(form.salary || preview?.totalPayableAmount || 0);
    if (!effectiveSalary) {
      return;
    }

    const endpoint = editingPayrollId ? `/payroll/${editingPayrollId}` : "/payroll";

    await apiRequest<PayrollRecord>(endpoint, {
      method: editingPayrollId ? "PUT" : "POST",
      token,
      body: {
        employeeId: Number(form.employeeId),
        month: Number(form.month),
        year: effectiveYear,
        salary: effectiveSalary,
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

  async function handleDownloadPayslip(record: PayrollRecord) {
    try {
      setPrintingPayrollId(record.id);
      const response = await apiRequest<PayrollPreview>(`/payroll/${record.id}/breakdown`, { token });
      const data = response.data;
      
      const printWindow = window.open('', '_blank', 'width=800,height=900');
      if (!printWindow) return;

      const monthLabel = getMonthLabel(data.month);
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Payslip - ${data.employee.firstName} - ${monthLabel} ${data.year}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
              .slip-container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #f3f4f6; }
              .company-info h1 { margin: 0; color: #7c3aed; font-size: 28px; letter-spacing: -0.025em; }
              .slip-title { text-align: right; }
              .slip-title h2 { margin: 0; font-size: 24px; color: #374151; }
              .slip-title p { margin: 4px 0 0; color: #6b7280; font-weight: 500; }
              
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
              .info-section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 12px; }
              .info-item { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #f3f4f6; padding-bottom: 4px; }
              .info-label { color: #6b7280; font-size: 13px; }
              .info-value { font-weight: 600; font-size: 13px; }

              .tables-container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; margin-bottom: 40px; }
              table { width: 100%; border-collapse: collapse; }
              th { text-align: left; background: #f9fafb; padding: 12px; font-size: 12px; text-transform: uppercase; color: #6b7280; border-radius: 4px; }
              td { padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
              .amount { text-align: right; font-weight: 500; }
              .deduction { color: #dc2626; }
              .total-row { background: #f9fafb; font-weight: 700 !important; border-top: 2px solid #e5e7eb; }
              
              .summary-card { background: #7c3aed; color: white; padding: 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 40px; }
              .summary-label { font-size: 14px; font-weight: 500; opacity: 0.9; }
              .summary-value { font-size: 32px; font-weight: 700; }
              
              .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; }
              .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 80px; }
              .sig-line { border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 12px; text-align: center; }

              @media print {
                body { padding: 0; }
                .slip-container { border: none; box-shadow: none; width: 100%; max-width: 100%; }
                .summary-card { -webkit-print-color-adjust: exact; background-color: #7c3aed !important; color: white !important; }
              }
            </style>
          </head>
          <body>
            <div class="slip-container">
              <div class="header">
                <div class="company-info">
                  <h1>HRMS</h1>
                  <p style="color: #6b7280; font-size: 14px; margin: 4px 0;">INTELLISYS TECHNOLOGIES</p>
                </div>
                <div class="slip-title">
                  <h2>PAYSLIP</h2>
                  <p>${monthLabel} ${data.year}</p>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-section">
                  <h3>Employee Details</h3>
                  <div class="info-item"><span class="info-label">Name</span> <span class="info-value">${data.employee.firstName} ${data.employee.lastName}</span></div>
                  <div class="info-item"><span class="info-label">Designation</span> <span class="info-value">Software Developer</span></div>
                  <div class="info-item"><span class="info-label">Department</span> <span class="info-value">Engineering</span></div>
                </div>
                <div class="info-section">
                  <h3>Pay Details</h3>
                  <div class="info-item"><span class="info-label">Employee Code</span> <span class="info-value">EM-00${data.employee.id}</span></div>
                  <div class="info-item"><span class="info-label">Joining Date</span> <span class="info-value">${new Date(data.employee.joiningDate).toLocaleDateString()}</span></div>
                  <div class="info-item"><span class="info-label">Days Payable</span> <span class="info-value">${30 - data.deductibleDays} / 30</span></div>
                </div>
              </div>

              <div class="tables-container">
                <div class="earning-side">
                  <table>
                    <thead><tr><th>Earnings</th><th class="amount">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Basic Salary</td><td class="amount">₹${data.netSalary}</td></tr>
                      ${data.incentives.map(i => `<tr><td>${i.type.replace(/_/g, ' ')}</td><td class="amount">₹${i.amount}</td></tr>`).join('')}
                      <tr class="total-row"><td>Gross Earnings</td><td class="amount">₹${((data.netBaseSalary ?? 0) + (data.totalIncentives ?? 0)).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="deduction-side">
                  <table>
                    <thead><tr><th>Deductions</th><th class="amount">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>PF Deduction</td><td class="amount deduction">₹${(data.pf ?? 0).toLocaleString()}</td></tr>
                      <tr><td>PT Deduction</td><td class="amount deduction">₹${(data.pt ?? 0).toLocaleString()}</td></tr>
                      <tr><td>Gratuity</td><td class="amount deduction">₹${(data.gratuity ?? 0).toLocaleString()}</td></tr>
                      <tr><td>Unpaid Absence</td><td class="amount deduction">₹${(data.deductionAmount ?? 0).toLocaleString()}</td></tr>
                      ${data.employee.isOnProbation ? `<tr><td>Probation Cut (50%)</td><td class="amount deduction">₹${((data.finalSalaryBeforeProbation ?? 0) - (data.finalSalary ?? 0)).toLocaleString()}</td></tr>` : ''}
                      <tr class="total-row"><td>Total Deductions</td><td class="amount">₹${((data.pf ?? 0) + (data.pt ?? 0) + (data.gratuity ?? 0) + (data.deductionAmount ?? 0)).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="summary-card">
                <span class="summary-label">Net Payable Amount</span>
                <span class="summary-value">₹${(data.totalPayableAmount ?? 0).toLocaleString()}</span>
              </div>

              <div class="footer">
                <p>This is a computer generated payslip and does not require a physical signature.</p>
                <div class="signature-grid">
                  <div class="sig-line">Employee Signature</div>
                  <div class="sig-line">Authorized Signatory</div>
                </div>
              </div>
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert("Failed to generate payslip.");
    } finally {
      setPrintingPayrollId(null);
    }
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
  const isPayrollFormValid = Boolean(form.employeeId && form.month && form.status);
  const visiblePayroll = useMemo(
    () => (role === "EMPLOYEE" ? payroll.filter((record) => record.status !== "DRAFT") : payroll),
    [payroll, role],
  );
  const previewTotalPayable = preview ? Number(preview.totalPayableAmount ?? 0) : 0;
  const previewNetBase = preview ? Number(preview.netBaseSalary ?? 0) : 0;

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
          <div className="grid payroll-form-grid payroll-form-grid--compact">
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
            <PayrollSelectField
              label="Status"
              value={form.status}
              options={payrollStatusOptions}
              required
              onChange={(value) => setForm({ ...form, status: value as PayrollFormValues["status"] })}
            />
          </div>
          {preview ? (
            <div className="payroll-preview-panel">
              <div className="payroll-preview-panel__top">
                <div className="payroll-preview-panel__headline">
                  <span className="table-cell-secondary">Total payable amount</span>
                  <strong className="payroll-preview-panel__final">₹{previewTotalPayable.toLocaleString()}</strong>
                </div>
                <div className="payroll-preview-panel__chip">
                  <span className="table-cell-secondary">Potential net salary</span>
                  <strong>₹{preview.netSalary.toLocaleString()}</strong>
                </div>
                {preview.employee.isOnProbation ? (
                  <span className="payroll-preview-tag">Probation (50% Pay)</span>
                ) : null}
              </div>

              <dl className="payroll-preview-panel__metrics">
                <div className="payroll-preview-panel__metric">
                  <dt>Total payable</dt>
                  <dd>₹{previewTotalPayable.toLocaleString()}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Net base salary</dt>
                  <dd>₹{previewNetBase.toLocaleString()}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Absent days</dt>
                  <dd>{preview.absentDeductionDays}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Half days</dt>
                  <dd>{preview.halfDayDeductionDays}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Deductible days</dt>
                  <dd>{preview.deductibleDays}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Deduction amount</dt>
                  <dd>{preview.deductionAmount}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>PF deduction</dt>
                  <dd>{preview.pf}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Gratuity deduction</dt>
                  <dd>{preview.gratuity}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>PT deduction</dt>
                  <dd>{preview.pt}</dd>
                </div>
                {preview.employee.isOnProbation ? (
                  <div className="payroll-preview-panel__metric">
                    <dt>Before probation</dt>
                    <dd>{preview.finalSalaryBeforeProbation}</dd>
                  </div>
                ) : null}
                <div className="payroll-preview-panel__metric">
                  <dt>Total incentives</dt>
                  <dd>₹{Number(preview.totalIncentives ?? 0).toLocaleString()}</dd>
                </div>
              </dl>

            </div>
          ) : null}
          {preview && editingPayrollId ? <p className="muted payroll-note">Preview is shown for reference only. The saved salary will stay unchanged unless you edit it.</p> : null}
          {previewLoading ? <p className="muted payroll-note">Refreshing payroll preview...</p> : null}
          
          {/* Incentive Breakdown */}
          {preview?.incentives && preview.incentives.length > 0 ? (
            <div className="card" style={{ marginTop: '2rem' }}>
              <div className="card__header">
                <h4>Incentive Breakdown</h4>
                <span className="eyebrow">{preview.incentives.length} incentive(s) included</span>
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
                    {preview.incentives.map((incentive) => (
                      <tr key={incentive.id}>
                        <td>{incentive.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                        <td className="amount">Rs {(incentive.amount ?? 0).toLocaleString()}</td>
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
          ) : (
            <div className="payroll-note muted" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              No active incentives found for this period.
            </div>
          )}
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
                            <button 
                              type="button" 
                              className="payroll-action-button" 
                              onClick={() => handleDownloadPayslip(record)}
                              disabled={printingPayrollId === record.id}
                            >
                              {printingPayrollId === record.id ? "Loading..." : "Download payslip"}
                            </button>
                          )}
                        </td>
                      ) : (
                        <td className="row-actions">
                          <button 
                            type="button" 
                            className="payroll-action-button" 
                            onClick={() => handleDownloadPayslip(record)}
                            disabled={printingPayrollId === record.id}
                          >
                            {printingPayrollId === record.id ? "Loading..." : "Download"}
                          </button>
                        </td>
                      )}
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
