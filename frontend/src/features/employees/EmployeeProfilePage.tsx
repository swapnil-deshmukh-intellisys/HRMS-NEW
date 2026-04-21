import "./EmployeeProfilePage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import { createInitialEmployeeForm, formatStoredDateForInput, formatStoredDateTimeForInput, serializeLocalDateTime } from "./employeeFormUtils";

type EmployeeProfilePageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
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
    annualPackageLpa: employee.annualPackageLpa ? String(employee.annualPackageLpa) : "",
    isOnProbation: Boolean(employee.isOnProbation),
    probationEndDate: employee.probationEndDate ? formatStoredDateForInput(employee.probationEndDate) : "",
    departmentId: String(employee.departmentId),
    managerId: employee.managerId ? String(employee.managerId) : "",
    joiningDate: formatStoredDateTimeForInput(employee.joiningDate),
    employmentStatus: employee.employmentStatus,
    isTeamLead: Boolean(employee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD")),
    teamLeadScopeIds: employee.scopedTeamMembers?.map((item) => item.employee.id) ?? [],
  };
}

export default function EmployeeProfilePage({ token, role, currentEmployeeId }: EmployeeProfilePageProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
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
  const [activeTab, setActiveTab] = useState<EmployeeProfileTabKey>(() => {
    const requestedTab = searchParams.get("tab");
    return requestedTab === "attendance" || requestedTab === "leaves" || requestedTab === "payroll" || requestedTab === "overview"
      ? requestedTab
      : "overview";
  });
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(createInitialEmployeeForm);
    const [submitting, setSubmitting] = useState(false);

  const canManageEmployee = role === "ADMIN" || role === "HR";
  const canViewPayroll = role !== "EMPLOYEE" || currentEmployeeId === employeeId;
  const canViewEmployeeDirectoryLink = role !== "EMPLOYEE";
  const visiblePayroll = useMemo(
    () => (role === "EMPLOYEE" ? payroll.filter((record) => record.status !== "DRAFT") : payroll),
    [payroll, role],
  );

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
        canViewPayroll ? apiRequest<PayrollRecord[]>(`/payroll?employeeId=${employeeId}`, { token }) : Promise.resolve({ data: [] as PayrollRecord[] }),
      ]);

      setEmployee(employeeResponse.data);
      setAttendance(attendanceResponse.data);
      setBalances(balancesResponse.data);
      setLeaves(leavesResponse.data);
      setPayroll(payrollResponse.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load employee profile.");
    } finally {
      setLoading(false);
    }
  }, [canViewPayroll, employeeId, token]);

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

  useEffect(() => {
    if (!canViewPayroll && activeTab === "payroll") {
      setActiveTab("overview");
    }
  }, [activeTab, canViewPayroll]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");

    if (requestedTab === "attendance" || requestedTab === "leaves" || requestedTab === "payroll" || requestedTab === "overview") {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const latestPayroll = visiblePayroll[0];

  const secondarySummaryCards = useMemo(
    () =>
      [
        ...(canViewPayroll
          ? [
              {
                label: "Payroll snapshot",
                value: latestPayroll ? `${latestPayroll.month}/${latestPayroll.year}` : "No payroll yet",
                hint: latestPayroll ? latestPayroll.status : "No payroll records available",
              },
            ]
          : []),
        {
        label: "Employment summary",
        value: employee?.department?.name ?? "-",
        hint: employee?.manager ? `Reports to ${employee.manager.firstName} ${employee.manager.lastName}` : "No reporting manager assigned",
        },
      ],
    [canViewPayroll, employee?.department?.name, employee?.manager, latestPayroll],
  );

  async function saveTeamLeadConfig(employeeIdToSave: number, isTeamLead: boolean, teamLeadScopeIds: number[]) {
    await apiRequest(`/employees/${employeeIdToSave}/team-lead-config`, {
      method: "PUT",
      token,
      body: {
        enabled: isTeamLead,
        employeeIds: teamLeadScopeIds,
      },
    });
  }

  const ensureEmployeeFormOptionsLoaded = useCallback(async () => {
    if (!canManageEmployee) {
      return;
    }

    const requests: Array<Promise<unknown>> = [];

    if (!departments.length) {
      requests.push(
        apiRequest<Department[]>("/departments", { token }).then((response) => {
          setDepartments(response.data);
        }),
      );
    }

    if (!employees.length) {
      requests.push(
        apiRequest<{ items: Employee[] }>("/employees?limit=100", { token }).then((response) => {
          setEmployees(response.data.items);
        }),
      );
    }

    await Promise.all(requests);
  }, [canManageEmployee, departments.length, employees.length, token]);

  async function openEmployeeModal() {
    if (!canManageEmployee) {
      return;
    }

    try {
      await ensureEmployeeFormOptionsLoaded();
      setEmployeeModalOpen(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load employee form options.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) {
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const { isTeamLead, teamLeadScopeIds, ...formValues } = form;
      const payload = {
        ...formValues,
        password: formValues.password.trim() || undefined,
        jobTitle: formValues.jobTitle.trim() || undefined,
        phone: formValues.phone.trim() || undefined,
        annualPackageLpa: formValues.annualPackageLpa.trim() ? Number(formValues.annualPackageLpa) : null,
        isOnProbation: formValues.isOnProbation,
        probationEndDate: formValues.isOnProbation && formValues.probationEndDate ? `${formValues.probationEndDate}T00:00:00.000Z` : null,
        departmentId: Number(formValues.departmentId),
        managerId: formValues.managerId ? Number(formValues.managerId) : null,
        joiningDate: serializeLocalDateTime(formValues.joiningDate),
      };

      await apiRequest<Employee>(`/employees/${employee.id}`, {
        method: "PUT",
        token,
        body: payload,
      });

      await saveTeamLeadConfig(employee.id, isTeamLead, teamLeadScopeIds);

      setMessage("Employee updated.");
      setEmployeeModalOpen(false);
      await reloadProfile();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update employee");
    } finally {
      setSubmitting(false);
    }
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

  const visibleTabs: Array<{ key: EmployeeProfileTabKey; label: string }> | undefined = canViewPayroll
    ? undefined
    : [
        { key: "overview", label: "Overview" },
        { key: "attendance", label: "Attendance" },
        { key: "leaves", label: "Leaves" },
      ];

  return (
    <section className="stack employee-profile-page">
      {canViewEmployeeDirectoryLink ? (
        <Link to="/employees" className="employee-profile-back-link">
          Back to employee directory
        </Link>
      ) : null}
      {message ? <p className="success-text">{message}</p> : null}
      <EmployeeProfileHeader
        employee={employee}
        role={role}
        onEdit={() => {
          void openEmployeeModal();
        }}
        onToggleStatus={() => setStatusConfirmOpen(true)}
      />
      <EmployeeProfileTabs activeTab={activeTab} tabs={visibleTabs} onChange={setActiveTab} />
      {activeTab === "overview" ? <EmployeeOverviewTab employee={employee} token={token} /> : null}
      {activeTab === "attendance" ? <EmployeeAttendanceTab attendance={attendance} /> : null}
      {activeTab === "leaves" ? (
        <EmployeeLeavesTab balances={balances} leaves={leaves} role={role} viewerEmployeeId={currentEmployeeId} />
      ) : null}
      {canViewPayroll && activeTab === "payroll" ? <EmployeePayrollTab payroll={visiblePayroll} /> : null}
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
      <Modal open={employeeModalOpen} title="Edit employee" className="employee-profile-modal" onClose={() => setEmployeeModalOpen(false)}>
        <EmployeeForm
          form={form}
          departments={departments}
          employees={employees}
          editingEmployeeId={employee.id}
          isSubmitting={submitting}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEmployeeModalOpen(false)}
        />
      </Modal>
      <Modal
        open={statusConfirmOpen}
        title={employee.isActive ? "Confirm deactivation" : "Confirm activation"}
        onClose={() => setStatusConfirmOpen(false)}
      >
        <div className="stack leave-review-modal">
          <p className="muted">
            {employee.isActive
              ? "Deactivating this employee will disable access and mark them inactive in the system."
              : "Activating this employee will restore access and mark them active in the system."}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => setStatusConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusConfirmOpen(false);
                void toggleStatus();
              }}
            >
              {employee.isActive ? "Deactivate employee" : "Activate employee"}
            </button>
          </div>
        </div>
      </Modal>
          </section>
  );
}
