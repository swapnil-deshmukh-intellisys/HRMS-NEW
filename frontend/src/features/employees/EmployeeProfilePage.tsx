import "./EmployeeProfilePage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import { apiRequest } from "../../services/api";
import type { Attendance, Department, Employee, LeaveBalance, LeaveRequest, PayrollRecord, Role } from "../../types";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import EmployeeAttendanceTab from "./EmployeeAttendanceTab";
import EmployeeAttendanceSnapshotCard from "./EmployeeAttendanceSnapshotCard";
import EmployeeLeavesTab from "./EmployeeLeavesTab";
import EmployeeLeaveSnapshotCard from "./EmployeeLeaveSnapshotCard";
import EmployeeOverviewTab from "./EmployeeOverviewTab";
import EmployeePayrollTab from "./EmployeePayrollTab";
import EmployeeProfileHeader from "./EmployeeProfileHeader";
import EmployeeProfileTabs, { type EmployeeProfileTabKey } from "./EmployeeProfileTabs";
import { createInitialEmployeeForm } from "./employeeFormUtils";

type EmployeeProfilePageProps = {
  token: string | null;
  role: Role;
};

function toEmployeeForm(employee: Employee): EmployeeFormValues {
  return {
    email: employee.user?.email ?? "",
    password: "",
    role: employee.user?.role.name ?? "EMPLOYEE",
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    jobTitle: employee.jobTitle ?? "",
    phone: employee.phone ?? "",
    departmentId: String(employee.departmentId),
    managerId: employee.managerId ? String(employee.managerId) : "",
    joiningDate: new Date(employee.joiningDate).toISOString().slice(0, 16),
    employmentStatus: employee.employmentStatus,
    isTeamLead: Boolean(employee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD")),
    teamLeadScopeIds: employee.scopedTeamMembers?.map((item) => item.employee.id) ?? [],
  };
}

export default function EmployeeProfilePage({ token, role }: EmployeeProfilePageProps) {
  const { id } = useParams();
  const employeeId = Number(id);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<EmployeeProfileTabKey>("overview");
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(createInitialEmployeeForm);
  const [reviewingLeaveId, setReviewingLeaveId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canManageEmployee = role === "ADMIN" || role === "HR";

  const reloadProfile = useCallback(async () => {
    if (!employeeId) {
      setError("Employee profile not found.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [employeeResponse, attendanceResponse, balancesResponse, leavesResponse, payrollResponse] = await Promise.all([
        apiRequest<Employee>(`/employees/${employeeId}`, { token }),
        apiRequest<Attendance[]>(`/attendance?employeeId=${employeeId}`, { token }),
        apiRequest<LeaveBalance[]>(`/leave-balances/me?employeeId=${employeeId}`, { token }),
        apiRequest<LeaveRequest[]>(`/leaves?employeeId=${employeeId}`, { token }),
        apiRequest<PayrollRecord[]>(`/payroll?employeeId=${employeeId}`, { token }),
      ]);

      setEmployee(employeeResponse.data);
      setAttendance(attendanceResponse.data);
      setBalances(balancesResponse.data);
      setLeaves(leavesResponse.data);
      setPayroll(payrollResponse.data);

      if (canManageEmployee) {
        const [departmentsResponse, employeesResponse] = await Promise.all([
          apiRequest<Department[]>("/departments", { token }),
          apiRequest<{ items: Employee[] }>("/employees", { token }),
        ]);
        setDepartments(departmentsResponse.data);
        setEmployees(employeesResponse.data.items);
      } else {
        setDepartments([]);
        setEmployees([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load employee profile.");
    } finally {
      setLoading(false);
    }
  }, [canManageEmployee, employeeId, token]);

  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  useEffect(() => {
    if (employee) {
      setForm(toEmployeeForm(employee));
    }
  }, [employee]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [message]);

  const latestPayroll = payroll[0];

  const secondarySummaryCards = useMemo(
    () => [
      {
        label: "Payroll snapshot",
        value: latestPayroll ? `${latestPayroll.month}/${latestPayroll.year}` : "No payroll yet",
        hint: latestPayroll ? latestPayroll.status : "No payroll records available",
      },
      {
        label: "Employment summary",
        value: employee?.department?.name ?? "-",
        hint: employee?.manager ? `Reports to ${employee.manager.firstName} ${employee.manager.lastName}` : "No reporting manager assigned",
      },
    ],
    [employee?.department?.name, employee?.manager, latestPayroll],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) {
      return;
    }

    const { isTeamLead: _isTeamLead, teamLeadScopeIds: _teamLeadScopeIds, ...formValues } = form;
    const payload = {
      ...formValues,
      jobTitle: formValues.jobTitle.trim() || undefined,
      departmentId: Number(formValues.departmentId),
      managerId: formValues.managerId ? Number(formValues.managerId) : null,
      joiningDate: new Date(formValues.joiningDate).toISOString(),
    };

    await apiRequest<Employee>(`/employees/${employee.id}`, {
      method: "PUT",
      token,
      body: payload,
    });

    setMessage("Employee updated.");
    setEmployeeModalOpen(false);
    await reloadProfile();
  }

  async function toggleStatus() {
    if (!employee) {
      return;
    }

    await apiRequest<Employee>(`/employees/${employee.id}/status`, {
      method: "PATCH",
      token,
      body: {
        isActive: !employee.isActive,
        employmentStatus: !employee.isActive ? "ACTIVE" : "INACTIVE",
      },
    });

    setMessage(`Employee ${employee.isActive ? "deactivated" : "activated"}.`);
    await reloadProfile();
  }

  async function reviewLeave(id: number, action: "approve" | "reject") {
    if (action === "reject") {
      setReviewingLeaveId(id);
      setRejectionReason("");
      return;
    }

    await apiRequest(`/leaves/${id}/approve`, {
      method: "PUT",
      token,
    });

    setMessage("Leave approved successfully.");
    await reloadProfile();
  }

  async function submitRejection() {
    if (!reviewingLeaveId) {
      return;
    }

    await apiRequest(`/leaves/${reviewingLeaveId}/reject`, {
      method: "PUT",
      token,
      body: { rejectionReason },
    });

    setMessage("Leave rejected successfully.");
    setReviewingLeaveId(null);
    setRejectionReason("");
    await reloadProfile();
  }

  if (loading) {
    return (
      <section className="stack employee-profile-page">
        <article className="card skeleton-card">
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--medium" />
        </article>
        <div className="grid cols-4 skeleton-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="card skeleton-card">
              <span className="skeleton-line skeleton-line--short" />
              <span className="skeleton-line skeleton-line--metric" />
            </article>
          ))}
        </div>
        <article className="card skeleton-card skeleton-card--table">
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      </section>
    );
  }

  if (error) {
    return <MessageCard title="Employee profile issue" tone="error" message={error} />;
  }

  if (!employee) {
    return <MessageCard title="Employee profile" tone="error" message="Employee not found." />;
  }

  return (
    <section className="stack employee-profile-page">
      <Link to="/employees" className="employee-profile-back-link">
        Back to employee directory
      </Link>
      {message ? <p className="success-text">{message}</p> : null}
      <EmployeeProfileHeader employee={employee} role={role} onEdit={() => setEmployeeModalOpen(true)} onToggleStatus={toggleStatus} />
      <div className="grid cols-2 employee-profile-snapshot-row">
        <EmployeeAttendanceSnapshotCard attendance={attendance} />
        <EmployeeLeaveSnapshotCard balances={balances} leaves={leaves} />
      </div>
      <div className="grid cols-2 employee-profile-summary employee-profile-summary--secondary">
        {secondarySummaryCards.map((card) => (
          <article key={card.label} className="card employee-profile-summary-card">
            <p className="eyebrow">{card.label}</p>
            <strong>{card.value}</strong>
            <p className="muted">{card.hint}</p>
          </article>
        ))}
      </div>
      <EmployeeProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" ? <EmployeeOverviewTab employee={employee} /> : null}
      {activeTab === "attendance" ? <EmployeeAttendanceTab attendance={attendance} /> : null}
      {activeTab === "leaves" ? (
        <EmployeeLeavesTab balances={balances} leaves={leaves} role={role} employeeId={employee.id} onReview={reviewLeave} />
      ) : null}
      {activeTab === "payroll" ? <EmployeePayrollTab payroll={payroll} /> : null}
      <Modal open={employeeModalOpen} title="Edit employee" className="employee-profile-modal" onClose={() => setEmployeeModalOpen(false)}>
        <EmployeeForm
          form={form}
          departments={departments}
          employees={employees}
          editingEmployeeId={employee.id}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEmployeeModalOpen(false)}
        />
      </Modal>
      <Modal open={reviewingLeaveId !== null} title="Reject leave request" onClose={() => setReviewingLeaveId(null)}>
        <div className="stack leave-review-modal">
          <p className="muted">Add a clear reason so the employee understands why this request was rejected.</p>
          <label>
            Rejection reason
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} minLength={3} />
          </label>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setReviewingLeaveId(null)}>
              Close
            </button>
            <button type="button" onClick={submitRejection} disabled={rejectionReason.trim().length < 3}>
              Reject leave
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
