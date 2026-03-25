import "./DepartmentForm.css";
import type { FormEvent } from "react";

export type DepartmentFormValues = {
  name: string;
  code: string;
};

type DepartmentFormProps = {
  form: DepartmentFormValues;
  onChange: (nextForm: DepartmentFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  message: string;
};

export default function DepartmentForm({ form, onChange, onSubmit, message }: DepartmentFormProps) {
  return (
    <form className="card stack compact-form" onSubmit={onSubmit}>
      <h3>Create department</h3>
      <label>
        Name
        <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required />
      </label>
      <label>
        Code
        <input value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} required />
      </label>
      <button type="submit">Save department</button>
      {message ? <p className="success-text">{message}</p> : null}
    </form>
  );
}
