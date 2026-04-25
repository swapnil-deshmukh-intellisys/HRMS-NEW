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

export default function PayrollHistoryPage({ token, role }: PayrollHistoryPageProps) {
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
              .total-row { background: #f9fafb; font-weight: 700 !important; border-top: 2px solid #e5e7eb; }
              .summary-card { background: #7c3aed; color: white; padding: 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 40px; }
              .summary-value { font-size: 32px; font-weight: 700; }
              .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; }
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
                <div class="company-info"><h1>HRMS</h1><p>INTELLISYS TECHNOLOGIES</p></div>
                <div class="slip-title"><h2>PAYSLIP</h2><p>${monthLabel} ${data.year}</p></div>
              </div>
              <div class="info-grid">
                <div class="info-section">
                  <h3>Employee Details</h3>
                  <div class="info-item"><span class="info-label">Name</span> <span class="info-value">${data.employee.firstName} ${data.employee.lastName}</span></div>
                </div>
                <div class="info-section">
                  <h3>Pay Details</h3>
                  <div class="info-item"><span class="info-label">Employee Code</span> <span class="info-value">EM-00${data.employee.id}</span></div>
                </div>
              </div>
              <div class="tables-container">
                <div class="earning-side">
                  <table>
                    <thead><tr><th>Earnings</th><th class="amount">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Basic Salary</td><td class="amount">₹${data.netSalary}</td></tr>
                      <tr class="total-row"><td>Gross Earnings</td><td class="amount">₹${((data.finalSalary ?? 0) + (data.totalIncentives ?? 0)).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="deduction-side">
                  <table>
                    <thead><tr><th>Deductions</th><th class="amount">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Total Deductions</td><td class="amount">₹${((data.pf ?? 0) + (data.pt ?? 0) + (data.gratuity ?? 0) + (data.deductionAmount ?? 0)).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="summary-card"><span>Total Payable</span><span class="summary-value">₹${(data.totalPayableSalary ?? 0).toLocaleString()}</span></div>
            </div>
            <script>window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 500); }, 500); };</script>
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
