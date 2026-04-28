import "./EmployeesPage.css";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import { apiRequest } from "../../services/api";
import type { Department, Employee, Role } from "../../types";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import EmployeeTable from "./EmployeeTable";
import { createDefaultJoiningDateInput, createInitialEmployeeForm, serializeLocalDateTime } from "./employeeFormUtils";

type EmployeesPageProps = {
  token: string | null;
  role: Role;
};

export default function EmployeesPage({ token, role }: EmployeesPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(createInitialEmployeeForm);
  const [loading, setLoading] = useState(role !== "EMPLOYEE");
  const [submitting, setSubmitting] = useState(false);
  const initialSearchTerm = searchParams.get("search") ?? "";

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
    const employeesResponse = await apiRequest<{ items: Employee[] }>("/employees?limit=100", { token });
    setEmployees(employeesResponse.data.items);
    setLoading(false);
  }, [token]);

  const ensureDepartmentsLoaded = useCallback(async () => {
    if (departments.length) {
      return departments;
    }

    const response = await apiRequest<Department[]>("/departments", { token });
    setDepartments(response.data);
    return response.data;
  }, [departments, token]);

  useEffect(() => {
    if (role === "EMPLOYEE") return;

    reloadData().catch((requestError) => {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load employees");
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

      toast.success(editingEmployeeId ? "Employee updated." : "Employee created.");
      setEditingEmployeeId(null);
      setEmployeeModalOpen(false);
      setForm(createEmployeeFormWithDefaults());
      await reloadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  }

  function startCreate() {
    ensureDepartmentsLoaded()
      .then(() => {
        setEditingEmployeeId(null);
        setForm(createEmployeeFormWithDefaults());
        setEmployeeModalOpen(true);
      })
      .catch((requestError) => {
        toast.error(requestError instanceof Error ? requestError.message : "Failed to load departments");
      });
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
          onSelect={(employee) => navigate(`/employees/${employee.id}`)}
          initialSearchTerm={initialSearchTerm}
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
