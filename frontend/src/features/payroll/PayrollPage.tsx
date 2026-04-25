import "./PayrollPage.css";
import "../../components/common/Table.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Employee, PayrollRecord, Role } from "../../types";
import Modal from "../../components/common/Modal";

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
  totalIncentives: number;
  totalPayableSalary: number;
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
  menuAlign?: "left" | "right";
};

function PayrollSelectField({ label, value, options, onChange, placeholder = "Select an option", required = false, menuAlign = "left" }: PayrollSelectFieldProps) {
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
          <div className={`payroll-select__menu payroll-select__menu--${menuAlign}`} role="listbox" id={listboxId} aria-labelledby={triggerId}>
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
  const navigate = useNavigate();
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [message, setMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null);
  const [form, setForm] = useState<PayrollFormValues>(initialPayrollForm);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [printingPayrollId, setPrintingPayrollId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [currentViewMonth, setCurrentViewMonth] = useState(String(new Date().getMonth() + 1));
  const [currentViewYear, setCurrentViewYear] = useState(String(new Date().getFullYear()));

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
              current.salary === String(response.data.totalPayableSalary)
                ? current
                : { ...current, salary: String(response.data.totalPayableSalary) },
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
    const effectiveSalary = Number(form.salary || preview?.totalPayableSalary || 0);
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
    setModalOpen(false);
    await reloadData();
  }

  async function handleQuickFinalize(record: PayrollRecord) {
    if (!window.confirm(`Are you sure you want to finalize payroll for ${record.employee?.firstName}?`)) return;
    
    await apiRequest(`/payroll/${record.id}`, {
      method: "PUT",
      token,
      body: { status: "FINALIZED" }
    });
    setMessage(`Payroll for ${record.employee?.firstName} finalized.`);
    await reloadData();
  }

  async function handleBatchGenerate() {
    const missingEmployees = employees.filter(emp => 
      !payroll.some(p => String(p.employeeId) === String(emp.id) && String(p.month) === currentViewMonth && String(p.year) === currentViewYear)
    );

    if (missingEmployees.length === 0) {
      setMessage("All employees already have payroll records for this month.");
      return;
    }

    if (!window.confirm(`Generate draft payroll records for ${missingEmployees.length} employees?`)) return;

    setLoading(true);
    let successCount = 0;
    for (const emp of missingEmployees) {
      try {
        await apiRequest("/payroll", {
          method: "POST",
          token,
          body: {
            employeeId: emp.id,
            month: Number(currentViewMonth),
            year: Number(currentViewYear),
            status: "DRAFT"
          }
        });
        successCount++;
      } catch (err) {
        console.error(`Failed for ${emp.firstName}`);
      }
    }
    setMessage(`Successfully generated ${successCount} payroll records.`);
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
    setModalOpen(true);
  }

  function cancelEdit() {
    setEditingPayrollId(null);
    setForm(initialPayrollForm());
    setPreview(null);
    setModalOpen(false);
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
                      <tr class="total-row"><td>Gross Earnings</td><td class="amount">₹${((data.finalSalary ?? 0) + (data.totalIncentives ?? 0)).toLocaleString()}</td></tr>
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
                <span class="summary-label">Total Payable Salary</span>
                <span class="summary-value">₹${(data.totalPayableSalary ?? 0).toLocaleString()}</span>
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
  
  const filteredPayroll = useMemo(() => {
    let base = role === "EMPLOYEE" ? payroll.filter((record) => record.status !== "DRAFT") : payroll;
    if (currentViewMonth && currentViewYear) {
      base = base.filter(r => String(r.month) === currentViewMonth && String(r.year) === currentViewYear);
    }
    return base;
  }, [payroll, role, currentViewMonth, currentViewYear]);

  const previewTotalPayable = preview ? Number(preview.totalPayableSalary ?? 0) : 0;
  const previewTargetNet = preview ? Number(preview.netSalary ?? 0) : 0;
 
  return (
    <section className="stack">
      {message ? <p className="success-text">{message}</p> : null}
      
      <Modal open={modalOpen} title={editingPayrollId ? "Update payroll record" : "Create payroll record"} onClose={cancelEdit}>
        <form className="stack compact-form" onSubmit={handleSubmit}>
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
              menuAlign="right"
              onChange={(value) => setForm({ ...form, status: value as PayrollFormValues["status"] })}
            />
          </div>
          {preview ? (
            <div className="payroll-preview-panel">
              <div className="payroll-preview-panel__top">
                <div className="payroll-preview-panel__headline">
                  <span className="table-cell-secondary">Total Payable Salary</span>
                  <strong className="payroll-preview-panel__final">₹{previewTotalPayable.toLocaleString()}</strong>
                </div>
                <div className="payroll-preview-panel__chip">
                  <span className="table-cell-secondary">Monthly Net Salary</span>
                  <strong>₹{previewTargetNet.toLocaleString()}</strong>
                </div>
                {preview.employee.isOnProbation ? (
                  <span className="payroll-preview-tag">Probation (50% Pay)</span>
                ) : null}
              </div>
 
              <dl className="payroll-preview-panel__metrics">
                <div className="payroll-preview-panel__metric">
                  <dt>Final Payout</dt>
                  <dd>₹{previewTotalPayable.toLocaleString()}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Attendance Deduction</dt>
                  <dd>₹{(preview?.deductionAmount ?? 0).toLocaleString()}</dd>
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
                  <dt>PF Deduction</dt>
                  <dd>₹{Number(preview.pf ?? 0).toLocaleString()}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Gratuity</dt>
                  <dd>₹{Number(preview.gratuity ?? 0).toLocaleString()}</dd>
                </div>
                <div className="payroll-preview-panel__metric">
                  <dt>Professional Tax (PT)</dt>
                  <dd>₹{Number(preview.pt ?? 0).toLocaleString()}</dd>
                </div>
                {preview.employee.isOnProbation ? (
                  <div className="payroll-preview-panel__metric">
                    <dt>Before probation</dt>
                    <dd>₹{Number(preview.finalSalaryBeforeProbation ?? 0).toLocaleString()}</dd>
                  </div>
                ) : null}
                <div className="payroll-preview-panel__metric">
                  <dt>Total incentives</dt>
                  <dd>₹{Number(preview.totalIncentives ?? 0).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          {previewLoading ? <p className="muted payroll-note">Refreshing payroll preview...</p> : null}
          
          {preview?.incentives && preview.incentives.length > 0 ? (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card__header">
                <h4>Incentive Breakdown</h4>
                <span className="eyebrow">{preview.incentives.length} incentive(s)</span>
              </div>
              <div className="table-wrap">
                <table className="table table--dense">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.incentives.map((incentive) => (
                      <tr key={incentive.id}>
                        <td>{incentive.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                        <td className="amount">Rs {(incentive.amount ?? 0).toLocaleString()}</td>
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
            <button type="button" className="secondary payroll-action-button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
 
      <div className="card dense-table-card payroll-table-card">
        <div className="payroll-table-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">Payroll Overview</p>
            <h3>{getMonthLabel(currentViewMonth)} {currentViewYear}</h3>
          </div>
          
          <div className="filter-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <PayrollSelectField 
                label="" 
                value={currentViewMonth} 
                options={monthOptions} 
                onChange={setCurrentViewMonth} 
              />
              <PayrollSelectField 
                label="" 
                value={currentViewYear} 
                options={[{value: '2025', label: '2025'}, {value: '2026', label: '2026'}]} 
                onChange={setCurrentViewYear} 
              />
            </div>
            {(role === "ADMIN" || role === "HR") ? (
              <button type="button" className="payroll-action-button payroll-action-button--primary" onClick={() => setModalOpen(true)}>
                Create record
              </button>
            ) : null}
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
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Finalize</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayroll.length ? (
                  filteredPayroll.map((record) => (
                    <tr key={record.id} style={{ cursor: 'pointer' }} onClick={() => record.employeeId && navigate(`/payroll/history/${record.employeeId}`)}>
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
                      <td>₹{Number(record.salary).toLocaleString()}</td>
                      <td>
                        <span className={getStatusClass(record.status)}>{record.status}</span>
                      </td>
                      <td>
                        {(role === "ADMIN" || role === "HR") && record.status === "DRAFT" ? (
                          <button 
                            type="button" 
                            className="payroll-action-button" 
                            style={{ background: '#ecfdf5', color: '#059669', borderColor: '#d1fae5', width: '100%', justifyContent: 'center' }} 
                            onClick={(e) => { e.stopPropagation(); handleQuickFinalize(record); }}
                          >
                            Finalize
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {(role === "ADMIN" || role === "HR") && record.status === "DRAFT" && (
                            <button type="button" className="payroll-action-button payroll-action-button--primary" onClick={() => startPayrollEdit(record)}>
                              Edit
                            </button>
                          )}
                          {record.status === "FINALIZED" && (
                            <button 
                              type="button" 
                              className="payroll-action-button" 
                              onClick={() => handleDownloadPayslip(record)}
                              disabled={printingPayrollId === record.id}
                            >
                              {printingPayrollId === record.id ? "Loading..." : "Payslip"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                      <p style={{ color: '#64748b', marginBottom: '1rem' }}>No records found for this month.</p>
                      {(role === "ADMIN" || role === "HR") && (
                        <button 
                          type="button" 
                          className="link-button" 
                          style={{ color: '#2563eb', fontWeight: '600', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
                          onClick={handleBatchGenerate}
                        >
                          Generate for all employees
                        </button>
                      )}
                    </td>
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
