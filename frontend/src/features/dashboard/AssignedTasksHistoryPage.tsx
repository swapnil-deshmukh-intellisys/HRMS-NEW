import "./AssignedTasksHistoryPage.css";
import { useEffect, useState, useMemo } from "react";
import { apiRequest } from "../../services/api";
import { Calendar, Search, CheckCircle, User } from "lucide-react";

type ManagerTask = {
  id: number;
  title: string;
  description: string | null;
  creatorId: number;
  employeeId: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  completedById: number | null;
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

export default function AssignedTasksHistoryPage({ token }: { token: string | null }) {
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTasks();
  }, [token]);

  async function fetchTasks() {
    try {
      const response = await apiRequest<ManagerTask[]>("/tasks", { token });
      // Only show completed ones for history
      setTasks(response.data.filter(t => t.isCompleted));
    } catch (error) {
      console.error("Failed to fetch assigned tasks history", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      `${task.creator?.firstName} ${task.creator?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, ManagerTask[]> = {};
    filteredTasks.forEach(task => {
      const date = new Date(task.completedAt || task.updatedAt);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(task);
    });
    return groups;
  }, [filteredTasks]);

  const sortedMonths = useMemo(() => {
    return Object.keys(groupedHistory).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedHistory]);

  if (loading) {
    return (
      <div className="assigned-history-page stack">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--long" />
        <div className="skeleton-line skeleton-line--long" />
      </div>
    );
  }

  return (
    <div className="assigned-history-page stack">
      <header className="history-page-header">
        <div className="history-header-row">
          <div className="title-section">
            <h2 className="page-title">Assigned Tasks History</h2>
            <span className="subtitle-divider">|</span>
            <p className="muted">An archive of tasks completed under manager assignment.</p>
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
            <div className="stack align-center text-center" style={{ gap: '16px', alignItems: 'center' }}>
              <div className="empty-icon-circle">
                <Calendar size={48} />
              </div>
              <div className="stack" style={{ gap: '4px' }}>
                <h3>No completed tasks found</h3>
                <p className="muted">Tasks assigned by your manager that you complete will be archived here.</p>
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
                      <th>Completed Date</th>
                      <th>Assignee Details</th>
                      <th>Task Detail</th>
                      <th>Assignment Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedHistory[month]
                      .sort((a, b) => new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime())
                      .map(task => {
                        const dateObj = new Date(task.completedAt || task.updatedAt);
                        return (
                          <tr key={task.id}>
                            <td className="status-cell">
                              <CheckCircle size={18} className="completed-mark-icon" />
                            </td>
                            <td className="date-cell">
                              <div className="stack" style={{ gap: '2px' }}>
                                <span className="date-text">{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span className="time-text" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="day-cell">
                              <div className="stack" style={{ gap: '2px' }}>
                                <span className="manager-name" style={{ fontWeight: '600', color: 'var(--color-text-strong)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <User size={12} />
                                  {task.creator?.firstName} {task.creator?.lastName}
                                </span>
                                {task.creator?.jobTitle && <span className="manager-title" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{task.creator.jobTitle}</span>}
                              </div>
                            </td>
                            <td className="detail-cell">
                              <div className="stack" style={{ gap: '2px' }}>
                                <span className="task-name">{task.title}</span>
                                {task.description && <span className="task-desc">{task.description}</span>}
                              </div>
                            </td>
                            <td>
                              <span className={`task-badge ${task.employeeId === null ? "badge-general" : "badge-assigned"}`} style={{
                                fontSize: "10px",
                                padding: "2px 8px"
                              }}>
                                {task.employeeId === null ? "General" : "Direct"}
                              </span>
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
