import { useEffect, useState } from "react";
import { ClipboardList, CheckSquare, Square, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import toast from "react-hot-toast";
import "./ManageTasksPage.css";

type Todo = {
  id: number;
  title: string;
  description: string | null;
  isCompleted: boolean;
  priority: "LOW" | "NORMAL" | "HIGH";
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
};

type EmployeeWithTodos = {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department: string | null;
  todos: Todo[];
};

export default function EmployeeTodosPage({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithTodos[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeTodos();
  }, [token]);

  async function fetchEmployeeTodos() {
    try {
      const response = await apiRequest<EmployeeWithTodos[]>("/todos/employees", { token });
      setEmployees(response.data);
    } catch (error: any) {
      console.error("Failed to fetch employee todos", error);
      toast.error(error.message || "Failed to load employee todos");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="manage-tasks-page page-loading">
        <article className="card skeleton-card skeleton-card--hero">
          <span className="skeleton-line skeleton-line--short" />
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      </div>
    );
  }

  return (
    <div className="manage-tasks-page">
      {/* Page Header */}
      <header className="page-header-container">
        <div className="stack" style={{ gap: "4px" }}>
          <span className="eyebrow eyebrow--purple">Manager Console</span>
          <h2 className="page-title">Employee Personal Todos</h2>
        </div>
        <button 
          className="button button--secondary" 
          onClick={() => navigate("/tasks/manage")}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <ArrowLeft size={18} />
          Back to Manage Tasks
        </button>
      </header>

      <section className="checklists-section">
        {employees.length === 0 ? (
          <div className="card manager-empty-state">
            <ClipboardList size={50} className="empty-icon" />
            <h3>No Employee Todos Found</h3>
            <p>None of the employees currently have any personal todos added.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            {employees.map((employee) => {
              const completedCount = employee.todos.filter(t => t.isCompleted).length;
              const totalCount = employee.todos.length;
              return (
                <div key={employee.id} className="employee-task-group-card">
                  <div className="employee-group-header">
                    <span className="employee-group-title">
                      👤 {employee.firstName} {employee.lastName} <span className="employee-code">#{employee.employeeCode}</span>
                    </span>
                    <span className="count-badge" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}>
                      {completedCount} / {totalCount} Completed
                    </span>
                  </div>
                  <div className="manager-lists-grid">
                    {employee.todos.map((todo) => (
                      <article key={todo.id} className={`manager-list-card ${todo.isCompleted ? "finished" : ""}`} style={{ padding: "var(--space-4)" }}>
                        <div className="manager-list-title-row">
                          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", width: "100%" }}>
                            <div style={{ marginTop: "4px", color: todo.isCompleted ? "var(--color-success-strong)" : "var(--color-text-secondary)" }}>
                              {todo.isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}
                            </div>

                            <div className="stack" style={{ gap: "4px", flex: 1, minWidth: 0 }}>
                              <h4 className="list-title" style={{ textDecoration: todo.isCompleted ? "line-through" : "none", opacity: todo.isCompleted ? 0.6 : 1 }}>
                                {todo.title}
                              </h4>
                              {todo.description && (
                                <p className="list-desc" style={{ opacity: todo.isCompleted ? 0.6 : 1 }}>
                                  {todo.description}
                                </p>
                              )}
                              <div className="assignment-meta-row" style={{ marginTop: "6px" }}>
                                <span>
                                  Priority: <strong>{todo.priority}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="manager-card-actions" style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)" }}>
                          <span className="task-date-tag" style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                            Created: <strong>{new Date(todo.createdAt).toLocaleDateString()}</strong>
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
