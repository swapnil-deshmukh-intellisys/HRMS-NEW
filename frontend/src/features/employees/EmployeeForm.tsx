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
  panCardNumber: string;
  dateOfBirth: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const managerOptions = employees.filter((employee) => employee.user?.role.name === "MANAGER");
  const compensationPreview = useMemo(() => calculateCompensationPreview(form.annualPackageLpa), [form.annualPackageLpa]);

  function formatCompensationValue(value: number) {
    return "₹" + value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <form className="stack compact-form employee-form-card" onSubmit={onSubmit}>
      <fieldset className="employee-form-fieldset" disabled={isSubmitting}>

        <div className="employee-form-group">
          <h3 className="employee-form-group-title">Account Access</h3>
          <p className="muted" style={{ gridColumn: '1 / -1', marginTop: '-12px' }}>
            The email and password entered here will be used by this employee to log in.
          </p>
          <label>
            Email
            <input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required type="email" />
          </label>
          <label className="password-label">
            Password
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
          </label>
        </div>

        <div className="employee-form-group">
          <h3 className="employee-form-group-title">Personal Details</h3>
          <label>
            First name
            <input value={form.firstName} onChange={(event) => onChange({ ...form, firstName: event.target.value })} required />
          </label>
          <label>
            Last name
            <input value={form.lastName} onChange={(event) => onChange({ ...form, lastName: event.target.value })} required />
          </label>
          <label>
            Employee code
            <input value={form.employeeCode} onChange={(event) => onChange({ ...form, employeeCode: event.target.value })} required />
          </label>
          <label>
            Mobile number
            <input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" />
          </label>
          <label>
            Date of birth
            <input
              value={form.dateOfBirth}
              onChange={(event) => onChange({ ...form, dateOfBirth: event.target.value })}
              type="date"
              required
            />
          </label>
          <label>
            PAN Card No.
            <input
              value={form.panCardNumber}
              onChange={(event) => onChange({ ...form, panCardNumber: event.target.value })}
              placeholder="ABCDE1234F"
              required
            />
          </label>
        </div>

        <div className="employee-form-group">
          <h3 className="employee-form-group-title">Professional Placement</h3>
          <label>
            Job title
            <input value={form.jobTitle} onChange={(event) => onChange({ ...form, jobTitle: event.target.value })} placeholder="Software Developer" />
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
            Role
            <select value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value as EmployeeFormValues["role"] })}>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR">HR</option>
              <option value="ADMIN">Admin</option>
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
        </div>

        <div className="employee-form-section employee-form-section--compensation">
          <div className="employee-form-section__header">
            <h4>Compensation Structure</h4>
            <p className="muted">Annual package amount. Monthly breakdown updates automatically.</p>
          </div>
          <div className="employee-form-group">
            <label>
              Annual Package (₹)
              <input
                value={form.annualPackageLpa}
                onChange={(event) => onChange({ ...form, annualPackageLpa: event.target.value })}
                type="number"
                min="0"
                step="1"
                placeholder="300000"
              />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <div 
                className="checkbox-row" 
                onClick={() => onChange({ ...form, isOnProbation: !form.isOnProbation })}
                role="checkbox"
                aria-checked={form.isOnProbation}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange({ ...form, isOnProbation: !form.isOnProbation }); } }}
              >
                <input checked={form.isOnProbation} type="checkbox" readOnly tabIndex={-1} style={{ pointerEvents: 'none' }} />
                <span>On probation</span>
              </div>
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
          </div>
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
        </div>

        <div className="employee-form-group employee-form-group--full">
          <div 
            className="checkbox-row" 
            onClick={() => onChange({ ...form, isTeamLead: !form.isTeamLead })}
            role="checkbox"
            aria-checked={form.isTeamLead}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange({ ...form, isTeamLead: !form.isTeamLead }); } }}
          >
            <input checked={form.isTeamLead} type="checkbox" readOnly tabIndex={-1} style={{ pointerEvents: 'none' }} />
            <strong>Assign Team Leader capability</strong>
          </div>
          {form.isTeamLead ? (
            <div className="stack tl-scope-list">
              <div className="tl-scope-list__header">
                <p className="muted" style={{ marginBottom: '8px', fontSize: '12px' }}>Select team members in scope:</p>
                <div className="tl-scope-list__controls">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="tl-scope-search"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      const eligibleIds = employees
                        .filter(e => e.id !== editingEmployeeId && e.isActive && e.user?.role.name === "EMPLOYEE")
                        .map(e => e.id);
                      onChange({ ...form, teamLeadScopeIds: eligibleIds });
                    }}
                  >
                    Select All
                  </button>
                  <span className="divider">|</span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => onChange({ ...form, teamLeadScopeIds: [] })}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="employee-form-group">
                {(() => {
                  const eligibleEmployees = employees
                    .filter(
                      (employee) => {
                        const matchesSearch = `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
                        return employee.id !== editingEmployeeId &&
                          employee.isActive &&
                          employee.user?.role.name === "EMPLOYEE" &&
                          matchesSearch;
                      }
                    )
                    .sort((a, b) => {
                      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                      return nameA.localeCompare(nameB);
                    });

                  if (eligibleEmployees.length === 0) {
                    return <p className="muted" style={{ gridColumn: '1 / -1', padding: '12px', textAlign: 'center' }}>No eligible employees found.</p>;
                  }

                  return eligibleEmployees.map((employee) => (
                    <div 
                      key={employee.id} 
                      className="checkbox-row"
                      onClick={() => {
                        const currentIds = form.teamLeadScopeIds.map(id => Number(id));
                        const targetId = Number(employee.id);
                        const isChecked = currentIds.includes(targetId);
                        const nextIds = !isChecked
                          ? [...new Set([...currentIds, targetId])]
                          : currentIds.filter((id) => id !== targetId);

                        onChange({
                          ...form,
                          teamLeadScopeIds: nextIds,
                        });
                      }}
                      role="checkbox"
                      aria-checked={form.teamLeadScopeIds.some(id => Number(id) === Number(employee.id))}
                      tabIndex={0}
                      onKeyDown={(e) => { 
                        if (e.key === ' ' || e.key === 'Enter') { 
                          e.preventDefault(); 
                          const currentIds = form.teamLeadScopeIds.map(id => Number(id));
                          const targetId = Number(employee.id);
                          const isChecked = currentIds.includes(targetId);
                          const nextIds = !isChecked
                            ? [...new Set([...currentIds, targetId])]
                            : currentIds.filter((id) => id !== targetId);
                          onChange({ ...form, teamLeadScopeIds: nextIds });
                        } 
                      }}
                    >
                      <input
                        checked={form.teamLeadScopeIds.some(id => Number(id) === Number(employee.id))}
                        type="checkbox"
                        readOnly
                        tabIndex={-1}
                        style={{ pointerEvents: 'none' }}
                      />
                      <span>{`${employee.firstName} ${employee.lastName}`}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : null}
        </div>
      </fieldset>
      <div className="button-row">
        {editingEmployeeId ? (
          <button type="button" className="secondary" onClick={onCancelEdit} disabled={isSubmitting}>
            Cancel edit
          </button>
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : editingEmployeeId ? "Update employee" : "Create employee"}
        </button>
      </div>
    </form>
  );
}
