import "./PayrollPage.css";
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Employee, PayrollRecord, Role } from "../../types";
import { ArrowLeft, Download } from "lucide-react";

type PayrollHistoryPageProps = {
  token: string | null;
  role: Role;
};

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

export default function PayrollHistoryPage({ token }: Omit<PayrollHistoryPageProps, "role">) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      // Fetch employee details first
      const empResponse = await apiRequest<Employee>(`/employees/${id}`, { token });
      if (empResponse.success) {
        setEmployee(empResponse.data);
      }

      // Fetch payroll records
      const response = await apiRequest<PayrollRecord[]>(`/payroll?employeeId=${id}`, { token });
      if (response.success) {
        const sorted = [...response.data].sort((a, b) => {
          const aKey = a.year * 100 + a.month;
          const bKey = b.year * 100 + b.month;
          return bKey - aKey;
        });
        setRecords(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch payroll history:", err);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function getMonthLabel(month: number | string) {
    return payrollMonthOptions.find((option) => option.value === String(month))?.label ?? String(month);
  }

  function getStatusClass(status: PayrollRecord["status"]) {
    return `status-pill status-pill--${status.toLowerCase()}`;
  }

  async function handleDownloadPayslip(record: PayrollRecord) {
    try {
      setPrintingId(record.id);
      const response = await apiRequest<any>(`/payroll/${record.id}/breakdown`, { token });
      const data = response.data;
      
      const printWindow = window.open('', '_blank', 'width=1000,height=900');
      if (!printWindow) return;

      const monthLabel = getMonthLabel(data.month);
      const grossSalary = (data.finalSalary ?? 0) + (data.totalIncentives ?? 0);
      const totalDeductions = (data.pf ?? 0) + (data.pt ?? 0) + (data.gratuity ?? 0) + (data.deductionAmount ?? 0);
      
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
                    <tr><td>Payable Days</td><td>${30 - (data.deductibleDays ?? 0)}</td></tr>
                    <tr><td>Basic Rate</td><td>${(data.basicMonthlySalary ?? 0).toLocaleString()}</td></tr>
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
                    <tr>
                      <td>Basic Salary</td>
                      <td class="amt">${(data.netSalary ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>Provident Fund</td>
                      <td class="amt">${(data.pf ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt" rowspan="10">${grossSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Basket Of Allowances</td>
                      <td class="amt">${(data.totalIncentives ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td>Profession Tax</td>
                      <td class="amt">${(data.pt ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Bonus/ Ex-Gratia</td>
                      <td class="amt">0.00</td>
                      <td>Gratuity</td>
                      <td class="amt">${(data.gratuity ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Annual Component</td>
                      <td class="amt">0.00</td>
                      <td>Unpaid Absence</td>
                      <td class="amt">${(data.deductionAmount ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr>
                      <td>Other Allowance</td>
                      <td class="amt">0.00</td>
                      <td></td>
                      <td class="amt"></td>
                    </tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    <tr><td></td><td class="amt"></td><td></td><td class="amt"></td></tr>
                    
                    <tr class="totals-row">
                      <td class="amt">Total</td>
                      <td class="amt">${grossSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt">Total</td>
                      <td class="amt">${totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td class="amt">${grossSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
      setPrintingId(null);
    }
  }

  return (
    <section className="stack">
      <div className="action-row" style={{ marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate("/payroll")} 
          className="payroll-action-button secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
        >
          <ArrowLeft size={18} />
          Back to Payroll
        </button>
      </div>

      <div className="card payroll-table-card">
        <div className="payroll-table-card__header">
          <div>
            <p className="eyebrow">Employee History</p>
            <h3>{employee ? `${employee.firstName} ${employee.lastName}` : "Loading..."}</h3>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading payroll history...</div>
        ) : (
          <div className="table-wrap">
            <table className="table table--dense">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{getMonthLabel(record.month)}</td>
                      <td>{record.year}</td>
                      <td>₹{Number(record.salary).toLocaleString()}</td>
                      <td>
                        <span className={getStatusClass(record.status)}>{record.status}</span>
                      </td>
                      <td>
                        <button 
                          className="payroll-action-button"
                          onClick={() => handleDownloadPayslip(record)}
                          disabled={printingId === record.id}
                        >
                          <Download size={16} style={{ marginRight: '0.5rem' }} />
                          {printingId === record.id ? "Loading..." : "Payslip"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No payroll records found for this employee.</td>
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
