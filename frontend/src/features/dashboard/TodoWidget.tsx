import { useEffect, useState } from "react";
import { Plus, Trash2, Check, ListTodo, CheckCircle, Calendar, Clock } from "lucide-react";
import { apiRequest } from "../../services/api";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import "./TodoWidget.css";
import { Link } from "react-router-dom";

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
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [newTodo, setNewTodo] = useState<{
    title: string;
    description: string;
    priority: "LOW" | "NORMAL" | "HIGH";
    reminderDate: string;
    reminderTime: string;
  }>({ 
    title: "", 
    description: "", 
    priority: "NORMAL", 
    reminderDate: new Date().toISOString().split('T')[0],
    reminderTime: "" 
  });
  const [submitting, setSubmitting] = useState(false);

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
            duration: 60000, // Show for a minute
          });
          
          // Also try browser notification if permitted
          if (Notification.permission === "granted") {
            new Notification("Task Reminder", {
              body: `"${todo.title}" starts in 5 minutes!`,
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

  async function toggleComplete(todo: Todo) {
    try {
      const updated = await apiRequest<Todo>(`/todos/${todo.id}`, {
        method: "PUT",
        token,
        body: { isCompleted: !todo.isCompleted },
      });
      setTodos(prev => prev.map(t => (t.id === todo.id ? updated.data : t)));
    } catch (error) {
      toast.error("Failed to update task");
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

    setSubmitting(true);
    try {
      const combinedDateTime = newTodo.reminderTime 
        ? new Date(`${newTodo.reminderDate}T${newTodo.reminderTime}`).toISOString() 
        : null;

      const payload = {
        title: newTodo.title,
        description: newTodo.description || null,
        priority: newTodo.priority,
        reminderTime: combinedDateTime
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
      setEditingTodo(null);
      setNewTodo({ 
        title: "", 
        description: "", 
        priority: "NORMAL", 
        reminderDate: new Date().toISOString().split('T')[0],
        reminderTime: "" 
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
      reminderDate: todo.reminderTime ? todo.reminderTime.split('T')[0] : new Date().toISOString().split('T')[0],
      reminderTime: todo.reminderTime ? todo.reminderTime.split('T')[1]?.slice(0, 5) : ""
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
          <Link to="/todos/history" className="button secondary">
            <ListTodo size={16} />
            <span>History</span>
          </Link>
          <button className="icon-button" onClick={() => {
            setEditingTodo(null);
            setNewTodo({ 
              title: "", 
              description: "", 
              priority: "NORMAL", 
              reminderDate: new Date().toISOString().split('T')[0],
              reminderTime: "" 
            });
            setModalOpen(true);
          }}>
            <Plus size={18} />
            <span>New Task</span>
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
            <div key={todo.id} className="todo-item">
              <div 
                className="todo-checkbox"
                onClick={() => toggleComplete(todo)}
              >
                {todo.isCompleted && <Check size={14} />}
              </div>
              <div className="todo-content" onClick={() => openEditModal(todo)}>
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
                </div>
              </div>
              <div className="todo-actions">
                <button className="todo-action-btn" title="Delete" onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }}>
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
            Task Title
            <input 
              type="text" 
              required 
              placeholder="What needs to be done?"
              value={newTodo.title}
              onChange={e => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label>
            Description (Optional)
            <textarea 
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
          </div>

          <div className="reminder-section">
            <label className="section-label">Set Reminder</label>
            <div className="custom-datetime-picker">
              <div className="picker-field">
                <Calendar size={14} />
                <input 
                  type="date"
                  value={newTodo.reminderDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setNewTodo(prev => ({ ...prev, reminderDate: e.target.value }))}
                />
              </div>
              <div className="picker-field">
                <Clock size={14} />
                <input 
                  type="time"
                  value={newTodo.reminderTime}
                  onChange={e => setNewTodo(prev => ({ ...prev, reminderTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="quick-time-chips">
              <button type="button" onClick={() => {
                const d = new Date(); d.setMinutes(d.getMinutes() + 30);
                setNewTodo(prev => ({ ...prev, reminderDate: d.toISOString().split('T')[0], reminderTime: d.toTimeString().slice(0,5) }));
              }}>+30m</button>
              <button type="button" onClick={() => {
                const d = new Date(); d.setHours(d.getHours() + 1);
                setNewTodo(prev => ({ ...prev, reminderDate: d.toISOString().split('T')[0], reminderTime: d.toTimeString().slice(0,5) }));
              }}>+1h</button>
              <button type="button" onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0);
                setNewTodo(prev => ({ ...prev, reminderDate: d.toISOString().split('T')[0], reminderTime: d.toTimeString().slice(0,5) }));
              }}>Tomorrow 11am</button>
            </div>

            {newTodo.reminderDate && newTodo.reminderTime && (
              <p className="reminder-helper">
                <CheckCircle size={12} />
                Alert {newTodo.reminderDate === new Date().toISOString().split('T')[0] 
                  ? `at ${new Date(`${newTodo.reminderDate}T${newTodo.reminderTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : `on ${new Date(newTodo.reminderDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(`${newTodo.reminderDate}T${newTodo.reminderTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                }
              </p>
            )}
          </div>
          <div className="button-row" style={{ marginTop: 'var(--space-4)' }}>
            <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : (editingTodo ? "Update Task" : "Add Task")}
            </button>
          </div>
        </form>
      </Modal>
    </article>
  );
}
