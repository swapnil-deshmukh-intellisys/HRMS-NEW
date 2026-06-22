import "./DepartmentForm.css";
import type { FormEvent } from "react";

export type DepartmentFormValues = {
  name: string;
  code: string;
};

type DepartmentFormProps = {
  form: DepartmentFormValues;
  isSubmitting?: boolean;
  onChange: (nextForm: DepartmentFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function DepartmentForm({ form, isSubmitting = false, onChange, onSubmit }: DepartmentFormProps) {
  return (
    <form className="card stack compact-form" onSubmit={onSubmit}>
      <h3>Create department</h3>
      <label>
        Name
        <input 
          value={form.name} 
          onChange={(event) => onChange({ ...form, name: event.target.value })} 
          required 
          disabled={isSubmitting}
        />
      </label>
      <label>
        Code
        <input 
          value={form.code} 
          onChange={(event) => onChange({ ...form, code: event.target.value })} 
          required 
          disabled={isSubmitting}
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save department"}
      </button>
    </form>
  );
}
