import "./PayrollPage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../../services/api";
import type { Employee, Incentive, IncentiveType, IncentiveStatus, Role } from "../../types";

type IncentivesPageProps = {
  token: string | null;
  role: Role;
};

type IncentiveFormValues = {
  employeeId: string;
  type: IncentiveType;
  amount: string;
  reason: string;
  description: string;
  month: string;
  year: string;
};

type IncentiveReviewValues = {
  status: "APPROVED" | "REJECTED";
  rejectionReason: string;
};

const initialIncentiveForm = (): IncentiveFormValues => ({
  employeeId: "",
  type: "PERFORMANCE_BONUS",
  amount: "",
  reason: "",
  description: "",
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
});

const incentiveTypeOptions: Array<{ value: IncentiveType; label: string; description: string }> = [
  { value: "PERFORMANCE_BONUS", label: "Performance Bonus", description: "For outstanding performance" },
  { value: "PROJECT_BONUS", label: "Project Bonus", description: "For project completion or milestones" },
  { value: "REFERRAL_BONUS", label: "Referral Bonus", description: "For successful employee referrals" },
  { value: "ATTENDANCE_BONUS", label: "Attendance Bonus", description: "For perfect attendance" },
  { value: "SPECIAL_ACHIEVEMENT", label: "Special Achievement", description: "For special accomplishments" },
  { value: "OTHER", label: "Other", description: "Other types of incentives" },
];

