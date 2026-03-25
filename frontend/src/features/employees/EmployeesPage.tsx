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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...form,
      departmentId: Number(form.departmentId),
      managerId: form.managerId ? Number(form.managerId) : null,
      joiningDate: new Date(form.joiningDate).toISOString(),
    };

    await apiRequest<Employee>(editingEmployeeId ? `/employees/${editingEmployeeId}` : "/employees", {
      method: editingEmployeeId ? "PUT" : "POST",
      token,
      body: payload,
    });

    setMessage(editingEmployeeId ? "Employee updated." : "Employee created.");
    setEditingEmployeeId(null);
    setEmployeeModalOpen(false);
    setForm(createInitialEmployeeForm());
    await reloadData();
  }

  function startEdit(employee: Employee) {
    setEditingEmployeeId(employee.id);
    setForm({
      email: employee.user?.email ?? "",
      password: "",
      role: employee.user?.role.name ?? "EMPLOYEE",
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? "",
      departmentId: String(employee.departmentId),
      managerId: employee.managerId ? String(employee.managerId) : "",
      joiningDate: new Date(employee.joiningDate).toISOString().slice(0, 16),
      employmentStatus: employee.employmentStatus,
    });
    setEmployeeModalOpen(true);
  }

  function startCreate() {
    setEditingEmployeeId(null);
    setForm(createInitialEmployeeForm());
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
    setForm(createInitialEmployeeForm());
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
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancelEdit={cancelEdit}
        />
      </Modal>
    </section>
  );
}
