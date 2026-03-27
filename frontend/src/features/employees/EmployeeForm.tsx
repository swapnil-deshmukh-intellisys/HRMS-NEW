import "./EmployeeForm.css";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import type { Department, Employee } from "../../types";
import { calculateCompensationPreview } from "./employeeFormUtils";

export type EmployeeFormValues = {
  email: string;
  password: string;
  role: "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  annualPackageLpa: string;
  isOnProbation: boolean;
  probationEndDate: string;
  departmentId: string;
  managerId: string;
  joiningDate: string;
  employmentStatus: "ACTIVE" | "INACTIVE" | "TERMINATED";
  isTeamLead: boolean;
  teamLeadScopeIds: number[];
};

type EmployeeFormProps = {
  form: EmployeeFormValues;
  departments: Department[];
  employees: Employee[];
  editingEmployeeId: number | null;
  isSubmitting?: boolean;
  onChange: (nextForm: EmployeeFormValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

export default function EmployeeForm({
  form,
  departments,
  employees,
  editingEmployeeId,
  isSubmitting = false,
  onChange,
  onSubmit,
  onCancelEdit,
}: EmployeeFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const managerOptions = employees.filter((employee) => employee.user?.role.name === "MANAGER");
  const compensationPreview = useMemo(() => calculateCompensationPreview(form.annualPackageLpa), [form.annualPackageLpa]);

  function formatCompensationValue(value: number) {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <form className="card stack compact-form employee-form-card" onSubmit={onSubmit}>
      <fieldset className="employee-form-fieldset" disabled={isSubmitting}>
        <h3>{editingEmployeeId ? "Edit employee" : "Create employee"}</h3>
        <p className="muted">The email and password entered here will be used by this employee to log in.</p>
        <label>
          Email
          <input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required type="email" />
        </label>
        <label>
          Password
          <div className="employee-password-input-wrap">
            <input
              value={form.password}
              onChange={(event) => onChange({ ...form, password: event.target.value })}
              type={showPassword ? "text" : "password"}
              placeholder="Password@123"
            />
            <button
              type="button"
              className="employee-password-visibility-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
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
          Job title
          <input value={form.jobTitle} onChange={(event) => onChange({ ...form, jobTitle: event.target.value })} placeholder="Software Developer" />
        </label>
        <label>
          Mobile number
          <input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" />
        </label>
        <div className="employee-form-section employee-form-section--compensation">
          <div className="employee-form-section__header">
            <h4>Compensation</h4>
            <p className="muted">Package is entered in LPA and the monthly breakdown preview updates automatically.</p>
          </div>
          <label>
            Package (LPA)
            <input
              value={form.annualPackageLpa}
              onChange={(event) => onChange({ ...form, annualPackageLpa: event.target.value })}
              type="number"
              min="0"
              step="0.01"
              placeholder="6.00"
            />
          </label>
          {compensationPreview ? (
            <div className="employee-compensation-preview" aria-live="polite">
              <article className="employee-compensation-preview__item">
                <span>Gross monthly</span>
                <strong>{formatCompensationValue(compensationPreview.grossMonthlySalary)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Basic salary</span>
                <strong>{formatCompensationValue(compensationPreview.basicMonthlySalary)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>PF</span>
                <strong>{formatCompensationValue(compensationPreview.pf)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Gratuity</span>
                <strong>{formatCompensationValue(compensationPreview.gratuity)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Estimated PT</span>
                <strong>{formatCompensationValue(compensationPreview.pt)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Estimated net</span>
                <strong>{formatCompensationValue(compensationPreview.netSalary)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Per day salary</span>
                <strong>{formatCompensationValue(compensationPreview.perDaySalary)}</strong>
              </article>
              <article className="employee-compensation-preview__item">
                <span>Per hour salary</span>
                <strong>{formatCompensationValue(compensationPreview.perHourSalary)}</strong>
              </article>
            </div>
          ) : (
            <p className="muted employee-compensation-preview__empty">Enter a package value to preview the salary structure.</p>
          )}
          <label className="checkbox-row">
            <input checked={form.isOnProbation} type="checkbox" onChange={(event) => onChange({ ...form, isOnProbation: event.target.checked })} />
            <span>On probation</span>
          </label>
          {form.isOnProbation ? (
            <label>
              Probation end date
              <input
                value={form.probationEndDate}
                onChange={(event) => onChange({ ...form, probationEndDate: event.target.value })}
                type="date"
              />
            </label>
          ) : null}
        </div>
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
            {managerOptions.map((employee) => (
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
        <label className="checkbox-row">
          <input checked={form.isTeamLead} type="checkbox" onChange={(event) => onChange({ ...form, isTeamLead: event.target.checked })} />
          <span>Assign Team Leader capability</span>
        </label>
        {form.isTeamLead ? (
          <div className="stack tl-scope-list">
            <p className="muted">Team members in scope</p>
            {employees
              .filter(
                (employee) =>
                  employee.id !== editingEmployeeId && employee.isActive && employee.user?.role.name === "EMPLOYEE",
              )
              .map((employee) => (
                <label key={employee.id} className="checkbox-row">
                  <input
                    checked={form.teamLeadScopeIds.includes(employee.id)}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...form,
                        teamLeadScopeIds: event.target.checked
                          ? [...form.teamLeadScopeIds, employee.id]
                          : form.teamLeadScopeIds.filter((id) => id !== employee.id),
                      })
                    }
                  />
                  <span>{`${employee.firstName} ${employee.lastName}`}</span>
                </label>
              ))}
          </div>
        ) : null}
      </fieldset>
      <div className="button-row">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : editingEmployeeId ? "Update employee" : "Create employee"}
        </button>
        {editingEmployeeId ? (
          <button type="button" className="secondary" onClick={onCancelEdit} disabled={isSubmitting}>
            Cancel edit
          </button>
        ) : null}
      </div>
    </form>
  );
}
