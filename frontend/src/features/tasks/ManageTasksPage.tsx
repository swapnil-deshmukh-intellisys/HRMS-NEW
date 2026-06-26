import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Edit2, CheckSquare, ClipboardList, BarChart3, Search, Check, AlertCircle, Users } from "lucide-react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import "./ManageTasksPage.css";
 
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
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
  creator?: {
    id: number;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
  } | null;
  completions?: {
    id: number;
    taskId: number;
    employeeId: number;
    completedAt: string;
    employee: {
      id: number;
      firstName: string;
      lastName: string;
      employeeCode: string;
    };
  }[];
};

type AssignableEmployee = {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department?: {
    name: string;
  };
};

type FormTaskInput = {
  title: string;
  description: string;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select employee...",
  generalOptionLabel = "All Employees (General Task)"
}: {
  value: string;
  onChange: (val: string) => void;
  options: AssignableEmployee[];
  placeholder?: string;
  generalOptionLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const query = search.toLowerCase();
    return fullName.includes(query) || 
      emp.employeeCode.toLowerCase().includes(query) || 
      (emp.department?.name && emp.department.name.toLowerCase().includes(query));
  });

  const selectedOption = options.find(emp => String(emp.id) === value);
  const displayLabel = value === "general" 
    ? generalOptionLabel 
    : selectedOption 
      ? `${selectedOption.firstName} ${selectedOption.lastName} (${selectedOption.department?.name || "No Dept"})`
      : placeholder;

  return (
    <div className="custom-select-container" style={{ position: "relative", width: "100%" }}>
      {/* Selector Trigger Button */}
      <div 
        className="custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: "var(--radius-md)",
          background: "white",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-strong)",
          minHeight: "42px",
          boxShadow: "var(--shadow-xs)"
        }}
      >
        <span>{displayLabel}</span>
        <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>▼</span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay to close on click outside */}
          <div 
            onClick={() => setIsOpen(false)} 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
          />
          <div 
            className="custom-select-dropdown" 
            style={{
              position: "absolute",
              top: "105%",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 999,
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "300px"
            }}
          >
            {/* Search Input inside the dropdown */}
            <input 
              type="text" 
              placeholder="Search employee directly inside list..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "12px",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface-page)",
                boxSizing: "border-box"
              }}
            />

            {/* Options List */}
            <div 
              className="custom-select-options" 
              style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}
            >
              {/* General Option */}
              <div 
                className={`custom-select-option ${value === "general" ? "active" : ""}`}
                onClick={() => {
                  onChange("general");
                  setIsOpen(false);
                  setSearch("");
                }}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background: value === "general" ? "var(--color-accent-soft)" : "transparent",
                  color: value === "general" ? "var(--color-accent-strong)" : "var(--color-text-strong)",
                  fontWeight: value === "general" ? "bold" : "normal"
                }}
              >
                {generalOptionLabel}
              </div>

              {/* Employees Group Header */}
              {filteredOptions.length > 0 && (
                <div style={{ padding: "4px 12px 2px 12px", fontSize: "10px", fontWeight: "bold", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
                  Direct Employee Assignments
                </div>
              )}

              {/* Employee Options */}
              {filteredOptions.map(emp => {
                const isSelected = String(emp.id) === value;
                return (
                  <div 
                    key={emp.id}
                    className={`custom-select-option ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      onChange(String(emp.id));
                      setIsOpen(false);
                      setSearch("");
                    }}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      background: isSelected ? "var(--color-accent-soft)" : "transparent",
                      color: isSelected ? "var(--color-accent-strong)" : "var(--color-text-strong)",
                      fontWeight: isSelected ? "bold" : "normal"
                    }}
                  >
                    {emp.firstName} {emp.lastName} ({emp.department?.name || "No Dept"})
                  </div>
                );
              })}

              {filteredOptions.length === 0 && search && (
                <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--color-text-secondary)", textAlign: "center" }}>
                  No employees found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManageTasksPage({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const { sessionUser } = useAuth();
  
  const role = sessionUser?.role ?? "EMPLOYEE";
  const isTeamLead = Boolean(sessionUser?.employee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const isNormalEmployee = role === "EMPLOYEE" && !isTeamLead;

  const [tasksAssignedToMe, setTasksAssignedToMe] = useState<ManagerTask[]>([]);
  const [tasksAssignedToOthers, setTasksAssignedToOthers] = useState<ManagerTask[]>([]);
  const [activeSubView, setActiveSubView] = useState<"assigned_to_me" | "assigned_to_others">("assigned_to_me");
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [targetFilter, setTargetFilter] = useState<"all" | "direct" | "general">("all");

  // Modals
  const [isBulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ManagerTask | null>(null);

  // Revert Prompt States
  const [revertPromptOpen, setRevertPromptOpen] = useState(false);
  const [taskToRevert, setTaskToRevert] = useState<number | null>(null);
  const [revertReasonInput, setRevertReasonInput] = useState("");

  // Details Modal States
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailedTask, setDetailedTask] = useState<ManagerTask | null>(null);

  // Form states
  const [formEmployeeId, setFormEmployeeId] = useState<string>("general");
  const [bulkTasks, setBulkTasks] = useState<FormTaskInput[]>([{ title: "", description: "" }]);

  // Single task edit states
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState<string>("general");
  const [editIsCompleted, setEditIsCompleted] = useState(false);
  const [editRevertReason, setEditRevertReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
    if (!isNormalEmployee) {
      fetchEmployees();
    }
  }, [token, isNormalEmployee]);

  async function fetchTasks() {
    try {
      if (isNormalEmployee) {
        const response = await apiRequest<ManagerTask[]>("/tasks", { token });
        setTasksAssignedToMe(response.data);
      } else {
        const [meResponse, othersResponse] = await Promise.all([
          apiRequest<ManagerTask[]>("/tasks", { token }),
          apiRequest<ManagerTask[]>("/tasks/manager", { token })
        ]);
        setTasksAssignedToMe(meResponse.data);
        setTasksAssignedToOthers(othersResponse.data);
      }
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployees() {
    try {
      const response = await apiRequest<AssignableEmployee[]>("/tasks/employees", { token });
      setEmployees(response.data);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    }
  }

  // Bulk creation task builder
  function addBulkTaskRow() {
    setBulkTasks((prev) => [...prev, { title: "", description: "" }]);
  }

  function removeBulkTaskRow(index: number) {
    if (bulkTasks.length === 1) {
      toast.error("Please add at least one task.");
      return;
    }
    setBulkTasks((prev) => prev.filter((_, i) => i !== index));
  }

  // Handle bulk task changes
  function handleBulkTaskChange(index: number, field: keyof FormTaskInput, value: string) {
    setBulkTasks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  // Open Modals
  function openBulkCreateModal() {
    setFormEmployeeId("general");
    setBulkTasks([{ title: "", description: "" }]);
    setBulkCreateOpen(true);
  }

  function openEditModal(task: ManagerTask) {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditEmployeeId(task.employeeId ? String(task.employeeId) : "general");
    setEditIsCompleted(task.isCompleted);
    setEditRevertReason(task.revertReason || "");
    setEditModalOpen(true);
  }

  // Submit Bulk Create
  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validTasks = bulkTasks.filter((t) => t.title.trim());
    if (validTasks.length === 0) {
      toast.error("Please add at least one task with a title.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: formEmployeeId === "general" ? null : Number(formEmployeeId),
        tasks: validTasks,
      };

      await apiRequest("/tasks/manager", {
        method: "POST",
        token,
        body: payload,
      });

      toast.success("Tasks created successfully!");
      setBulkCreateOpen(false);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign tasks");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Edit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !editTitle.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: editTitle,
        description: editDescription || null,
        employeeId: editEmployeeId === "general" ? null : Number(editEmployeeId),
        isCompleted: editIsCompleted,
        ...(selectedTask.isCompleted && !editIsCompleted ? { revertReason: editRevertReason } : {}),
      };

      await apiRequest(`/tasks/manager/${selectedTask.id}`, {
        method: "PUT",
        token,
        body: payload,
      });

      toast.success("Task updated successfully!");
      setEditModalOpen(false);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Individual Task
  async function handleDeleteTask(taskId: number, title: string) {
    if (!confirm(`Are you sure you want to delete the task "${title}"?`)) return;

    try {
      await apiRequest(`/tasks/manager/${taskId}`, {
        method: "DELETE",
        token,
      });
      toast.success("Task deleted successfully");
      setTasksAssignedToOthers((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
    }
  }

  // Direct toggle completion
  async function handleToggleTask(taskId: number, currentCompleted: boolean) {
    const isAssignedToMe = isNormalEmployee || activeSubView === "assigned_to_me";
    if (isAssignedToMe) {
      await submitToggleTask(taskId, currentCompleted, undefined, true);
    } else {
      if (!currentCompleted) {
        const confirmToggle = window.confirm("Are you sure you want to mark this task as completed?");
        if (!confirmToggle) return;
        await submitToggleTask(taskId, false, undefined, false);
      } else {
        setTaskToRevert(taskId);
        setRevertReasonInput("");
        setRevertPromptOpen(true);
      }
    }
  }

  async function submitToggleTask(taskId: number, currentCompleted: boolean, revertReason?: string, isAssignedToMe: boolean = false) {
    if (submitting) return;
    try {
      setSubmitting(true);
      const targetState = !currentCompleted;
      const endpoint = isAssignedToMe
        ? `/tasks/items/${taskId}`
        : `/tasks/manager/${taskId}`;

      const response = await apiRequest<ManagerTask>(endpoint, {
        method: "PUT",
        token,
        body: isAssignedToMe ? { isCompleted: targetState } : { isCompleted: targetState, revertReason },
      });

      if (isAssignedToMe) {
        setTasksAssignedToMe((prev) => prev.map((t) => (t.id === taskId ? response.data : t)));
      } else {
        setTasksAssignedToOthers((prev) => prev.map((t) => (t.id === taskId ? response.data : t)));
      }
      toast.success(targetState ? "Task completed" : "Task marked as pending");
    } catch (error: any) {
      toast.error(error.message || "Failed to update task status");
    } finally {
      setSubmitting(false);
    }
  }

  // Filtering based on active view
  const currentTasks = (isNormalEmployee || activeSubView === "assigned_to_me")
    ? tasksAssignedToMe
    : tasksAssignedToOthers;

  const filteredTasks = currentTasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.employee &&
        `${task.employee.firstName} ${task.employee.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && task.isCompleted) ||
      (statusFilter === "pending" && !task.isCompleted);

    const matchesTarget =
      targetFilter === "all" ||
      (targetFilter === "direct" && task.employeeId !== null) ||
      (targetFilter === "general" && task.employeeId === null);

    return matchesSearch && matchesStatus && matchesTarget;
  });

  const directTasks = filteredTasks.filter((task) => task.employeeId !== null);
  const generalTasks = filteredTasks.filter((task) => task.employeeId === null);

  // Group directTasks softly by employeeId
  const directTasksByEmployee = directTasks.reduce((acc, task) => {
    if (task.employeeId !== null && task.employee) {
      const empId = task.employeeId;
      if (!acc[empId]) {
        acc[empId] = {
          employee: task.employee,
          tasks: []
        };
      }
      acc[empId].tasks.push(task);
    }
    return acc;
  }, {} as Record<number, { employee: NonNullable<ManagerTask["employee"]>; tasks: ManagerTask[] }>);

  const groupedEmployeeList = Object.values(directTasksByEmployee);

  // Aggregated Stats
  const totalTasks = currentTasks.length;
  const completedTasks = currentTasks.filter((t) => t.isCompleted).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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

  function renderTaskCard(task: ManagerTask) {
    const isAssignedToMe = isNormalEmployee || activeSubView === "assigned_to_me";
    return (
      <article key={task.id} className={`manager-list-card ${task.isCompleted ? "finished" : ""}`} style={{ padding: "var(--space-4)" }}>
        <div className="manager-list-title-row">
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", width: "100%" }}>
            <button
              className={`details-checkbox ${task.isCompleted ? "checked" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTask(task.id, task.isCompleted);
              }}
              title={task.isCompleted ? "Mark Pending" : "Mark Completed"}
              style={{ marginTop: "4px" }}
            >
              <CheckSquare size={20} />
            </button>
 
            <div 
              className="stack" 
              onClick={() => {
                setDetailedTask(task);
                setDetailsModalOpen(true);
              }}
              style={{ gap: "4px", flex: 1, minWidth: 0, cursor: "pointer" }}
            >
              <h4 className="list-title" style={{ textDecoration: task.isCompleted ? "line-through" : "none", opacity: task.isCompleted ? 0.6 : 1 }}>
                {task.title}
              </h4>
              {task.description && (
                <p className="list-desc" style={{ opacity: task.isCompleted ? 0.6 : 1 }}>
                  {task.description}
                </p>
              )}
 
              <div className="assignment-meta-row" style={{ marginTop: "6px" }}>
                <span>
                  {isAssignedToMe ? (
                    <>
                      Assigned by:{" "}
                      <strong>
                        {task.creator
                          ? `${task.creator.firstName} ${task.creator.lastName} (${task.creator.jobTitle || "Manager"})`
                          : "System"}
                      </strong>
                    </>
                  ) : (
                    <>
                      Target:{" "}
                      <strong>
                        {task.employee
                          ? `${task.employee.firstName} ${task.employee.lastName} (#${task.employee.employeeCode})`
                          : "All Employees (General)"}
                      </strong>
                    </>
                  )}
                </span>
              </div>
 
              {!isAssignedToMe && task.employeeId === null && (
                <div className="general-completions-box" style={{ marginTop: "12px", padding: "10px 12px", background: "var(--color-surface-page)", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-border-default)" }} onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between" }}>
                    <span>Completion Tracking ({task.completions?.length || 0} Done)</span>
                  </span>
                  {task.completions && task.completions.length > 0 ? (
                    <div className="completions-list" style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "100px", overflowY: "auto" }}>
                      {task.completions.map((comp: any) => (
                        <div key={comp.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--color-text-strong)" }}>
                          <span>✔️ {comp.employee ? `${comp.employee.firstName} ${comp.employee.lastName}` : `Employee #${comp.employeeId}`} {comp.employee?.employeeCode ? `(${comp.employee.employeeCode})` : ""}</span>
                          <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>{new Date(comp.completedAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px", fontStyle: "italic" }}>
                      No employees have marked this task completed yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
 
          <span className={`task-badge ${task.employeeId === null ? "badge-general" : "badge-assigned"}`}>
            {task.employeeId === null ? "General" : "Direct"}
          </span>
        </div>
 
        <div className="manager-card-actions" style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)" }}>
          <span className="task-date-tag" style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
            Created: <strong>{new Date(task.createdAt).toLocaleDateString()}</strong>
          </span>
 
          {!isNormalEmployee && activeSubView === "assigned_to_others" && (
            <div className="action-icons">
              <button
                className="action-icon-btn edit"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(task);
                }}
                title="Edit Task"
              >
                <Edit2 size={16} />
              </button>
              <button
                className="action-icon-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id, task.title);
                }}
                title="Delete Task"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }
 
  return (
    <div className="manage-tasks-page">
      {/* Page Header */}
      <header className="page-header-container">
        <div className="stack" style={{ gap: "4px" }}>
          <span className="eyebrow eyebrow--purple">
            {isNormalEmployee 
              ? "Self Console" 
              : activeSubView === "assigned_to_me" 
                ? "Recipient Console" 
                : isTeamLead 
                  ? "Team Leader Console" 
                  : "Manager Console"}
          </span>
          <h2 className="page-title">
            {isNormalEmployee 
              ? "My Tasks & Progress" 
              : activeSubView === "assigned_to_me" 
                ? "Tasks Assigned to Me" 
                : "Assigned Tasks & Progress"}
          </h2>
        </div>
        {!isNormalEmployee && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="button button--secondary" onClick={() => navigate("/tasks/employee-todos")}>
              Employee Todos
            </button>
            {activeSubView === "assigned_to_others" && (
              <button className="button button--primary add-task-list-btn" onClick={openBulkCreateModal}>
                <Plus size={18} />
                Assign Direct Tasks
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tab Switcher for Managers / Team Leads */}
      {!isNormalEmployee && (
        <div className="task-tab-switcher" role="tablist" aria-label="Task views">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === "assigned_to_me"}
            className={`task-tab-btn ${activeSubView === "assigned_to_me" ? "active" : ""}`}
            onClick={() => setActiveSubView("assigned_to_me")}
          >
            <ClipboardList size={16} />
            Tasks Assigned to Me
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === "assigned_to_others"}
            className={`task-tab-btn ${activeSubView === "assigned_to_others" ? "active" : ""}`}
            onClick={() => setActiveSubView("assigned_to_others")}
          >
            <Users size={16} />
            Tasks Assigned to Others
          </button>
        </div>
      )}

      {/* Stats Board */}
      <section className="tasks-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper purple">
            <ClipboardList size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">{isNormalEmployee ? "My Assigned Tasks" : "Total Assigned Tasks"}</span>
            <span className="stat-number">{totalTasks}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <Check size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completed Tasks</span>
            <span className="stat-number">{completedTasks}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper orange">
            <AlertCircle size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pending Tasks</span>
            <span className="stat-number">{pendingTasks}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <BarChart3 size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Overall Completion</span>
            <span className="stat-number">{completionRate}%</span>
          </div>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="tasks-filter-bar">
        <div className="search-box-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by task title, description, or employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <select value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="pending">Pending Only</option>
          </select>

          <select value={targetFilter} onChange={(e: any) => setTargetFilter(e.target.value)}>
            <option value="all">All Targets</option>
            <option value="direct">Direct Assigned</option>
            <option value="general">General Public</option>
          </select>
        </div>
      </section>

      {/* Task List Grid */}
      <section className="checklists-section">
        {filteredTasks.length === 0 ? (
          <div className="card manager-empty-state">
            <ClipboardList size={50} className="empty-icon" />
            <h3>No tasks found</h3>
            <p>
              {isNormalEmployee 
                ? "You currently have no tasks assigned. Check back later or adjust your filters." 
                : "Assign individual tasks directly to your employees, or check back with different filters."}
            </p>
            {!isNormalEmployee && (
              <button className="button button--secondary" onClick={openBulkCreateModal}>
                Assign First Task
              </button>
            )}
          </div>
        ) : (
          <div className={`tasks-workspace-grid ${targetFilter !== "all" ? "tasks-workspace-grid--full-width" : ""}`}>
            {/* Directly Assigned Tasks */}
            {(targetFilter === "all" || targetFilter === "direct") && (
              <div className="task-category-group">
                <div className="category-group-header">
                  <h3 className="category-group-title">
                    <span className="icon">👤</span> {isNormalEmployee ? "My Directly Assigned Tasks" : "Directly Assigned Tasks"}
                  </h3>
                  <span className="count-badge" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-strong)" }}>
                    {directTasks.length} Tasks
                  </span>
                </div>

                {groupedEmployeeList.length === 0 ? (
                  <div style={{ padding: "var(--space-6)", textAlign: "center", background: "var(--color-surface-card)", border: "1.5px dashed var(--color-border-default)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                    No directly assigned tasks match your filters.
                  </div>
                ) : isNormalEmployee ? (
                  <div className="manager-lists-grid">
                    {directTasks.map((task) => renderTaskCard(task))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    {groupedEmployeeList.map(({ employee, tasks }) => (
                      <div key={employee.id} className="employee-task-group-card">
                        <div className="employee-group-header">
                          <span className="employee-group-title">
                            👤 {employee.firstName} {employee.lastName} <span className="employee-code">#{employee.employeeCode}</span>
                          </span>
                          <span className="count-badge" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}>
                            {tasks.length} Assigned
                          </span>
                        </div>
                        <div className="manager-lists-grid">
                          {tasks.map((task) => renderTaskCard(task))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* General Tasks */}
            {(targetFilter === "all" || targetFilter === "general") && (
              <div className="task-category-group">
                <div className="category-group-header">
                  <h3 className="category-group-title">
                    <span className="icon">🌐</span> Company-Wide General Tasks
                  </h3>
                  <span className="count-badge" style={{ background: "var(--color-success-soft)", color: "var(--color-success-strong)" }}>
                    {generalTasks.length} Tasks
                  </span>
                </div>

                {generalTasks.length === 0 ? (
                  <div style={{ padding: "var(--space-6)", textAlign: "center", background: "var(--color-surface-card)", border: "1.5px dashed var(--color-border-default)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                    No company-wide general tasks match your filters.
                  </div>
                ) : (
                  <div className="manager-lists-grid">
                    {generalTasks.map((task) => renderTaskCard(task))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal - Assign Direct Tasks (Bulk Builder) */}
      <Modal open={isBulkCreateOpen} onClose={() => setBulkCreateOpen(false)} title="Assign Direct Tasks">
        <form className="task-list-form" onSubmit={handleBulkSubmit}>
          <label>
            Assign Target *
            <SearchableSelect
              value={formEmployeeId}
              onChange={setFormEmployeeId}
              options={employees}
            />
          </label>

          <div className="checklist-builder-section">
            <div className="builder-header">
              <span>Task List Builder *</span>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={addBulkTaskRow}
              >
                <Plus size={14} />
                Add Another Task
              </button>
            </div>

            <div className="builder-rows-container">
              {bulkTasks.map((task, index) => (
                <div key={index} className="builder-row">
                  <div className="builder-row-inputs">
                    <input
                      type="text"
                      required
                      placeholder={`Task #${index + 1} Title`}
                      value={task.title}
                      onChange={(e) => handleBulkTaskChange(index, "title", e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Description/Notes (optional)"
                      value={task.description}
                      onChange={(e) => handleBulkTaskChange(index, "description", e.target.value)}
                      className="builder-row-desc"
                    />
                  </div>
                  <button
                    type="button"
                    className="builder-row-remove"
                    onClick={() => removeBulkTaskRow(index)}
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="button-row" style={{ marginTop: "var(--space-6)" }}>
            <button type="button" className="secondary" onClick={() => setBulkCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Assigning..." : "Assign Tasks"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal - Edit Individual Task */}
      <Modal open={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Task Details">
        <form className="task-list-form" onSubmit={handleEditSubmit}>
          <label>
            Task Title *
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </label>

          <label>
            Description (Optional)
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </label>

          <label>
            Assign Target *
            <SearchableSelect
              value={editEmployeeId}
              onChange={setEditEmployeeId}
              options={employees}
            />
          </label>

          <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={editIsCompleted}
              onChange={(e) => setEditIsCompleted(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            Mark as Completed
          </label>

          {selectedTask?.isCompleted && !editIsCompleted && (
            <label style={{ marginTop: "var(--space-4)" }}>
              Reason for Reverting *
              <textarea
                required
                value={editRevertReason}
                onChange={(e) => setEditRevertReason(e.target.value)}
                placeholder="Why is this task being reverted to pending?"
              />
            </label>
          )}

          <div className="button-row" style={{ marginTop: "var(--space-6)" }}>
            <button type="button" className="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal - Revert Task Reason */}
      <Modal open={revertPromptOpen} onClose={() => setRevertPromptOpen(false)} title="Revert Task to Pending">
        <form className="task-list-form" onSubmit={async (e) => {
          e.preventDefault();
          if (taskToRevert) {
            await submitToggleTask(taskToRevert, true, revertReasonInput);
            setRevertPromptOpen(false);
          }
        }}>
          <label>
            Reason for Reverting *
            <textarea
              required
              value={revertReasonInput}
              onChange={(e) => setRevertReasonInput(e.target.value)}
              placeholder="Why is this task being reverted to pending?"
            />
          </label>
          <div className="button-row" style={{ marginTop: "var(--space-6)" }}>
            <button type="button" className="secondary" onClick={() => setRevertPromptOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Reverting..." : "Submit & Revert"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Details Popup Modal */}
      <Modal open={isDetailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Task Overview">
        {detailedTask && (
          <div className="task-detail-popup" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <h3 style={{ margin: 0, color: "var(--color-text-strong)" }}>{detailedTask.title}</h3>
            
            {detailedTask.description ? (
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
                {detailedTask.description}
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
                <span style={{ color: "var(--color-text-secondary)" }}>Assignee:</span>
                <div style={{ fontWeight: "bold", marginTop: "4px" }}>
                  {detailedTask.employee
                    ? `${detailedTask.employee.firstName} ${detailedTask.employee.lastName} (#${detailedTask.employee.employeeCode})`
                    : "All Employees (General)"}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Status:</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`task-badge ${detailedTask.isCompleted ? "badge-completed" : "badge-pending"}`} style={{
                    background: detailedTask.isCompleted ? "var(--color-success-soft)" : "var(--color-warning-soft)",
                    color: detailedTask.isCompleted ? "var(--color-success-strong)" : "var(--color-warning-strong)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: "bold",
                    fontSize: "10px",
                    display: "inline-block"
                  }}>
                    {detailedTask.isCompleted ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Assignment Type:</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`task-badge ${detailedTask.employeeId === null ? "badge-general" : "badge-assigned"}`} style={{
                    fontSize: "10px",
                    padding: "2px 8px"
                  }}>
                    {detailedTask.employeeId === null ? "General" : "Direct"}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Assigned On:</span>
                <div style={{ fontWeight: "bold", marginTop: "4px" }}>
                  {new Date(detailedTask.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {detailedTask.employeeId === null && (
              <div className="general-completions-box" style={{ marginTop: "12px", padding: "10px 12px", background: "var(--color-surface-page)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-default)" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between" }}>
                  <span>Completion Tracking ({detailedTask.completions?.length || 0} Done)</span>
                </span>
                {detailedTask.completions && detailedTask.completions.length > 0 ? (
                  <div className="completions-list" style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "150px", overflowY: "auto" }}>
                    {detailedTask.completions.map((comp: any) => (
                      <div key={comp.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--color-text-strong)" }}>
                        <span>✔️ {comp.employee ? `${comp.employee.firstName} ${comp.employee.lastName}` : `Employee #${comp.employeeId}`} {comp.employee?.employeeCode ? `(${comp.employee.employeeCode})` : ""}</span>
                        <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>{new Date(comp.completedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px", fontStyle: "italic" }}>
                    No employees have marked this task completed yet.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
              <button 
                type="button"
                className="button button--secondary"
                onClick={() => setDetailsModalOpen(false)}
                style={{ padding: "8px 16px" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
