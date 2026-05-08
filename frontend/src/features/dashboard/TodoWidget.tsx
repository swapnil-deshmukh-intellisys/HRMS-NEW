import { useEffect, useState, useRef } from "react";
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
  const [submitting, setSubmitting] = useState(false);
  const [completingTodoId, setCompletingTodoId] = useState<number | null>(null);
  const [todoToConfirm, setTodoToConfirm] = useState<Todo | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Click-away listener for date picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isPickerOpen && pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPickerOpen]);

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
          </div>          <div className="reminder-section" ref={pickerRef}>
            <label className="section-label">Set Reminder</label>
            
            <div 
              className={`picker-trigger ${isPickerOpen ? 'active' : ''}`} 
              onClick={() => setPickerOpen(!isPickerOpen)}
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

            <div className={`picker-popover ${isPickerOpen ? 'active' : ''}`}>
              <DateTimePicker 
                value={newTodo.reminder}
                onChange={date => setNewTodo(prev => ({ ...prev, reminder: date }))}
              />
            </div>
            
            <div className="quick-time-chips">
              <button type="button" onClick={() => {
                const d = new Date(); 
                if (d.getHours() >= 18) d.setDate(d.getDate() + 1);
                d.setHours(18, 0, 0, 0);
                setNewTodo(prev => ({ ...prev, reminder: d }));
              }}>Today EOD</button>
              <button type="button" onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 10, 0, 0);
                setNewTodo(prev => ({ ...prev, reminder: d }));
              }}>Tomorrow AM</button>
              <button type="button" onClick={() => {
                const d = new Date(); d.setHours(d.getHours() + 2);
                setNewTodo(prev => ({ ...prev, reminder: d }));
              }}>+2 Hours</button>
            </div>
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
    </article>
  );
}
