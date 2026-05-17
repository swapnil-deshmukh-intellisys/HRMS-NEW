import "./TodoHistoryPage.css";
import { useEffect, useState, useMemo } from "react";
import { apiRequest } from "../../services/api";
import { Trash2, Calendar, Search, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

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

export default function TodoHistoryPage({ token }: { token: string | null }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTodos();
  }, [token]);

  async function fetchTodos() {
    try {
      const response = await apiRequest<Todo[]>("/todos", { token });
      // Only show completed ones for history
      setTodos(response.data.filter(t => t.isCompleted));
    } catch (error) {
      console.error("Failed to fetch todos", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTodo(id: number) {
    if (!window.confirm("Are you sure you want to permanently delete this history record?")) return;
    try {
      await apiRequest(`/todos/${id}`, { method: "DELETE", token });
      setTodos(prev => prev.filter(t => t.id !== id));
      toast.success("Record deleted");
    } catch (error) {
      toast.error("Failed to delete record");
    }
  }

  const filteredTodos = useMemo(() => {
    return todos.filter(todo => 
      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (todo.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [todos, searchQuery]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    filteredTodos.forEach(todo => {
      const date = new Date(todo.updatedAt);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(todo);
    });
    return groups;
  }, [filteredTodos]);

  const sortedMonths = useMemo(() => {
    return Object.keys(groupedHistory).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedHistory]);

  if (loading) {
    return (
      <div className="todo-history-page stack">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--long" />
        <div className="skeleton-line skeleton-line--long" />
      </div>
    );
  }

  return (
    <div className="todo-history-page stack">
      <header className="history-page-header">
        <div className="history-header-row">
          <div className="title-section">
            <h2 className="page-title">Personal Task History</h2>
            <span className="subtitle-divider">|</span>
            <p className="muted">An archive of all your completed accomplishments.</p>
          </div>

          <div className="history-search-container">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <section className="history-grid">
        {sortedMonths.length === 0 ? (
          <div className="card empty-history-card">
            <div className="stack align-center text-center" style={{ gap: '16px' }}>
              <div className="empty-icon-circle">
                <Calendar size={48} />
              </div>
              <div className="stack" style={{ gap: '4px' }}>
                <h3>No history found</h3>
                <p className="muted">Your completed tasks will appear here month-by-month.</p>
              </div>
            </div>
          </div>
        ) : (
          sortedMonths.map(month => (
            <div key={month} className="history-month-section">
              <h3 className="month-divider">{month}</h3>
              <div className="history-table-card card">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Task Detail</th>
                      <th>Priority</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedHistory[month]
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map(todo => {
                        const dateObj = new Date(todo.updatedAt);
                        return (
                          <tr key={todo.id}>
                            <td className="status-cell">
                              <CheckCircle size={18} className="completed-mark-icon" />
                            </td>
                            <td className="date-cell">
                              {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="day-cell">
                              <span className="day-badge">{dateObj.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                            </td>
                            <td className="detail-cell">
                              <div className="stack" style={{ gap: '2px' }}>
                                <span className="task-name">{todo.title}</span>
                                {todo.description && <span className="task-desc">{todo.description}</span>}
                              </div>
                            </td>
                            <td>
                              <span className={`priority-pill priority-pill--${todo.priority.toLowerCase()}`}>
                                {todo.priority}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="delete-history-btn" onClick={() => deleteTodo(todo.id)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
