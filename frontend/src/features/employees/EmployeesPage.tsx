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
import { createInitialEmployeeForm } from "./employeeFormUtils";

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
  const [teamLeadModalOpen, setTeamLeadModalOpen] = useState(false);
  const [teamLeadEmployee, setTeamLeadEmployee] = useState<Employee | null>(null);
  const [teamLeadEnabled, setTeamLeadEnabled] = useState(false);
  const [teamLeadScopeIds, setTeamLeadScopeIds] = useState<number[]>([]);
  const [form, setForm] = useState<EmployeeFormValues>(createInitialEmployeeForm);
  const [loading, setLoading] = useState(role !== "EMPLOYEE");

  const reloadData = useCallback(async () => {
    setLoading(true);
    const [employeesResponse, departmentsResponse] = await Promise.all([
      apiRequest<{ items: Employee[] }>("/employees", { token }),
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
    if (isTeamLead) {
      await apiRequest(`/employees/${employeeId}/capabilities`, {
        method: "POST",
        token,
        body: { capability: "TEAM_LEAD" },
      });
      await apiRequest(`/employees/${employeeId}/team-scope`, {
        method: "PUT",
        token,
        body: { employeeIds: teamLeadScopeIds },
      });
      return;
    }

    await apiRequest(`/employees/${employeeId}/capabilities/TEAM_LEAD`, {
      method: "DELETE",
      token,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { isTeamLead, teamLeadScopeIds, ...formValues } = form;
    const payload = {
      ...formValues,
      jobTitle: formValues.jobTitle.trim() || undefined,
      departmentId: Number(formValues.departmentId),
      managerId: formValues.managerId ? Number(formValues.managerId) : null,
      joiningDate: new Date(formValues.joiningDate).toISOString(),
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
    setForm(createInitialEmployeeForm());
    await reloadData();
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
      departmentId: String(detailedEmployee.departmentId),
      managerId: detailedEmployee.managerId ? String(detailedEmployee.managerId) : "",
      joiningDate: new Date(detailedEmployee.joiningDate).toISOString().slice(0, 16),
      employmentStatus: detailedEmployee.employmentStatus,
      isTeamLead: Boolean(detailedEmployee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD")),
      teamLeadScopeIds: detailedEmployee.scopedTeamMembers?.map((item) => item.employee.id) ?? [],
    });
    setEmployeeModalOpen(true);
  }

  function startCreate() {
    setEditingEmployeeId(null);
    setForm(createInitialEmployeeForm());
    setEmployeeModalOpen(true);
  }

  async function startTeamLeadSetup(employee: Employee) {
    const response = await apiRequest<Employee>(`/employees/${employee.id}`, { token });
    const detailedEmployee = response.data;
    setTeamLeadEmployee(detailedEmployee);
    setTeamLeadEnabled(Boolean(detailedEmployee.capabilities?.some((capability) => capability.capability === "TEAM_LEAD")));
    setTeamLeadScopeIds(detailedEmployee.scopedTeamMembers?.map((item) => item.employee.id) ?? []);
    setTeamLeadModalOpen(true);
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
    setForm(createInitialEmployeeForm());
    setEmployeeModalOpen(false);
  }

  function closeTeamLeadModal() {
    setTeamLeadModalOpen(false);
    setTeamLeadEmployee(null);
    setTeamLeadEnabled(false);
    setTeamLeadScopeIds([]);
  }

  async function submitTeamLeadSetup() {
    if (!teamLeadEmployee) {
      return;
    }

    if (teamLeadEnabled) {
      await saveTeamLeadConfig(teamLeadEmployee.id, true, teamLeadScopeIds);
      setMessage("Team Leader scope updated.");
    } else {
      await saveTeamLeadConfig(teamLeadEmployee.id, false, []);
      setMessage("Team Leader capability removed.");
    }

    closeTeamLeadModal();
    await reloadData();
  }

  function toggleScopeEmployee(employeeId: number) {
    setTeamLeadScopeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
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
          onManageTeamLead={startTeamLeadSetup}
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
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancelEdit={cancelEdit}
        />
      </Modal>
      <Modal
        open={teamLeadModalOpen}
        title={teamLeadEmployee ? `TL setup · ${teamLeadEmployee.firstName} ${teamLeadEmployee.lastName}` : "TL setup"}
        className="employee-modal-surface"
        onClose={closeTeamLeadModal}
      >
        <div className="card stack compact-form employee-form-card">
          <h3>Team Leader access</h3>
          <p className="muted">Enable TL capability and define which employees this person can coordinate.</p>
          <label className="checkbox-row">
            <input checked={teamLeadEnabled} type="checkbox" onChange={(event) => setTeamLeadEnabled(event.target.checked)} />
            <span>Enable Team Leader capability</span>
          </label>
          {teamLeadEnabled ? (
            <div className="stack tl-scope-list">
              <p className="muted">Scoped team members</p>
              {employees
                .filter((employee) => employee.id !== teamLeadEmployee?.id && employee.isActive)
                .map((employee) => (
                  <label key={employee.id} className="checkbox-row">
                    <input
                      checked={teamLeadScopeIds.includes(employee.id)}
                      type="checkbox"
                      onChange={() => toggleScopeEmployee(employee.id)}
                    />
                    <span>{`${employee.firstName} ${employee.lastName}`}</span>
                  </label>
                ))}
            </div>
          ) : null}
          <div className="button-row">
            <button type="button" onClick={submitTeamLeadSetup}>
              Save TL setup
            </button>
            <button type="button" className="secondary" onClick={closeTeamLeadModal}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
