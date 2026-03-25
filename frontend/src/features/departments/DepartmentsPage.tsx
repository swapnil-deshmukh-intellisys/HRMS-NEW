import "./DepartmentsPage.css";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { Department, Role } from "../../types";
import DepartmentForm, { type DepartmentFormValues } from "./DepartmentForm";
import DepartmentTable from "./DepartmentTable";

type DepartmentsPageProps = {
  token: string | null;
  role: Role;
};

export default function DepartmentsPage({ token, role }: DepartmentsPageProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<DepartmentFormValues>({ name: "", code: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(role !== "EMPLOYEE");

  useEffect(() => {
    if (role === "EMPLOYEE") return;
    setLoading(true);
    apiRequest<Department[]>("/departments", { token })
      .then((response) => setDepartments(response.data))
      .finally(() => setLoading(false));
  }, [role, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await apiRequest<Department>("/departments", { method: "POST", token, body: form });
    setDepartments((current) => [response.data, ...current]);
    setForm({ name: "", code: "" });
    setMessage("Department created.");
  }

  if (role === "EMPLOYEE") {
    return <MessageCard title="Restricted" message="Department management is not available for employees." />;
  }

  return (
    <section className="grid cols-2 page-section page-section--top">
      {loading ? (
        <>
          <article className="card skeleton-card skeleton-card--table">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--medium" />
          </article>
          <article className="card skeleton-card skeleton-card--table">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
          </article>
        </>
      ) : (
        <>
      <DepartmentForm form={form} onChange={setForm} onSubmit={handleSubmit} message={message} />
      <DepartmentTable departments={departments} />
        </>
      )}
    </section>
  );
}