const incentiveStatusColors: Record<IncentiveStatus, string> = {
  PENDING: "rgb(234, 179, 8)",
  APPROVED: "rgb(34, 197, 94)",
  REJECTED: "rgb(239, 68, 68)",
  PAID: "rgb(59, 130, 246)",
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

function IncentivesPage({ token, role }: IncentivesPageProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<IncentiveFormValues>(initialIncentiveForm());
  const [reviewFormValues, setReviewFormValues] = useState<IncentiveReviewValues>({
    status: "APPROVED",
    rejectionReason: "",
  });
  const [selectedIncentive, setSelectedIncentive] = useState<Incentive | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [incentiveSummary, setIncentiveSummary] = useState<any>(null);

  const canCreateIncentive = role === "ADMIN" || role === "HR";
  const canReviewIncentive = role === "ADMIN" || role === "HR" || role === "MANAGER";

  // Fetch employees (for dropdown)
  const fetchEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiRequest("/employees", { token });
      if (response.success) {
        setEmployees(response.data as Employee[]);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, [token]);

  // Fetch incentives
  const fetchIncentives = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterEmployeeId) queryParams.append("employeeId", filterEmployeeId);
      if (filterMonth) queryParams.append("month", filterMonth);
      if (filterYear) queryParams.append("year", filterYear);

      const response = await apiRequest(`/payroll/incentives?${queryParams}`, { token });
      if (response.success) {
        setIncentives(response.data as Incentive[]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch incentives");
    } finally {
      setLoading(false);
    }
  }, [token, filterEmployeeId, filterMonth, filterYear]);

  // Fetch incentive summary for current user
  const fetchIncentiveSummary = useCallback(async () => {
    if (!token) return;
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Get current employee ID if role is EMPLOYEE
      let employeeId = "";
      if (role === "EMPLOYEE") {
        const userResponse = await apiRequest("/auth/me", { token });
        if (userResponse.success && (userResponse.data as any).employeeId) {
          employeeId = (userResponse.data as any).employeeId.toString();
        }
      }

      if (employeeId) {
        const response = await apiRequest(
          `/payroll/incentives/summary/${employeeId}/${currentMonth}/${currentYear}`,
          { token }
        );
        if (response.success) {
          setIncentiveSummary(response.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch incentive summary:", err);
    }
  }, [token, role]);

  // Create incentive
  const handleCreateIncentive = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        employeeId: Number(formValues.employeeId),
        type: formValues.type,
        amount: Number(formValues.amount),
        reason: formValues.reason.trim(),
        description: formValues.description.trim() || undefined,
        month: Number(formValues.month),
        year: Number(formValues.year),
      };

      const response = await apiRequest("/payroll/incentives", { method: "POST", body: payload, token });
      if (response.success) {
        setSuccess("Incentive created successfully!");
        setFormValues(initialIncentiveForm());
        setActiveTab("list");
        fetchIncentives();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create incentive");
    } finally {
      setLoading(false);
    }
  };

  // Review incentive
  const handleReviewIncentive = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !selectedIncentive) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        status: reviewFormValues.status,
        rejectionReason: reviewFormValues.status === "REJECTED" ? reviewFormValues.rejectionReason.trim() : undefined,
      };

      const response = await apiRequest(`/payroll/incentives/${selectedIncentive.id}/review`, { method: "POST", body: payload, token });
      if (response.success) {
        setSuccess(`Incentive ${reviewFormValues.status.toLowerCase()} successfully!`);
        setShowReviewModal(false);
        setSelectedIncentive(null);
        setReviewFormValues({ status: "APPROVED", rejectionReason: "" });
        fetchIncentives();
      }
    } catch (err: any) {
      setError(err.message || "Failed to review incentive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchIncentives();
    if (role === "EMPLOYEE") {
      fetchIncentiveSummary();
    }
  }, [fetchEmployees, fetchIncentives, fetchIncentiveSummary, role]);

  const employeeOptions = useMemo(() => {
    return employees.map((emp) => ({
      value: emp.id.toString(),
      label: `${emp.firstName} ${emp.lastName}`,
      hint: emp.jobTitle || emp.employeeCode,
    }));
  }, [employees]);

  return (
    <div className="payroll-page">
      <div className="page-header">
        <h1>Incentives Management</h1>
        {incentiveSummary && (
          <div className="incentive-summary">
            <div className="summary-card">
              <h3>This Month's Incentives</h3>
              <div className="summary-amount">Rs {incentiveSummary.totalIncentives.toLocaleString()}</div>
              <div className="summary-details">
                <span>{incentiveSummary.approvedIncentives} approved</span>
                {incentiveSummary.pendingIncentives > 0 && (
                  <span>{incentiveSummary.pendingIncentives} pending</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          Incentives List
        </button>
        {canCreateIncentive && (
          <button
            className={`tab-button ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Incentive
          </button>
        )}
      </div>

      {activeTab === "list" && (
        <div className="incentives-list-section">
          <div className="filters-section">
            <div className="filter-row">
              <div className="filter-field">
                <label>Employee</label>
                <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)}>
                  <option value="">All Employees</option>
                  {employeeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Month</label>
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                  <option value="">All Months</option>
                  {payrollMonthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  <option value="">All Years</option>
                  {[2024, 2025, 2026, 2027].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button className="filter-button" onClick={fetchIncentives}>
                Apply Filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading incentives...</div>
          ) : incentives.length === 0 ? (
            <div className="empty-state">No incentives found</div>
          ) : (
            <div className="incentives-table">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Created</th>
                    {canReviewIncentive && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {incentives.map((incentive) => (
                    <tr key={incentive.id}>
                      <td>
                        {incentive.employee
                          ? `${incentive.employee.firstName} ${incentive.employee.lastName}`
                          : `Employee #${incentive.employeeId}`}
                      </td>
                      <td>
                        <span className="incentive-type">{incentive.typeDisplay || incentive.type}</span>
                      </td>
                      <td className="amount">Rs {Number(incentive.amount).toLocaleString()}</td>
                      <td className="reason">{incentive.reason}</td>
                      <td>
                        {payrollMonthOptions.find(m => m.value === incentive.month.toString())?.label} {incentive.year}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: incentiveStatusColors[incentive.status] }}
                        >
                          {incentive.statusDisplay || incentive.status}
                        </span>
                      </td>
                      <td>{new Date(incentive.createdAt).toLocaleDateString()}</td>
                      {canReviewIncentive && incentive.status === "PENDING" && (
                        <td>
                          <button
                            className="action-button"
                            onClick={() => {
                              setSelectedIncentive(incentive);
                              setShowReviewModal(true);
                            }}
                          >
                            Review
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "create" && canCreateIncentive && (
        <div className="create-incentive-section">
          <form onSubmit={handleCreateIncentive} className="incentive-form">
            <div className="form-row">
              <div className="form-field">
                <label>Employee *</label>
                <select
                  value={formValues.employeeId}
                  onChange={(e) => setFormValues({ ...formValues, employeeId: e.target.value })}
                  required
                >
                  <option value="">Select Employee</option>
                  {employeeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} {option.hint && `(${option.hint})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Incentive Type *</label>
                <select
                  value={formValues.type}
                  onChange={(e) => setFormValues({ ...formValues, type: e.target.value as IncentiveType })}
                  required
                >
                  {incentiveTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Amount (Rs) *</label>
                <input
                  type="number"
                  value={formValues.amount}
                  onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-field">
                <label>Period *</label>
                <div className="period-fields">
                  <select
                    value={formValues.month}
                    onChange={(e) => setFormValues({ ...formValues, month: e.target.value })}
                    required
                  >
                    {payrollMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formValues.year}
                    onChange={(e) => setFormValues({ ...formValues, year: e.target.value })}
                    required
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field full-width">
                <label>Reason *</label>
                <input
                  type="text"
                  value={formValues.reason}
                  onChange={(e) => setFormValues({ ...formValues, reason: e.target.value })}
                  placeholder="Brief reason for incentive"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field full-width">
                <label>Description</label>
                <textarea
                  value={formValues.description}
                  onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                  placeholder="Detailed description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? "Creating..." : "Create Incentive"}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setFormValues(initialIncentiveForm());
                  setActiveTab("list");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showReviewModal && selectedIncentive && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Review Incentive</h2>
            <div className="incentive-details">
              <p><strong>Employee:</strong> {selectedIncentive.employee?.firstName} {selectedIncentive.employee?.lastName}</p>
              <p><strong>Type:</strong> {selectedIncentive.typeDisplay || selectedIncentive.type}</p>
              <p><strong>Amount:</strong> Rs {Number(selectedIncentive.amount).toLocaleString()}</p>
              <p><strong>Reason:</strong> {selectedIncentive.reason}</p>
              {selectedIncentive.description && (
                <p><strong>Description:</strong> {selectedIncentive.description}</p>
              )}
            </div>
            <form onSubmit={handleReviewIncentive}>
              <div className="form-field">
                <label>Action *</label>
                <select
                  value={reviewFormValues.status}
                  onChange={(e) => setReviewFormValues({ ...reviewFormValues, status: e.target.value as "APPROVED" | "REJECTED" })}
                  required
                >
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </div>
              {reviewFormValues.status === "REJECTED" && (
                <div className="form-field">
                  <label>Rejection Reason *</label>
                  <textarea
                    value={reviewFormValues.rejectionReason}
                    onChange={(e) => setReviewFormValues({ ...reviewFormValues, rejectionReason: e.target.value })}
                    placeholder="Reason for rejection"
                    required
                    rows={3}
                  />
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="submit-button" disabled={loading}>
                  {loading ? "Processing..." : reviewFormValues.status === "APPROVED" ? "Approve" : "Reject"}
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedIncentive(null);
                    setReviewFormValues({ status: "APPROVED", rejectionReason: "" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncentivesPage;
