import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Attendance, Employee } from "../../types";
import MessageCard from "../../components/common/MessageCard";
import { ArrowLeft, Mail, Database, Calendar } from "lucide-react";
import { formatDateLabel } from "../../utils/format";

type OutlookEmail = {
  id: number;
  name: string;
  email: string;
  client?: {
    id: number;
    name: string;
    code: string;
  };
};

type ParsedReportRow = {
  date: string;
  dataExtracted: number;
  mailsSent: number;
  manualUpdate: string;
};

export default function EmployeeOutlookDetailPage({ token }: { token: string | null }) {
  const { employeeId, emailId } = useParams<{ employeeId: string; emailId: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!employeeId || !token) return;
    try {
      setLoading(true);
      setError(null);
      const [empResponse, attResponse] = await Promise.all([
        apiRequest<Employee>(`/employees/${employeeId}`, { token }),
        apiRequest<Attendance[]>(`/attendance?employeeId=${employeeId}`, { token })
      ]);

      setEmployee(empResponse.data);
      setAttendance(attResponse.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load employee outlook data.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, token]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  // Find the specific outlook email identity
  const activeOutlookEmail = useMemo<OutlookEmail | null>(() => {
    if (!employee || !emailId) return null;
    const emails: OutlookEmail[] = (employee as any).outlookEmails || [];
    return emails.find((e) => String(e.id) === String(emailId)) ?? null;
  }, [employee, emailId]);

  // Parse check-out reports dynamically
  const reportData = useMemo(() => {
    if (!activeOutlookEmail || attendance.length === 0) return { rows: [], totalData: 0, totalMails: 0 };

    const emailName = activeOutlookEmail.name;

    let totalData = 0;
    let totalMails = 0;
    const rows: ParsedReportRow[] = [];

    // Filter attendance records with check-out logs and sort by date descending
    const sortedAttendance = [...attendance]
      .filter((record) => record.checkOutTime && record.todaysUpdate)
      .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime());

    for (const record of sortedAttendance) {
      const updateText = record.todaysUpdate || "";
      
      // Look for the [SUPPORT UPDATE] block
      // Schema formatting example: [SUPPORT UPDATE] Outlook Details: [Dhanashree (TUT): Data: 12, Mails: 23]
      if (updateText.includes("[SUPPORT UPDATE]")) {
        // Regex to parse the metrics matching the active shared identity email name
        // Example matches: "Dhanashree (TUT): Data: 12, Mails: 23"
        // We match case-insensitive for robustness
        const escapedName = emailName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const pattern = new RegExp(
          `${escapedName}\\s*\\([^)]*\\):\\s*Data:\\s*(\\d+),\\s*Mails:\\s*(\\d+)`,
          'i'
        );

        const match = updateText.match(pattern);
        if (match) {
          const dataExtracted = parseInt(match[1], 10) || 0;
          const mailsSent = parseInt(match[2], 10) || 0;

          totalData += dataExtracted;
          totalMails += mailsSent;

          // Strip the [SUPPORT UPDATE] prefix from the display text for manual update
          // This keeps the context view beautiful and readable
          let manualUpdate = updateText.replace(/\[SUPPORT UPDATE\].*?\n?/gi, "").trim();
          
          rows.push({
            date: record.attendanceDate,
            dataExtracted,
            mailsSent,
            manualUpdate: manualUpdate || "No additional description provided."
          });
        }
      }
    }

    return { rows, totalData, totalMails };
  }, [activeOutlookEmail, attendance]);

  if (loading) {
    return (
      <section className="stack">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="secondary" onClick={() => navigate(-1)} style={{ borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div className="skeleton-line skeleton-line--title" style={{ width: '250px' }} />
        </div>
        <div className="grid cols-2" style={{ gap: '1rem', marginTop: '1rem' }}>
          <div className="card" style={{ height: '120px' }}>
            <span className="skeleton-line skeleton-line--long" />
          </div>
          <div className="card" style={{ height: '120px' }}>
            <span className="skeleton-line skeleton-line--long" />
          </div>
        </div>
        <div className="card" style={{ height: '300px', marginTop: '1.5rem' }}>
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
        </div>
      </section>
    );
  }

  if (error || !employee || !activeOutlookEmail) {
    return (
      <section className="stack">
        <button className="secondary" onClick={() => navigate(-1)} style={{ width: 'fit-content', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
          <ArrowLeft size={16} /> Back to Team
        </button>
        <MessageCard
          title="Outlook Report Error"
          tone="error"
          message={error || "Outlook shared identity not found or not assigned to this employee."}
        />
      </section>
    );
  }

  return (
    <section className="stack" style={{ gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          className="secondary" 
          onClick={() => navigate('/team?tab=OUTLOOK')} 
          style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
          title="Back to Outlook Distribution"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Outlook Identity Reports</p>
          <h2 style={{ margin: 0, fontWeight: '800', color: 'var(--color-text-strong)' }}>
            {employee.firstName} {employee.lastName}
          </h2>
        </div>
        <span 
          className="status-pill" 
          style={{ 
            marginLeft: 'auto',
            background: activeOutlookEmail.client?.code === 'TEC' ? '#ecfdf5' : '#f1f5f9', 
            color: activeOutlookEmail.client?.code === 'TEC' ? '#065f46' : '#475569',
            fontSize: '12px',
            padding: '6px 12px',
            fontWeight: '600'
          }}
        >
          {activeOutlookEmail.name} ({activeOutlookEmail.client?.code})
        </span>
      </div>

      {/* Stats Cards Section */}
      <div className="grid cols-2" style={{ gap: '1.5rem' }}>
        <article className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #ffffff, #f8fafc)', border: '1px solid var(--color-border-default)' }}>
          <div style={{ background: '#eff6ff', color: '#2563eb', padding: '1rem', borderRadius: '12px' }}>
            <Mail size={24} />
          </div>
          <div>
            <p className="eyebrow" style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>Total Mails Sent</p>
            <strong style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>
              {reportData.totalMails.toLocaleString()}
            </strong>
          </div>
        </article>

        <article className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #ffffff, #f8fafc)', border: '1px solid var(--color-border-default)' }}>
          <div style={{ background: '#ecfdf5', color: '#059669', padding: '1rem', borderRadius: '12px' }}>
            <Database size={24} />
          </div>
          <div>
            <p className="eyebrow" style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>Total Data Extracted</p>
            <strong style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>
              {reportData.totalData.toLocaleString()}
            </strong>
          </div>
        </article>
      </div>

      {/* Logs Table */}
      <div className="card dense-table-card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontWeight: '700', color: 'var(--color-text-primary)' }}>Daily Checkout Submissions</h4>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>Parsed from the employee's check-out logs.</p>
          </div>
          <span className="eyebrow" style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
            {reportData.rows.length} logs
          </span>
        </div>

        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Date</th>
                <th style={{ width: '15%' }}>Mails Sent</th>
                <th style={{ width: '15%' }}>Data Extracted</th>
                <th style={{ width: '55%' }}>Update Context</th>
              </tr>
            </thead>
            <tbody>
              {reportData.rows.length ? (
                reportData.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}>
                        <Calendar size={14} className="muted" />
                        {formatDateLabel(row.date)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: '#2563eb' }}>{row.mailsSent}</span> mails
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: '#059669' }}>{row.dataExtracted}</span> items
                    </td>
                    <td>
                      <div className="table-cell-stack" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#475569', lineHeight: '1.5' }}>
                        {row.manualUpdate}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="table-empty-state" style={{ background: 'none', border: 'none', padding: 0, boxShadow: 'none' }}>
                      <strong style={{ display: 'block', fontSize: '15px', color: '#475569', marginBottom: '0.25rem' }}>No checkout logs recorded</strong>
                      <span className="table-cell-secondary" style={{ fontSize: '13px' }}>
                        Support metrics for this Outlook identity will appear here once the employee submits them at checkout.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
