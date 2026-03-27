import "./EmployeesPage.css";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import { apiRequest } from "../../services/api";
import type { Department, Employee, Role } from "../../types";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import EmployeeTable from "./EmployeeTable";
import { createDefaultJoiningDateInput, createInitialEmployeeForm, formatStoredDateForInput, formatStoredDateTimeForInput, serializeLocalDateTime } from "./employeeFormUtils";

type EmployeesPageProps = {
  token: string | null;
  role: Role;
};

export default function EmployeesPage({ token, role }: EmployeesPageProps) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(createInitialEmployeeForm);
  const [loading, setLoading] = useState(role !== "EMPLOYEE");
  const [submitting, setSubmitting] = useState(false);

  function createEmployeeFormWithDefaults() {
    const defaultDepartment = departments.find((department) => department.name === "Software Development");

    return {
      ...createInitialEmployeeForm(),
      departmentId: defaultDepartment ? String(defaultDepartment.id) : "",
      joiningDate: createDefaultJoiningDateInput(),
    };
  }

  const reloadData = useCallback(async () => {
    setLoading(true);
    const [employeesResponse, departmentsResponse] = await Promise.all([
      apiRequest<{ items: Employee[] }>("/employees?limit=100", { token }),
      apiRequest<Department[]>("/departments", { token }),
    ]);
    setEmployees(employeesResponse.data.items);
    setDepartments(departmentsResponse.data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (role === "EMPLOYEE") return;

    reloadData().catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Failed to load employees");
      setLoading(false);
    });
  }, [reloadData, role]);

  async function saveTeamLeadConfig(employeeId: number, isTeamLead: boolean, teamLeadScopeIds: number[]) {
    await apiRequest(`/employees/${employeeId}/team-lead-config`, {
      method: "PUT",
      token,
      body: {
        enabled: isTeamLead,
        employeeIds: teamLeadScopeIds,
      },
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      const response = await apiRequest<Employee>(editingEmployeeId ? `/employees/${editingEmployeeId}` : "/employees", {
        method: editingEmployeeId ? "PUT" : "POST",
        token,
        body: payload,
      });

      await saveTeamLeadConfig(response.data.id, isTeamLead, teamLeadScopeIds);

      setMessage(editingEmployeeId ? "Employee updated." : "Employee created.");
      setEditingEmployeeId(null);
      setEmployeeModalOpen(false);
      setForm(createEmployeeFormWithDefaults());
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function startEdit(employee: Employee) {
    const detailResponse = await apiRequest<Employee>(`/employees/${employee.id}`, { token });
    const detailedEmployee = detailResponse.data;

    setEditingEmployeeId(employee.id);
    setForm({
      email: detailedEmployee.user?.email ?? "",
      password: "",
      role: detailedEmployee.user?.role.name ?? "EMPLOYEE",
      employeeCode: detailedEmployee.employeeCode,
      firstName: detailedEmployee.firstName,
      lastName: detailedEmployee.lastName,
      jobTitle: detailedEmployee.jobTitle ?? "",
      phone: detailedEmployee.phone ?? "",
      annualPackageLpa: detailedEmployee.annualPackageLpa ? String(detailedEmployee.annualPackageLpa) : "",
      isOnProbation: Boolean(detailedEmployee.isOnProbation),
      probationEndDate: detailedEmployee.probationEndDate ? formatStoredDateForInput(detailedEmployee.probationEndDate) : "",
      departmentId: String(detailedEmployee.departmentId),
      managerId: detailedEmployee.managerId ? String(detailedEmployee.managerId) : "",
      joiningDate: formatStoredDateTimeForInput(detailedEmployee.joiningDate),
      employmentStatus: detailedEmployee.employmentStatus,
      isTeamLead: Boolean(detailedEmployee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD")),
      teamLeadScopeIds: detailedEmployee.scopedTeamMembers?.map((item) => item.employee.id) ?? [],
    });
    setEmployeeModalOpen(true);
  }

  function startCreate() {
    setEditingEmployeeId(null);
    setForm(createEmployeeFormWithDefaults());
    setEmployeeModalOpen(true);
  }

  async function toggleStatus(employee: Employee) {
    await apiRequest<Employee>(`/employees/${employee.id}/status`, {
      method: "PATCH",
      token,
      body: {
        isActive: !employee.isActive,
        employmentStatus: !employee.isActive ? "ACTIVE" : "INACTIVE",
      },
    });

    setMessage(`Employee ${employee.isActive ? "deactivated" : "activated"}.`);
    await reloadData();
  }

  function cancelEdit() {
    setEditingEmployeeId(null);
    setForm(createEmployeeFormWithDefaults());
    setEmployeeModalOpen(false);
  }

  if (role === "EMPLOYEE") {
    return <MessageCard title="Restricted" message="Employee management is not available for employees." />;
  }

  return (
    <section className="stack">
      {error ? <MessageCard title="Employee loading failed" tone="error" message={error} /> : null}
      {message ? <p className="success-text">{message}</p> : null}
      {loading ? (
        <article className="card skeleton-card skeleton-card--table">
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      ) : (
        <EmployeeTable
          employees={employees}
          onAdd={startCreate}
          onEdit={startEdit}
          onToggleStatus={toggleStatus}
          onSelect={(employee) => navigate(`/employees/${employee.id}`)}
        />
      )}
      <Modal
        open={employeeModalOpen}
        title={editingEmployeeId ? "Edit employee" : "Add employee"}
        className="employee-modal-surface"
        onClose={cancelEdit}
      >
        <EmployeeForm
          form={form}
          departments={departments}
          employees={employees}
          editingEmployeeId={editingEmployeeId}
          isSubmitting={submitting}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancelEdit={cancelEdit}
        />
      </Modal>
    </section>
  );
}
