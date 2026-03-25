import "./EmployeeForm.css";
import { useState } from "react";
import type { Department, Employee } from "../../types";

export type EmployeeFormValues = {
  email: string;
  password: string;
  role: "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  managerId: string;
  joiningDate: string;
  employmentStatus: "ACTIVE" | "INACTIVE" | "TERMINATED";
};

type EmployeeFormProps = {
  form: EmployeeFormValues;
  departments: Department[];
  employees: Employee[];
  editingEmployeeId: number | null;
  onChange: (nextForm: EmployeeFormValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

export default function EmployeeForm({
  form,
  departments,
  employees,
  editingEmployeeId,
  onChange,
  onSubmit,
  onCancelEdit,
}: EmployeeFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="card stack compact-form employee-form-card" onSubmit={onSubmit}>
      <h3>{editingEmployeeId ? "Edit employee" : "Create employee"}</h3>
      <p className="muted">The email and password entered here will be used by this employee to log in.</p>
      <label>
        Email
        <input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required type="email" />
      </label>
      <label>
        Password
        <div className="password-field">
          <input
            value={form.password}
            onChange={(event) => onChange({ ...form, password: event.target.value })}
            type={showPassword ? "text" : "password"}
            placeholder="Password@123"
          />
          <button type="button" className="icon-button" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <label>
        Employee code
        <input value={form.employeeCode} onChange={(event) => onChange({ ...form, employeeCode: event.target.value })} required />
      </label>
      <label>
        First name
        <input value={form.firstName} onChange={(event) => onChange({ ...form, firstName: event.target.value })} required />
      </label>
      <label>
        Last name
        <input value={form.lastName} onChange={(event) => onChange({ ...form, lastName: event.target.value })} required />
      </label>
      <label>
        Role
        <select value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value as EmployeeFormValues["role"] })}>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="HR">HR</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      <label>
        Department
        <select value={form.departmentId} onChange={(event) => onChange({ ...form, departmentId: event.target.value })} required>
          <option value="">Select department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Manager
        <select value={form.managerId} onChange={(event) => onChange({ ...form, managerId: event.target.value })}>
          <option value="">No manager</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Joining date
        <input value={form.joiningDate} onChange={(event) => onChange({ ...form, joiningDate: event.target.value })} type="datetime-local" required />
      </label>
      <label>
        Employment status
        <select
          value={form.employmentStatus}
          onChange={(event) => onChange({ ...form, employmentStatus: event.target.value as EmployeeFormValues["employmentStatus"] })}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </label>
      <div className="button-row">
        <button type="submit">{editingEmployeeId ? "Update employee" : "Create employee"}</button>
        {editingEmployeeId ? (
          <button type="button" className="secondary" onClick={onCancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </div>
    </form>
  );
}
