import "./IncentivesPage.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type EmployeeSelectOption = {
  value: string;
  label: string;
  hint?: string;
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

type SearchableEmployeeSelectProps = {
  id: string;
  value: string;
  options: EmployeeSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
};

function SearchableEmployeeSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Search employee",
  emptyMessage = "No matching employees",
  required = false,
}: SearchableEmployeeSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerId = `${id}-trigger`;
  const listboxId = `${id}-listbox`;
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = options.filter((option) => {
    if (!searchTerm.trim()) return true;
    const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase();
    return haystack.includes(searchTerm.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) return undefined;

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
    <div className={`incentive-employee-select ${open ? "incentive-employee-select--open" : ""}`} ref={containerRef}>
      <button
        type="button"
        id={triggerId}
        className="incentive-employee-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`incentive-employee-select__value ${selectedOption ? "" : "incentive-employee-select__value--placeholder"}`.trim()}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="incentive-employee-select__icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            <path d="M4 6.5 8 10l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {required ? <input type="hidden" value={value} required /> : null}
      {open ? (
        <div className="incentive-employee-select__menu" role="listbox" id={listboxId} aria-labelledby={triggerId}>
          <div className="incentive-employee-select__search">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          {filteredOptions.length ? filteredOptions.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`incentive-employee-select__option ${selected ? "incentive-employee-select__option--selected" : ""}`.trim()}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="incentive-employee-select__option-label">{option.label}</span>
                {option.hint ? <span className="incentive-employee-select__option-hint">{option.hint}</span> : null}
              </button>
            );
          }) : (
            <div className="incentive-employee-select__empty">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IncentivesPage({ token, role }: IncentivesPageProps) {
  const isEmployeeView = role === "EMPLOYEE";
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
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  // Fetch employees (for dropdown)
  const fetchEmployees = useCallback(async () => {
    if (!token || isEmployeeView) return;
    try {
      const response = await apiRequest("/employees?limit=1000", { token });
      if (response.success) {
        // Handle different response structures
        const employeesData = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any)?.items || [];
        const sortedEmployees = [...(employeesData as Employee[])].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );
        setEmployees(sortedEmployees);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, [token, isEmployeeView]);

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
        // Ensure incentives is always an array
        const incentivesData = Array.isArray(response.data) 
          ? response.data 
          : [];
        setIncentives(incentivesData as Incentive[]);
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

  const employeeOptions = useMemo<EmployeeSelectOption[]>(() => {
    if (!Array.isArray(employees)) return [];
    return employees.map((emp) => ({
      value: emp.id.toString(),
      label: `${emp.firstName} ${emp.lastName}`,
      hint: emp.jobTitle || emp.employeeCode,
    }));
  }, [employees]);

  const getStatusClass = (status: IncentiveStatus) => {
    if (status === "PAID") return "status-pill status-pill--finalized";
    return `status-pill status-pill--${status.toLowerCase()}`;
  };

  const groupedMonthlyIncentives = useMemo(() => {
    const groups = incentives.reduce<Record<string, { month: number; year: number; total: number; items: Incentive[] }>>((acc, item) => {
      const key = `${item.year}-${item.month}`;
      if (!acc[key]) {
        acc[key] = { month: item.month, year: item.year, total: 0, items: [] };
      }
      acc[key].items.push(item);
      acc[key].total += Number(item.amount);
      return acc;
    }, {});

    return Object.values(groups).sort((a, b) => {
      const aKey = a.year * 100 + a.month;
      const bKey = b.year * 100 + b.month;
      return bKey - aKey;
    });
  }, [incentives]);

  return (
    <section className="stack incentives-page">
      <div className="action-row incentives-page__header">
        <div>
          <p className="eyebrow">Payroll</p>
          <h1>{isEmployeeView ? "My Incentives" : "Incentives Management"}</h1>
        </div>
        {incentiveSummary && (
          <div className="incentive-summary-card">
            <p className="eyebrow">This Month</p>
            <strong>Rs {incentiveSummary.totalIncentives.toLocaleString()}</strong>
            <div className="incentive-summary-card__meta">
              <span>{incentiveSummary.approvedIncentives} approved</span>
                {incentiveSummary.pendingIncentives > 0 && (
                  <span>{incentiveSummary.pendingIncentives} pending</span>
                )}
              </div>
            </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="incentives-tabs">
        <button
          className={`incentives-tab ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          {isEmployeeView ? "Month-wise Incentives" : "Incentives List"}
        </button>
        {canCreateIncentive && (
          <button
            className={`incentives-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Incentive
          </button>
        )}
      </div>

      {activeTab === "list" && (
        <div className="card incentives-card">
          <div className="incentives-card__header">
            <div>
              <p className="eyebrow">{isEmployeeView ? "My Earnings" : "Overview"}</p>
              <h3>{isEmployeeView ? "Monthly Incentive Panels" : "Incentives List"}</h3>
            </div>
          </div>
          {!isEmployeeView ? (
            <div className="incentives-filters">
              <div className="filter-row">
                <div className="filter-field">
                  <label>Team Member</label>
                  <SearchableEmployeeSelect
                    id="incentive-filter-employee"
                    value={filterEmployeeId}
                    options={employeeOptions}
                    onChange={setFilterEmployeeId}
                    placeholder="Any team member"
                    searchPlaceholder="Search team member"
                    emptyMessage="No matching team members"
                  />
                </div>
                <div className="filter-field">
                  <label>Incentive Month</label>
                  <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                    <option value="">Any month</option>
                    {payrollMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-field">
                  <label>Incentive Year</label>
                  <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                    <option value="">Any year</option>
                    {yearOptions.map((year) => (
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
          ) : null}

          {loading ? (
            <div className="loading">Loading incentives...</div>
          ) : !Array.isArray(incentives) || incentives.length === 0 ? (
            <div className="table-empty-state">
              <strong>No incentives found</strong>
              <span>{isEmployeeView ? "No incentives are recorded for your account yet." : "Try changing the selected filters."}</span>
            </div>
          ) : isEmployeeView ? (
            <div className="incentive-month-panels">
              {groupedMonthlyIncentives.map((group) => (
                <article key={`${group.year}-${group.month}`} className="incentive-month-panel">
                  <header className="incentive-month-panel__header">
                    <div>
                      <p className="eyebrow">Month</p>
                      <h4>{payrollMonthOptions.find((m) => m.value === String(group.month))?.label} {group.year}</h4>
                    </div>
                    <div className="incentive-month-panel__total">
                      <span>Total</span>
                      <strong>Rs {group.total.toLocaleString()}</strong>
                    </div>
                  </header>
                  <div className="incentive-month-panel__items">
                    {group.items.map((incentive) => (
                      <div key={incentive.id} className="incentive-month-panel__item">
                        <div className="table-cell-stack">
                          <span className="table-cell-primary">{incentive.typeDisplay || incentive.type}</span>
                          <span className="table-cell-secondary">{incentive.reason}</span>
                        </div>
                        <div className="incentive-month-panel__meta">
                          <strong className="amount">Rs {Number(incentive.amount).toLocaleString()}</strong>
                          <span className={getStatusClass(incentive.status)}>{incentive.statusDisplay || incentive.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-wrap incentives-table-wrap">
              <table className="table table--dense">
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
                  {Array.isArray(incentives) && incentives.map((incentive) => (
                    <tr key={incentive.id}>
                      <td>
                        {incentive.employee
                          ? (
                            <div className="table-cell-stack">
                              <span className="table-cell-primary">{`${incentive.employee.firstName} ${incentive.employee.lastName}`}</span>
                              <span className="table-cell-secondary">{incentive.employee.employeeCode ?? `#${incentive.employeeId}`}</span>
                            </div>
                          )
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
                        <span className={getStatusClass(incentive.status)}>
                          {incentive.statusDisplay || incentive.status}
                        </span>
                      </td>
                      <td>{new Date(incentive.createdAt).toLocaleDateString()}</td>
                      {canReviewIncentive ? (
                        <td>
                          {incentive.status === "PENDING" ? (
                            <button
                              className="incentives-action-button"
                              onClick={() => {
                                setSelectedIncentive(incentive);
                                setShowReviewModal(true);
                              }}
                            >
                              Review
                            </button>
                          ) : (
                            <span className="table-cell-secondary">No action</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "create" && canCreateIncentive && (
        <div className="card incentives-card">
          <div className="incentives-card__header">
            <div>
              <p className="eyebrow">New Entry</p>
              <h3>Create Incentive</h3>
            </div>
          </div>
          <form onSubmit={handleCreateIncentive} className="incentive-form">
            <div className="form-row">
              <div className="form-field">
                <label>Employee *</label>
                <SearchableEmployeeSelect
                  id="incentive-form-employee"
                  value={formValues.employeeId}
                  options={employeeOptions}
                  onChange={(value) => setFormValues({ ...formValues, employeeId: value })}
                  placeholder="Select employee"
                  required
                />
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
                    {yearOptions.map((year) => (
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
                className="cancel-button secondary"
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
                  className="cancel-button secondary"
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
    </section>
  );
}

export default IncentivesPage;
