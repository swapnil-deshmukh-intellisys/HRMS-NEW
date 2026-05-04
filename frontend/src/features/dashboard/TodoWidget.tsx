import { useEffect, useState } from "react";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { apiRequest } from "../../services/api";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import "./TodoWidget.css";

type Todo = {
  id: number;
  title: string;
  description: string | null;
  isCompleted: boolean;
  priority: "LOW" | "NORMAL" | "HIGH";
  createdAt: string;
};

export default function TodoWidget({ token }: { token: string | null }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({ title: "", description: "", priority: "NORMAL" as const });
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
      const response = await apiRequest<Todo>("/todos", {
        method: "POST",
        token,
        body: newTodo,
      });
      setTodos(prev => [response.data, ...prev]);
      setModalOpen(false);
      setNewTodo({ title: "", description: "", priority: "NORMAL" });
      toast.success("Task added");
    } catch (error) {
      toast.error("Failed to add task");
    } finally {
      setSubmitting(false);
    }
  }

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
        <button className="icon-button" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          <span>New Task</span>
        </button>
      </div>

      <div className="todo-list">
        {todos.length === 0 ? (
          <div className="todo-empty">
            <AlertCircle size={40} />
            <p>Your list is empty. Add a task to get started!</p>
          </div>
        ) : (
          todos.map(todo => (
            <div key={todo.id} className={`todo-item ${todo.isCompleted ? "completed" : ""}`}>
              <div 
                className={`todo-checkbox ${todo.isCompleted ? "checked" : ""}`}
                onClick={() => toggleComplete(todo)}
              >
                {todo.isCompleted && <Check size={14} />}
              </div>
              <div className="todo-content" onClick={() => toggleComplete(todo)}>
                <span className="todo-title">{todo.title}</span>
                {todo.description && <span className="todo-description">{todo.description}</span>}
                <span className={`todo-priority todo-priority--${todo.priority.toLowerCase()}`}>
                  {todo.priority}
                </span>
              </div>
              <div className="todo-actions">
                <button className="todo-action-btn" onClick={() => deleteTodo(todo.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setModalOpen(false)} title="Add New Task">
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
          <label>
            Priority
            <select 
              value={newTodo.priority}
              onChange={e => setNewTodo(prev => ({ ...prev, priority: e.target.value as any }))}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <div className="button-row" style={{ marginTop: 'var(--space-4)' }}>
            <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </Modal>
    </article>
  );
}
