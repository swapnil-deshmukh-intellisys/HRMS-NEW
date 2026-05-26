import { useEffect, useState } from "react";
import { Check, ClipboardList, AlertCircle, User, CheckCircle } from "lucide-react";
import { apiRequest } from "../../services/api";
import toast from "react-hot-toast";
import Modal from "../../components/common/Modal";
import { Link } from "react-router-dom";
import "./AssignedTasksWidget.css";

type ManagerTask = {
  id: number;
  title: string;
  description: string | null;
  creatorId: number;
  employeeId: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  completedById: number | null;
  revertReason?: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: number;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  };
  employee: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
};

export default function AssignedTasksWidget({ token }: { token: string | null }) {
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Details Modal States
  const [selectedTask, setSelectedTask] = useState<ManagerTask | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [token]);

  async function fetchTasks() {
    try {
      const response = await apiRequest<ManagerTask[]>("/tasks", { token });
      setTasks(response.data);
    } catch (error) {
      console.error("Failed to fetch assigned tasks", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleTaskItem(itemId: number, currentCompleted: boolean) {
    if (togglingId === itemId) return;

    if (!currentCompleted) {
      const confirm = window.confirm("Are you sure you want to mark this task as completed?");
      if (!confirm) return;
    } else {
      const confirm = window.confirm("Are you sure you want to mark this task as pending?");
      if (!confirm) return;
    }

    setTogglingId(itemId);

    try {
      const targetState = !currentCompleted;
      const response = await apiRequest<ManagerTask>(`/tasks/items/${itemId}`, {
        method: "PUT",
        token,
        body: { isCompleted: targetState },
      });

      // Update the local state
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === itemId ? { ...task, ...response.data } : task))
      );

      if (targetState) {
        toast.success("Task completed!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <article className="card assigned-tasks-widget">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--long" />
        <div className="skeleton-line skeleton-line--long" />
      </article>
    );
  }

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <article className="card assigned-tasks-widget">
      <div className="assigned-tasks-header">
        <div className="stack" style={{ gap: "4px" }}>
          <span className="eyebrow eyebrow--purple">Today's Tasks</span>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={20} className="header-icon" />
            Assigned to You
          </h3>
        </div>
        <div className="button-row row-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link to="/tasks/history" className="todo-icon-btn secondary" title="History" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--color-border-subtle)", background: "var(--color-surface-hover)", cursor: "pointer", color: "var(--color-text-strong)" }}>
            <ClipboardList size={18} />
          </Link>
          {totalCount > 0 && (
            <span className="task-count-badge">
              {completedCount}/{totalCount} Done
            </span>
          )}
        </div>
      </div>

      <div className="assigned-tasks-container">
        {totalCount === 0 ? (
          <div className="tasks-empty-state">
            <AlertCircle size={40} className="empty-icon" />
            <p className="empty-title">All clear!</p>
            <p className="empty-desc">No tasks assigned by your managers for today.</p>
          </div>
        ) : (
          <div className={`task-list-card ${isAllCompleted ? "completed-list" : ""}`}>
            {/* Master Progress Bar */}
            <div className="task-progress-section" style={{ marginBottom: "var(--space-2)" }}>
              <div className="progress-info">
                <span className="progress-text">Daily progress tracker</span>
                <span className="progress-percent">{progressPercent}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-thumb"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="task-items-checklist">
              {tasks.filter(t => !t.isCompleted).length === 0 ? (
                <div className="tasks-empty-state" style={{ padding: "var(--space-6) 0", background: "transparent", border: "none", boxShadow: "none" }}>
                  <CheckCircle size={40} className="empty-icon" style={{ color: "var(--color-success, #10b981)", opacity: 0.8 }} />
                  <p className="empty-title" style={{ color: "var(--color-success-strong, #15803d)", fontSize: "14px", fontWeight: "bold" }}>All caught up!</p>
                  <p className="empty-desc" style={{ fontSize: "12px" }}>You've completed all tasks assigned for today.</p>
                </div>
              ) : (
                tasks.filter(t => !t.isCompleted).map((task) => (
                  <div
                    key={task.id}
                    className={`task-checkbox-item ${task.isCompleted ? "checked" : ""}`}
                    onClick={() => {
                      setSelectedTask(task);
                      setIsDetailsOpen(true);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <button
                      className={`item-checkbox ${task.isCompleted ? "checked" : ""} ${
                        togglingId === task.id ? "toggling" : ""
                      }`}
                      aria-label="Toggle completed status"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTaskItem(task.id, task.isCompleted);
                      }}
                    >
                      {task.isCompleted && <Check size={12} strokeWidth={3} />}
                    </button>
                    <div className="item-details">
                      <span className="item-title">{task.title}</span>
                      {task.description && <span className="item-desc">{task.description}</span>}
                      
                      <div className="task-item-meta" style={{ marginTop: "4px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <span className={`task-badge ${task.employeeId === null ? "badge-general" : "badge-assigned"}`} style={{ fontSize: "9px", padding: "1px 6px" }}>
                          {task.employeeId === null ? "General" : "Direct"}
                        </span>
                        <span className="assigned-by-tag" style={{ fontSize: "10px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "3px" }}>
                          <User size={10} />
                          By: {task.creator?.firstName || "Manager"} {task.creator?.lastName || ""}
                        </span>
                      </div>
                      
                      {task.revertReason && (
                        <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--color-warning-strong)", background: "var(--color-warning-soft)", padding: "4px 8px", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: "4px", border: "1px solid var(--color-warning-border)" }}>
                          <AlertCircle size={10} /> Reverted: {task.revertReason.length > 50 ? task.revertReason.substring(0, 50) + "..." : task.revertReason}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      <Modal 
        open={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        title="Task Overview"
      >
        {selectedTask && (
          <div className="task-detail-popup" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <h3 style={{ margin: 0, color: "var(--color-text-strong)" }}>{selectedTask.title}</h3>
            
            {selectedTask.description ? (
              <div style={{ 
                padding: "var(--space-3)", 
                background: "var(--color-surface-page)", 
                border: "1px solid var(--color-border-default)", 
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                color: "var(--color-text-strong)"
              }}>
                {selectedTask.description}
              </div>
            ) : (
              <p style={{ fontStyle: "italic", color: "var(--color-text-secondary)" }}>No additional description provided.</p>
            )}

            <div className="meta-info-grid" style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "12px", 
              fontSize: "12px",
              borderTop: "1px solid var(--color-border-subtle)",
              paddingTop: "var(--space-3)" 
            }}>
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Assigned By:</span>
                <div style={{ fontWeight: "bold", marginTop: "4px" }}>
                  {selectedTask.creator?.firstName || "Manager"} {selectedTask.creator?.lastName || ""}
                </div>
                <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{selectedTask.creator?.jobTitle || "Manager"}</span>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Status:</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`task-badge ${selectedTask.isCompleted ? "badge-completed" : "badge-pending"}`} style={{
                    background: selectedTask.isCompleted ? "var(--color-success-soft)" : "var(--color-warning-soft)",
                    color: selectedTask.isCompleted ? "var(--color-success-strong)" : "var(--color-warning-strong)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: "bold",
                    fontSize: "10px",
                    display: "inline-block"
                  }}>
                    {selectedTask.isCompleted ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Assignment Type:</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`task-badge ${selectedTask.employeeId === null ? "badge-general" : "badge-assigned"}`} style={{
                    fontSize: "10px",
                    padding: "2px 8px"
                  }}>
                    {selectedTask.employeeId === null ? "General" : "Direct"}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Assigned On:</span>
                <div style={{ fontWeight: "bold", marginTop: "4px" }}>
                  {new Date(selectedTask.createdAt).toLocaleDateString()}
                </div>
              </div>

              {selectedTask.isCompleted && selectedTask.completedAt && (
                <div style={{ gridColumn: "span 2", background: "#f0fdf4", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid #bbf7d0", color: "#166534" }}>
                  Completed on <strong>{new Date(selectedTask.completedAt).toLocaleDateString()}</strong> at <strong>{new Date(selectedTask.completedAt).toLocaleTimeString()}</strong>
                </div>
              )}

              {!selectedTask.isCompleted && selectedTask.revertReason && (
                <div style={{ gridColumn: "span 2", background: "var(--color-warning-soft)", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-warning-border)", color: "var(--color-warning-strong)" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertCircle size={14} /> Task Reverted
                  </div>
                  <div>{selectedTask.revertReason}</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
              <button 
                className="button button--secondary"
                onClick={() => setIsDetailsOpen(false)}
                style={{ padding: "8px 16px" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </article>
  );
}
