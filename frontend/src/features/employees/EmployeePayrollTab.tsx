import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { apiRequest } from "../../services/api";
import Table from "../../components/common/Table";
import type { PayrollRecord } from "../../types";

type EmployeePayrollTabProps = {
  payroll: PayrollRecord[];
  token: string | null;
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

export default function EmployeePayrollTab({ payroll, token }: EmployeePayrollTabProps) {
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const latestPayroll = payroll[0];
  const finalizedCount = payroll.filter((record) => record.status === "FINALIZED").length;
  const draftCount = payroll.filter((record) => record.status === "DRAFT").length;

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

  function getMonthLabel(month: number | string) {
    return payrollMonthOptions.find((option) => option.value === String(month))?.label ?? String(month);
  }

  async function handleDownloadPayslip(record: PayrollRecord, shouldPrint: boolean = false) {
    try {
      if (shouldPrint) {
        setPrintingId(record.id);
      } else {
        setPreviewingId(record.id);
      }
      const response = await apiRequest<any>(`/payroll/${record.id}/breakdown`, { token });
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
      alert("Failed to generate payslip.");
    } finally {
      setPrintingId(null);
      setPreviewingId(null);
    }
  }

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
            columns={["Period", "Salary", "Status", "Action"]}
            rows={payroll.map((record) => [
              <div className="table-cell-stack" key={`period-${record.id}`}>
                <span className="table-cell-primary">{formatMonthYear(record.month, record.year)}</span>
                <span className="table-cell-secondary">{`${record.month}/${record.year}`}</span>
              </div>,
              record.salary ? `₹${Number(record.salary).toLocaleString()}` : "—",
              <span key={`status-${record.id}`} className={getStatusClass(record.status)}>
                {record.status}
              </span>,
              <div key={`action-${record.id}`} style={{ display: "flex", gap: "8px" }}>
                {record.status === "FINALIZED" ? (
                  <>
                    <button
                      onClick={() => handleDownloadPayslip(record, false)}
                      disabled={previewingId === record.id || printingId === record.id}
                      className="btn btn--dense btn--secondary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: "rgba(107, 114, 128, 0.08)",
                        border: "1px solid rgba(107, 114, 128, 0.15)",
                        color: "#4b5563",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Eye size={14} />
                      <span>{previewingId === record.id ? "Loading..." : "Preview"}</span>
                    </button>
                    <button
                      onClick={() => handleDownloadPayslip(record, true)}
                      disabled={previewingId === record.id || printingId === record.id}
                      className="btn btn--dense btn--primary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: "rgba(37, 99, 235, 0.08)",
                        border: "1px solid rgba(37, 99, 235, 0.15)",
                        color: "#2563eb",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Download size={14} />
                      <span>{printingId === record.id ? "Loading..." : "Download"}</span>
                    </button>
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: "12px" }}>—</span>
                )}
              </div>,
            ])}
          />
        </div>
      </div>
    </div>
  );
}
