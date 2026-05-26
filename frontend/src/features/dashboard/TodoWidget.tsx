import { useEffect, useState } from "react";
import { Plus, Trash2, Check, ListTodo, CheckCircle, Calendar, Clock } from "lucide-react";
import { apiRequest } from "../../services/api";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import "./TodoWidget.css";
import { Link } from "react-router-dom";
import DateTimePicker from "./DateTimePicker";

type Todo = {
  id: number;
  title: string;
  description: string | null;
  isCompleted: boolean;
  priority: "LOW" | "NORMAL" | "HIGH";
  reminderTime: string | null;
  createdAt: string;
};

export default function TodoWidget({ token }: { token: string | null }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [newTodo, setNewTodo] = useState<{
    title: string;
    description: string;
    priority: "NORMAL" | "HIGH" | "LOW";
    reminder: Date;
  }>({ 
    title: "", 
    description: "", 
    priority: "NORMAL", 
    reminder: new Date(new Date().setMinutes(new Date().getMinutes() + 30)),
  });
  const [tempReminder, setTempReminder] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [completingTodoId, setCompletingTodoId] = useState<number | null>(null);
  const [todoToConfirm, setTodoToConfirm] = useState<Todo | null>(null);
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);


  useEffect(() => {
    fetchTodos();
  }, [token]);

  async function fetchTodos() {
    try {
      const response = await apiRequest<Todo[]>("/todos", { token });
      setTodos(response.data);
    } catch (error) {
      console.error("Failed to fetch todos", error);
    } finally {
      setLoading(false);
    }
  }

  // Reminder Logic
  useEffect(() => {
    if (todos.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      todos.forEach(todo => {
        if (!todo.reminderTime || todo.isCompleted) return;
        
        const reminderDate = new Date(todo.reminderTime);
        const diffMs = reminderDate.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        // Notify exactly at 5 minutes remaining
        if (diffMins === 5 && diffMs > 0) {
          toast(`Reminder: "${todo.title}" is due in 5 minutes!`, {
            icon: '⏰',
            duration: 60000,
          });
          
          if (Notification.permission === "granted") {
            new Notification("Task Reminder", {
              body: `"${todo.title}" starts in 5 minutes!`,
              icon: "/favicon.ico"
            });
          }
        }

        // Notify at the exact deadline (0 minutes remaining)
        if (diffMins === 0 && diffMs > 0) {
          toast.success(`Deadline Reached: "${todo.title}" is due NOW!`, {
            duration: 60000,
          });

          if (Notification.permission === "granted") {
            new Notification("Deadline Reached", {
              body: `"${todo.title}" is due now!`,
              icon: "/favicon.ico"
            });
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [todos]);

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleToggleComplete(todo: Todo) {
    if (todo.isCompleted) {
      // If unmarking as completed, just do it
      await performToggle(todo);
    } else {
      // If marking as completed, ask for confirmation
      setTodoToConfirm(todo);
    }
  }

  async function performToggle(todo: Todo) {
    try {
      // If we are marking as complete, show animation first
      if (!todo.isCompleted) {
        setCompletingTodoId(todo.id);
        // Wait for animation to finish (400ms)
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const updated = await apiRequest<Todo>(`/todos/${todo.id}`, {
        method: "PUT",
        token,
        body: { isCompleted: !todo.isCompleted },
      });
      
      setTodos(prev => prev.map(t => (t.id === todo.id ? updated.data : t)));
      if (!todo.isCompleted) {
        toast.success("Task completed!");
      }
    } catch (error) {
      toast.error("Failed to update task");
    } finally {
      setCompletingTodoId(null);
    }
  }

  async function deleteTodo(id: number) {
    try {
      await apiRequest(`/todos/${id}`, { method: "DELETE", token });
      setTodos(prev => prev.filter(t => t.id !== id));
      toast.success("Task removed");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodo.title.trim()) return;

    if (newTodo.title.length > 100) {
      toast.error("Task title cannot exceed 100 characters!");
      return;
    }

    if (newTodo.description.length > 500) {
      toast.error("Description cannot exceed 500 characters!");
      return;
    }

    const reminderChanged = editingTodo 
      ? (!editingTodo.reminderTime || new Date(editingTodo.reminderTime).getTime() !== newTodo.reminder.getTime())
      : true;

    if (reminderChanged && newTodo.reminder.getTime() < Date.now()) {
      toast.error("Reminder time cannot be in the past!");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: newTodo.title,
        description: newTodo.description || null,
        priority: newTodo.priority,
        reminderTime: newTodo.reminder.toISOString()
      };

      if (editingTodo) {
        const response = await apiRequest<Todo>(`/todos/${editingTodo.id}`, {
          method: "PUT",
          token,
          body: payload,
        });
        setTodos(prev => prev.map(t => (t.id === editingTodo.id ? response.data : t)));
        toast.success("Task updated");
      } else {
        const response = await apiRequest<Todo>("/todos", {
          method: "POST",
          token,
          body: payload,
        });
        setTodos(prev => [response.data, ...prev]);
        toast.success("Task added");
      }
      setModalOpen(false);
      setPickerOpen(false);
      setEditingTodo(null);
      setNewTodo({ 
        title: "", 
        description: "", 
        priority: "NORMAL", 
        reminder: new Date(new Date().setMinutes(new Date().getMinutes() + 30)),
      });
    } catch (error) {
      toast.error(editingTodo ? "Failed to update task" : "Failed to add task");
    } finally {
      setSubmitting(false);
    }
  }

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setNewTodo({
      title: todo.title,
      description: todo.description || "",
      priority: todo.priority as "LOW" | "NORMAL" | "HIGH",
      reminder: todo.reminderTime ? new Date(todo.reminderTime) : new Date(),
    });
    setModalOpen(true);
  };

  const activeTodos = todos.filter(t => !t.isCompleted);

  if (loading) {
    return (
      <article className="card todo-widget">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--long" />
        <div className="skeleton-line skeleton-line--long" />
      </article>
    );
  }

  return (
    <article className="card todo-widget">
      <div className="todo-header">
        <div className="stack" style={{ gap: '4px' }}>
          <p className="eyebrow">Personal organizer</p>
          <h3>My To-Do List</h3>
        </div>
        <div className="button-row row-actions">
          <Link to="/todos/history" className="todo-icon-btn secondary" title="History">
            <ListTodo size={18} />
          </Link>
          <button className="todo-icon-btn primary" onClick={() => {
            setEditingTodo(null);
            setNewTodo({ 
              title: "", 
              description: "", 
              priority: "NORMAL", 
              reminder: new Date(new Date().setMinutes(new Date().getMinutes() + 30)),
            });
            setModalOpen(true);
          }} title="New Task">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="todo-list">
        {activeTodos.length === 0 ? (
          <div className="todo-empty">
            <CheckCircle size={40} />
            <p>You're all caught up! No active tasks.</p>
          </div>
        ) : (
          activeTodos.map(todo => (
            <div 
              key={todo.id} 
              className={`todo-item ${completingTodoId === todo.id ? 'exit-animation' : ''}`}
            >
              <div 
                className={`todo-checkbox ${todo.isCompleted ? 'checked' : ''}`}
                onClick={() => handleToggleComplete(todo)}
              >
                <Check size={14} />
              </div>
              <div 
                className="todo-content" 
                onClick={() => {
                  setSelectedTodo(todo);
                  setIsDetailsOpen(true);
                }}
              >
                <span className="todo-title">{todo.title}</span>
                {todo.description && <span className="todo-description">{todo.description}</span>}
                <div className="todo-meta-row">
                  <span className={`todo-priority todo-priority--${todo.priority.toLowerCase()}`}>
                    {todo.priority}
                  </span>
                  {todo.reminderTime && (
                    <span className="todo-reminder-tag">
                      ⏰ {new Date(todo.reminderTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {(todo.title.length > 50 || (todo.description && todo.description.length > 80)) && (
                    <span className="todo-more-link" style={{ marginLeft: "auto", color: "var(--color-accent)", fontWeight: "bold", textDecoration: "underline", fontSize: "10px" }}>More...</span>
                  )}
                </div>
              </div>
              <div className="todo-actions">
                <button className="todo-action-btn" title="Delete" onClick={(e) => { e.stopPropagation(); setTodoToDelete(todo); }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setModalOpen(false)} title={editingTodo ? "Edit Task" : "Add New Task"}>
        <form className="todo-form" onSubmit={handleSubmit}>
          <label>
            <div className="field-label-row">
              <span>Task Title</span>
              <span className={`char-counter ${newTodo.title.length >= 100 ? "limit-reached" : ""}`}>
                {newTodo.title.length} / 100
              </span>
            </div>
            <input 
              type="text" 
              required 
              maxLength={100}
              placeholder="What needs to be done?"
              value={newTodo.title}
              onChange={e => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label>
            <div className="field-label-row">
              <span>Description (Optional)</span>
              <span className={`char-counter ${newTodo.description.length >= 500 ? "limit-reached" : ""}`}>
                {newTodo.description.length} / 500
              </span>
            </div>
            <textarea 
              maxLength={500}
              placeholder="Add some details..."
              value={newTodo.description}
              onChange={e => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <div className="priority-section">
            <label className="section-label">Priority</label>
            <div className="priority-chips">
              {(['LOW', 'NORMAL', 'HIGH'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`priority-chip priority-chip--${p.toLowerCase()} ${newTodo.priority === p ? 'active' : ''}`}
                  onClick={() => setNewTodo(prev => ({ ...prev, priority: p }))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>          <div className="reminder-section">
            <label className="section-label">Set Reminder</label>
            
            <div 
              className={`picker-trigger ${isPickerOpen ? 'active' : ''}`} 
              onClick={() => {
                setTempReminder(new Date(newTodo.reminder));
                setPickerOpen(true);
              }}
            >
              <div className="trigger-section" title="Change Date">
                <Calendar size={14} />
                <span>{new Date(newTodo.reminder).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="trigger-separator" />
              <div className="trigger-section" title="Change Time">
                <Clock size={14} />
                <span>{new Date(newTodo.reminder).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <Modal open={isPickerOpen} onClose={() => setPickerOpen(false)} title="Set Reminder">
              <div className="stack" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
                <DateTimePicker 
                  value={tempReminder}
                  onChange={setTempReminder}
                />
                
                <div className="quick-time-chips" style={{ justifyContent: 'center', marginTop: 'var(--space-2)' }}>
                  <button type="button" onClick={() => {
                    const d = new Date(); 
                    if (d.getHours() >= 18) d.setDate(d.getDate() + 1);
                    d.setHours(18, 0, 0, 0);
                    setTempReminder(d);
                  }}>Today EOD</button>
                  <button type="button" onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 10, 0, 0);
                    setTempReminder(d);
                  }}>Tomorrow AM</button>
                  <button type="button" onClick={() => {
                    const d = new Date(); d.setHours(d.getHours() + 2);
                    setTempReminder(d);
                  }}>+2 Hours</button>
                </div>

                <div className="button-row" style={{ marginTop: 'var(--space-4)', width: '100%', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="secondary" onClick={() => setPickerOpen(false)}>Cancel</button>
                  <button type="button" onClick={() => {
                    setNewTodo(prev => ({ ...prev, reminder: tempReminder }));
                    setPickerOpen(false);
                  }}>Save</button>
                </div>
              </div>
            </Modal>
          </div>
          <div className="button-row" style={{ marginTop: 'var(--space-4)' }}>
            <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : (editingTodo ? "Update Task" : "Add Task")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        open={!!todoToConfirm} 
        onClose={() => setTodoToConfirm(null)} 
        title="Complete Task?"
      >
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <p>Are you sure you want to mark "<strong>{todoToConfirm?.title}</strong>" as completed?</p>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setTodoToConfirm(null)}>Cancel</button>
            <button type="button" onClick={() => {
              if (todoToConfirm) performToggle(todoToConfirm);
              setTodoToConfirm(null);
            }}>Yes, Complete</button>
          </div>
        </div>
      </Modal>

      <Modal 
        open={!!todoToDelete} 
        onClose={() => setTodoToDelete(null)} 
        title="Delete Task?"
      >
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <p>Are you sure you want to permanently delete "<strong>{todoToDelete?.title}</strong>"? This action cannot be undone.</p>
          <div className="button-row" style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="secondary" onClick={() => setTodoToDelete(null)}>Cancel</button>
            <button 
              type="button" 
              style={{ background: "var(--color-danger, #ef4444)", color: "white" }} 
              onClick={() => {
                if (todoToDelete) deleteTodo(todoToDelete.id);
                setTodoToDelete(null);
              }}
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Todo Details Modal */}
      <Modal 
        open={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        title="Todo Task Details"
      >
        {selectedTodo && (
          <div className="todo-detail-popup" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <h3 style={{ margin: 0, color: "var(--color-text-strong)", wordBreak: "break-word", overflowWrap: "break-word" }}>
              {selectedTodo.title}
            </h3>
            
            {selectedTodo.description ? (
              <div style={{ 
                padding: "var(--space-3)", 
                background: "var(--color-surface-page)", 
                border: "1px solid var(--color-border-default)", 
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                color: "var(--color-text-strong)",
                wordBreak: "break-word",
                overflowWrap: "break-word"
              }}>
                {selectedTodo.description}
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
                <span style={{ color: "var(--color-text-secondary)", fontWeight: "bold" }}>Priority:</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`todo-priority todo-priority--${selectedTodo.priority.toLowerCase()}`} style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px" }}>
                    {selectedTodo.priority}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)", fontWeight: "bold" }}>Reminder:</span>
                <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  {selectedTodo.reminderTime ? (
                    <span className="todo-reminder-tag" style={{ fontSize: "11px", margin: 0 }}>
                      ⏰ {new Date(selectedTodo.reminderTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No reminder set</span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)", fontWeight: "bold" }}>Created On:</span>
                <div style={{ fontWeight: "bold", marginTop: "4px", color: "var(--color-text-strong)" }}>
                  {new Date(selectedTodo.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "var(--space-4)" }}>
              <button 
                className="button button--danger"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setTodoToDelete(selectedTodo);
                }}
                style={{ padding: "8px 16px", background: "var(--color-danger, #ef4444)", color: "white" }}
              >
                Delete
              </button>
              <button 
                className="button button--primary"
                onClick={() => {
                  setIsDetailsOpen(false);
                  openEditModal(selectedTodo);
                }}
                style={{ padding: "8px 16px" }}
              >
                Edit
              </button>
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
