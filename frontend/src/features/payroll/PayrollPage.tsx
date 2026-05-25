import "./PayrollPage.css";
import "../../components/common/Table.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Employee, PayrollRecord, Role } from "../../types";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import { Download, Eye } from "lucide-react";

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
  employee: Pick<Employee, "id" | "firstName" | "lastName" | "annualPackageLpa" | "grossMonthlySalary" | "basicMonthlySalary" | "isOnProbation" | "probationEndDate" | "joiningDate" | "department" | "jobTitle" | "panCardNumber" | "employmentType" | "internshipType" | "stipend">;
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
  basicMonthlySalary?: number;
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
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null);
  const [form, setForm] = useState<PayrollFormValues>(initialPayrollForm);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [printingPayrollId, setPrintingPayrollId] = useState<number | null>(null);
  const [previewingPayrollId, setPreviewingPayrollId] = useState<number | null>(null);
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

    toast.success(editingPayrollId ? "Payroll updated." : "Payroll created.");
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
    toast.success(`Payroll for ${record.employee?.firstName} finalized.`);
    await reloadData();
  }

  async function handleBatchGenerate() {
    const missingEmployees = employees.filter(emp => 
      !payroll.some(p => String(p.employeeId) === String(emp.id) && String(p.month) === currentViewMonth && String(p.year) === currentViewYear)
    );

    if (missingEmployees.length === 0) {
      toast.success("All employees already have payroll records for this month.");
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
    toast.success(`Successfully generated ${successCount} payroll records.`);
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

  async function handleDownloadPayslip(record: PayrollRecord, shouldPrint: boolean = false) {
    try {
      if (shouldPrint) {
        setPrintingPayrollId(record.id);
      } else {
        setPreviewingPayrollId(record.id);
      }
      const response = await apiRequest<PayrollPreview>(`/payroll/${record.id}/breakdown`, { token });
      const data = response.data;
      
      const printWindow = window.open('', '_blank', 'width=1000,height=900');
      if (!printWindow) return;

      const monthLabel = getMonthLabel(data.month);
      const daysInMonth = new Date(data.year, data.month, 0).getDate();
      const payableDays = daysInMonth - (data.deductibleDays ?? 0);

      const isIntern = data.employee?.employmentType === "INTERNSHIP";

      // Fixed compensation rates from employee profile
      const employeeGrossMonthly = data.employee?.grossMonthlySalary ?? 0;
      const employeeBasicMonthly = isIntern ? employeeGrossMonthly : (data.employee?.basicMonthlySalary ?? 0);
      const employeeAllowances = isIntern ? 0 : (employeeGrossMonthly - employeeBasicMonthly);

      // Monthly Earnings
      const basicEarned = employeeBasicMonthly;
      const allowancesEarned = employeeAllowances;
      const incentivesEarned = data.totalIncentives ?? 0;
      const totalEarnings = employeeGrossMonthly + incentivesEarned;

      // Monthly Deductions
      const pfDeduction = isIntern ? 0 : (data.pf ?? 0);
      const ptDeduction = isIntern ? 0 : (data.pt ?? 0);
      const gratuityDeduction = isIntern ? 0 : (data.gratuity ?? 0);
      const lwpDeduction = data.deductionAmount ?? 0;
      const probationAdjustment = isIntern ? 0 : (Math.round(((data.finalSalaryBeforeProbation ?? 0) * (1 - (data.probationMultiplier ?? 1)) + Number.EPSILON) * 100) / 100);

      const totalDeductions = pfDeduction + ptDeduction + gratuityDeduction + lwpDeduction + probationAdjustment;
      
      const printScript = shouldPrint ? `
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      ` : '';

      printWindow.document.write(`
        <html>
          <head>
            <title>Payslip - ${data.employee.firstName} - ${monthLabel} ${data.year}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
              body { font-family: 'Roboto', sans-serif; padding: 20px; color: #000; font-size: 12px; margin: 0; }
              .slip-wrapper { max-width: 900px; margin: 0 auto; }
              
              /* Header */
              .company-header { display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 10px; height: 60px; overflow: hidden; }
              .logo { display: flex; align-items: center; font-size: 32px; font-weight: 900; color: #333; font-style: italic; letter-spacing: 2px; }
              .logo span { color: #f99f1b; }
              .logo img { height: 60px; object-fit: contain; }
              .header-shapes { display: flex; align-items: stretch; gap: 8px; width: 45%; justify-content: flex-end; transform: translateX(20px); }
              .shape-orange { background: #f99f1b; width: 30px; transform: skewX(-30deg); }
              .shape-black { background: #000; width: 60px; transform: skewX(-30deg); }
              .shape-orange-wide { background: #f99f1b; flex-grow: 1; transform: skewX(-30deg); margin-right: -40px; }
              
              /* Main Box */
              .slip-box { border: 1px solid #000; margin-bottom: 20px; }
              .slip-title { text-align: center; color: #000080; font-size: 16px; font-weight: bold; padding: 8px; border-bottom: 1px solid #000; }
              
              /* Info Grid */
              .info-grid { display: grid; grid-template-columns: 60% 40%; border-bottom: 1px solid #000; }
              .info-table { width: 100%; border-collapse: collapse; }
              .info-table td { padding: 4px 8px; vertical-align: top; }
              .info-table td:first-child { font-weight: 500; width: 110px; }
              .right-info { border-left: 1px solid #000; }
              
              /* Salary Table */
              .salary-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              .salary-table th { font-weight: 500; text-align: center; padding: 6px; border-bottom: 2px solid #d32f2f; border-left: 1px solid #000; }
              .salary-table th:first-child { border-left: none; }
              .salary-table td { padding: 4px 8px; border-left: 1px solid #000; vertical-align: top; height: 18px; }
              .salary-table td:first-child { border-left: none; }
              .amt { text-align: right; }
              .bold { font-weight: bold; }
              
              .totals-row td { border-top: 1px solid #000; padding: 6px 8px; font-weight: bold; }
              .net-pay-row td { border-top: 1px solid #000; padding: 8px; border-bottom: 1px solid #000; }
              
              .stamp-row td { height: 90px; position: relative; border-left: 1px solid #000; }
              .stamp-row td:first-child { border-left: none; }
              .stamp-container { position: relative; }
              .stamp-img { position: absolute; right: 30px; bottom: 5px; height: 120px; width: auto; opacity: 0.9; transform: rotate(-12deg); }
              
              /* Bottom Footer */
              .bottom-footer { display: flex; justify-content: space-between; font-size: 12px; margin-top: 10px; padding: 0 10px; }
              .footer-item { display: flex; align-items: center; gap: 8px; font-weight: 500; }
              .footer-icon { background: #f99f1b; color: #fff; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 14px; border-radius: 2px; }
              
              .bottom-shapes { display: flex; height: 50px; margin-top: 20px; overflow: hidden; justify-content: center; gap: 15px; background: #fff; padding-top: 20px;}
              .b-shape { background: #f99f1b; transform: skewX(-40deg); height: 100%; width: 100px; }
              .b-shape.black { background: #000; width: 60px; }
              .b-shape.wide { width: 300px; }
              
              @media print {
                body { padding: 0; -webkit-print-color-adjust: exact; color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="slip-wrapper">
              <div class="company-header">
                <div class="logo">INTELLISYS<span>.</span></div>
                <div class="header-shapes">
                  <div class="shape-orange"></div>
                  <div class="shape-black"></div>
                  <div class="shape-orange-wide"></div>
                </div>
              </div>
              
              <div class="slip-box">
                <div class="slip-title">Pay Slip for ${monthLabel} ${data.year}</div>
                
                <div class="info-grid">
                  <table class="info-table">
                    <tr><td>Emp No</td><td>EM-00${data.employee.id}</td></tr>
                    <tr><td>Name</td><td class="bold">${data.employee.firstName} ${data.employee.lastName}</td></tr>
                    <tr><td>Department</td><td>${data.employee.department?.name || 'Engineering'}</td></tr>
                    <tr><td>Location</td><td>PUNE</td></tr>
                    <tr><td>Bank Name</td><td>HDFC Bank</td></tr>
                    <tr><td>Bank A/c No</td><td>XXXXXXXXXX1234</td></tr>
                    <tr><td>Designation</td><td>${data.employee.jobTitle || 'Software Developer'}</td></tr>
                  </table>
                  <table class="info-table right-info">
                    <tr><td>Payable Days</td><td>${payableDays}</td></tr>
                    <tr><td>${isIntern ? 'Stipend Rate' : 'Basic Rate'}</td><td>${employeeBasicMonthly.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>
                    <tr><td>PAN</td><td class="bold">${data.employee.panCardNumber || 'Not Provided'}</td></tr>
                    <tr><td>UAN</td><td class="bold">101XXXXXXXXX</td></tr>
                  </table>
                </div>
                
                <table class="salary-table">
                  <thead>
                    <tr>
                      <th style="width:30%;">Earning</th>
                      <th style="width:15%;">Current Month</th>
                      <th style="width:25%;">Deduction</th>
                      <th style="width:15%;">Current Month</th>
                      <th style="width:15%;">Total Gross Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${isIntern ? `
                    <tr>
                      <td>Stipend</td>
                      <td class="amt">${basicEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>Unpaid Absence</td>
                      <td class="amt">${lwpDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt" rowspan="10">${totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Other Allowance</td>
                      <td class="amt">${incentivesEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td></td>
                      <td class="amt"></td>
                    </tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    ` : `
                    <tr>
                      <td>Basic Salary</td>
                      <td class="amt">${basicEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>Provident Fund</td>
                      <td class="amt">${pfDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt" rowspan="10">${totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Basket Of Allowances</td>
                      <td class="amt">${allowancesEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>Profession Tax</td>
                      <td class="amt">${ptDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Bonus/ Ex-Gratia</td>
                      <td class="amt">0.00</td>
                      <td>Gratuity</td>
                      <td class="amt">${gratuityDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Annual Component</td>
                      <td class="amt">0.00</td>
                      <td>Unpaid Absence</td>
                      <td class="amt">${lwpDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Other Allowance</td>
                      <td class="amt">${incentivesEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>${probationAdjustment > 0 ? 'Probation Adjustment' : ''}</td>
                      <td class="amt">${probationAdjustment > 0 ? probationAdjustment.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
                    </tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    `}
                    
                    <tr class="totals-row">
                      <td class="amt">Total</td>
                      <td class="amt">${totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt">Total</td>
                      <td class="amt">${totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt">${totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr class="net-pay-row">
                      <td class="bold">Net Pay : Rs.</td>
                      <td class="amt bold">${(data.totalPayableSalary ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td colspan="3" style="font-style: italic;">Rupees (Auto Generated Amount) Only</td>
                    </tr>
                    
                    <tr class="stamp-row">
                      <td colspan="2"></td>
                      <td colspan="3" class="stamp-container">
                        <img class="stamp-img" src="/assets/images/stamp.png" alt="Authorized Signatory Stamp" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="bottom-footer">
                <div class="footer-item">
                  <div class="footer-icon">✉</div>
                  <span>info@intellisysitsolutions.com</span>
                </div>
                <div class="footer-item">
                  <div class="footer-icon">📍</div>
                  <span>Office no: 328-B, Gera Imperium Rise, Wipro circle, Hinjewadi phase 2, Pune-411057</span>
                </div>
              </div>
              
              <div class="bottom-shapes">
                <div class="b-shape wide"></div>
                <div class="b-shape black"></div>
                <div class="b-shape"></div>
                <div class="b-shape black"></div>
              </div>
            </div>
            
            ${printScript}
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate payslip.");
    } finally {
      setPrintingPayrollId(null);
      setPreviewingPayrollId(null);
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
                {preview.employee?.isOnProbation ? (
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
                {preview.employee?.isOnProbation ? (
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
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                type="button" 
                                className="payroll-action-button"
                                style={{ background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.15)', color: '#4b5563' }}
                                onClick={() => handleDownloadPayslip(record, false)}
                                disabled={previewingPayrollId === record.id || printingPayrollId === record.id}
                              >
                                <Eye size={16} style={{ marginRight: '0.25rem', display: 'inline-block', verticalAlign: 'middle' }} />
                                <span style={{ verticalAlign: 'middle' }}>{previewingPayrollId === record.id ? "Loading..." : "Preview"}</span>
                              </button>
                              <button 
                                type="button" 
                                className="payroll-action-button"
                                onClick={() => handleDownloadPayslip(record, true)}
                                disabled={previewingPayrollId === record.id || printingPayrollId === record.id}
                              >
                                <Download size={16} style={{ marginRight: '0.25rem', display: 'inline-block', verticalAlign: 'middle' }} />
                                <span style={{ verticalAlign: 'middle' }}>{printingPayrollId === record.id ? "Loading..." : "Download"}</span>
                              </button>
                            </div>
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
