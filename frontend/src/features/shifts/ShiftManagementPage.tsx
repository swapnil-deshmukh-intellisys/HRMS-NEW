import "./ShiftManagementPage.css";
import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import { 
  Clock3, Users, Search, Trash2, Edit3, Plus, 
  AlertCircle, X, ArrowRight, RefreshCw 
} from "lucide-react";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import { apiRequest } from "../../services/api";
import type { Employee, Shift, Role } from "../../types";

// ─── 12-hour ↔ 24-hour utilities ────────────────────────────────────────────

/**
 * Convert a 24-hour "HH:MM" string to a 12-hour display object.
 * e.g. "13:30" → { time: "1:30", period: "PM" }
 *      "00:00" → { time: "12:00", period: "AM" }
 */
function to12Hour(time24: string): { time: string; period: "AM" | "PM" } {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return { time: "12:00", period: "AM" };
  const period: "AM" | "PM" = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return {
    time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    period,
  };
}

/**
 * Convert a 12-hour "HH:MM" string + period into a 24-hour "HH:MM" string.
 * e.g. ("01:30", "PM") → "13:30"
 */
function from12Hour(time12: string, period: "AM" | "PM"): string {
  const [hStr, mStr] = time12.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) h = 12;
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Reusable 12-hour time input component ────────────────────────────────────

interface TimeInput12Props {
  /** Current value stored as 24-hour "HH:MM" */
  value24: string;
  /** Placeholder shown in 12-hour format */
  placeholder?: string;
  disabled?: boolean;
  /** Called with the new value in 24-hour "HH:MM" format */
  onChange: (val24: string) => void;
  className?: string;
}

function TimeInput12({ value24, placeholder = "12:00", disabled, onChange, className = "" }: TimeInput12Props) {
  const { time: initTime, period: initPeriod } = to12Hour(value24 || "00:00");
  const [localTime, setLocalTime] = useState(initTime);
  const [period, setPeriod] = useState<"AM" | "PM">(initPeriod);

  // Sync when parent value changes (e.g. when editing a different shift)
  useEffect(() => {
    const { time, period: p } = to12Hour(value24 || "00:00");
    setLocalTime(time);
    setPeriod(p);
  }, [value24]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalTime(raw);
    // Only push upstream if it looks like a valid HH:MM
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      onChange(from12Hour(raw, period));
    }
  };

  const handlePeriodToggle = () => {
    const newPeriod: "AM" | "PM" = period === "AM" ? "PM" : "AM";
    setPeriod(newPeriod);
    if (/^\d{1,2}:\d{2}$/.test(localTime)) {
      onChange(from12Hour(localTime, newPeriod));
    }
  };

  return (
    <div className={`time-input-12 ${className}`}>
      <input
        type="text"
        value={localTime}
        placeholder={placeholder}
        onChange={handleTimeChange}
        className="form-control time-input-12__field"
        disabled={disabled}
        maxLength={5}
      />
      <button
        type="button"
        className={`time-input-12__period ${period === "AM" ? "time-input-12__period--am" : "time-input-12__period--pm"}`}
        onClick={handlePeriodToggle}
        disabled={disabled}
        tabIndex={-1}
      >
        {period}
      </button>
    </div>
  );
}

type ShiftManagementPageProps = {
  token: string | null;
  role: Role;
};

type ShiftFormState = {
  name: string;
  startTime: string;
  endTime: string;
  requiredMinutes: number;
  gracePeriodMinutes: number;
  hasBreaks: boolean;
  allowMorningTea: boolean;
  allowLunch: boolean;
  allowEveningTea: boolean;
  allowDinner: boolean;
  morningTeaStart: string;
  morningTeaEnd: string;
  lunchStart: string;
  lunchEnd: string;
  eveningTeaStart: string;
  eveningTeaEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
  employeeIds: number[];
};

const initialFormState: ShiftFormState = {
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  requiredMinutes: 540,
  gracePeriodMinutes: 15,
  hasBreaks: true,
  allowMorningTea: true,
  allowLunch: true,
  allowEveningTea: true,
  allowDinner: true,
  morningTeaStart: "10:30",
  morningTeaEnd: "11:15",
  lunchStart: "12:00",
  lunchEnd: "14:30",
  eveningTeaStart: "15:30",
  eveningTeaEnd: "17:00",
  dinnerStart: "20:00",
  dinnerEnd: "22:00",
  employeeIds: [],
};

export default function ShiftManagementPage({ token, role }: ShiftManagementPageProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formState, setFormState] = useState<ShiftFormState>(initialFormState);
  const [empSearchQuery, setEmpSearchQuery] = useState("");

  // Search & Filter & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [targetShiftId, setTargetShiftId] = useState<string>("");

  const filteredFormEmployees = useMemo(() => {
    return employees.filter(emp => {
      const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const code = emp.employeeCode.toLowerCase();
      const query = empSearchQuery.toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [employees, empSearchQuery]);
  
  // 1. Fetch data
  const fetchData = async () => {
    if (role !== "ADMIN") return;
    setLoading(true);
    try {
      const [shiftsRes, employeesRes] = await Promise.all([
        apiRequest<Shift[]>("/shifts", { token }),
        // Fetch employees with a high limit to get all of them
        apiRequest<{ items: Employee[] }>("/employees?limit=200", { token })
      ]);
      setShifts(shiftsRes.data);
      setEmployees(employeesRes.data.items);
    } catch (error) {
      toast.error("Failed to load shift and employee data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role, token]);

  // Sync Lunch/Dinner toggles based on start time
  useEffect(() => {
    if (!formState.startTime) return;
    const hour = parseInt(formState.startTime.split(":")[0], 10);
    if (!isNaN(hour)) {
      if (hour < 12) {
        // Morning shift: force allowDinner to false, default allowLunch to true if not set
        setFormState(prev => {
          if (prev.allowDinner || (!prev.allowLunch && prev.hasBreaks)) {
            return { ...prev, allowDinner: false, allowLunch: true };
          }
          return { ...prev, allowDinner: false };
        });
      } else {
        // Night shift: force allowLunch to false, default allowDinner to true if not set
        setFormState(prev => {
          if (prev.allowLunch || (!prev.allowDinner && prev.hasBreaks)) {
            return { ...prev, allowLunch: false, allowDinner: true };
          }
          return { ...prev, allowLunch: false };
        });
      }
    }
  }, [formState.startTime, formState.hasBreaks]);

  // 2. Form helper - open create
  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormState({
      ...initialFormState,
      employeeIds: [],
    });
    setEmpSearchQuery("");
    setFormOpen(true);
  };

  // 3. Form helper - open edit
  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    const assignedIds = (shift as any).employees?.map((e: any) => e.id) || [];
    setFormState({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      requiredMinutes: shift.requiredMinutes,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      hasBreaks: shift.hasBreaks ?? true,
      allowMorningTea: shift.allowMorningTea ?? true,
      allowLunch: shift.allowLunch ?? true,
      allowEveningTea: shift.allowEveningTea ?? true,
      allowDinner: shift.allowDinner ?? true,
      morningTeaStart: shift.morningTeaStart ?? "10:30",
      morningTeaEnd: shift.morningTeaEnd ?? "11:15",
      lunchStart: shift.lunchStart ?? "12:00",
      lunchEnd: shift.lunchEnd ?? "14:30",
      eveningTeaStart: shift.eveningTeaStart ?? "15:30",
      eveningTeaEnd: shift.eveningTeaEnd ?? "17:00",
      dinnerStart: shift.dinnerStart ?? "20:00",
      dinnerEnd: shift.dinnerEnd ?? "22:00",
      employeeIds: assignedIds,
    });
    setEmpSearchQuery("");
    setFormOpen(true);
  };

  // 4. Create or update shift
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    // Simple validation
    if (!formState.name.trim()) {
      toast.error("Shift name is required");
      return;
    }
    
    const payload = {
      ...formState,
      gracePeriodMinutes: 5, // Enforce system-standard 5 minutes grace period
    };

    setSubmitting(true);
    try {
      if (editingShift) {
        // Update
        const res = await apiRequest<Shift>(`/shifts/${editingShift.id}`, {
          method: "PUT",
          token,
          body: payload,
        });
        setShifts(prev => prev.map(s => s.id === editingShift.id ? { ...s, ...res.data } : s));
        toast.success("Shift updated successfully");
      } else {
        // Create
        const res = await apiRequest<Shift>("/shifts", {
          method: "POST",
          token,
          body: payload,
        });
        setShifts(prev => [...prev, res.data]);
        toast.success("Shift created successfully");
      }
      setFormOpen(false);
      // Refresh employees list as shift definitions changed
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save shift");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Delete shift
  const handleDeleteShift = async (shift: Shift) => {
    if (shift.name === "Day Shift") {
      toast.error("Day Shift is the system default and cannot be deleted");
      return;
    }
    
    if (shift._count && shift._count.employees > 0) {
      toast.error("Cannot delete shift: it is currently assigned to active employees");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${shift.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/shifts/${shift.id}`, {
        method: "DELETE",
        token,
      });
      setShifts(prev => prev.filter(s => s.id !== shift.id));
      toast.success("Shift deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete shift");
    }
  };

  // 6. Bulk assign shifts
  const handleBulkAssign = async () => {
    if (selectedEmployees.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    if (!targetShiftId) {
      toast.error("Please select a target shift");
      return;
    }

    const shiftId = parseInt(targetShiftId, 10);
    const selectedShift = shifts.find(s => s.id === shiftId);
    
    if (!selectedShift) {
      toast.error("Target shift not found");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ count: number }>("/shifts/assign", {
        method: "POST",
        token,
        body: {
          employeeIds: selectedEmployees,
          shiftId,
        },
      });
      toast.success(`Successfully assigned ${res.data.count} employee(s) to "${selectedShift.name}"`);
      setSelectedEmployees([]);
      setTargetShiftId("");
      fetchData(); // Reload all to update counts and links
    } catch (error: any) {
      toast.error(error.message || "Failed to assign shift");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & search employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const code = emp.employeeCode.toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = fullName.includes(query) || code.includes(query);
      
      if (shiftFilter === "all") return matchesSearch;
      if (shiftFilter === "unassigned") return matchesSearch && !emp.shiftId;
      return matchesSearch && emp.shiftId === parseInt(shiftFilter, 10);
    });
  }, [employees, searchQuery, shiftFilter]);

  // Handle individual employee checkbox toggle
  const handleToggleEmployee = (id: number) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle select all on filtered employees
  const handleToggleAllFiltered = () => {
    const filteredIds = filteredEmployees.map(e => e.id);
    const allSelected = filteredIds.every(id => selectedEmployees.includes(id));
    
    if (allSelected) {
      // Unselect all filtered
      setSelectedEmployees(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedEmployees(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };

  // Convert minutes to hours for display
  const formatDuration = (mins: number) => {
    const hours = mins / 60;
    return `${hours} hr${hours !== 1 ? "s" : ""}`;
  };

  // Gate page for ADMIN only
  if (role !== "ADMIN") {
    return (
      <div className="shifts-restricted-container">
        <MessageCard 
          title="Administrative Access Required" 
          message="Shift configurations and employee shift switching are protected operations restricted strictly to Administrator accounts. Please contact your system administrator if you believe this is an error." 
          tone="error"
        />
      </div>
    );
  }

  return (
    <section className="shifts-page-container">
      <header className="shifts-page-header">
        <div>
          <h1 className="shifts-page-title">Shift Management</h1>
          <p className="shifts-page-description">
            Configure dynamic work shifts, break parameters, late-grace periods, and seamlessly switch employees between active schedules.
          </p>
        </div>
        <button className="btn btn--primary btn-create-shift" onClick={handleOpenCreate}>
          <Plus size={16} />
          <span>Create Shift</span>
        </button>
      </header>

      {loading ? (
        <div className="shifts-skeleton-container">
          <div className="card skeleton-card skeleton-card--shift" />
          <div className="card skeleton-card skeleton-card--shift" />
          <div className="card skeleton-card skeleton-card--table" />
        </div>
      ) : (
        <div className="shifts-grid-layout">
          {/* Left Column: Active Shifts */}
          <div className="shifts-list-section">
            <h2 className="section-subtitle">
              <Clock3 size={18} />
              <span>Active Shift Profiles</span>
            </h2>
            
            <div className="shifts-grid">
              {shifts.map((shift) => {
                const isDefault = shift.name === "Day Shift";
                const employeeCount = shift._count?.employees ?? 0;
                
                return (
                  <article key={shift.id} className={`shift-card ${isDefault ? 'shift-card--default' : ''}`}>
                    {isDefault && <span className="shift-badge-default">System Default</span>}
                    <div className="shift-card-header">
                      <h3 className="shift-card-title">{shift.name}</h3>
                      <div className="shift-card-actions">
                        <button 
                          className="btn-icon btn-icon--edit" 
                          title="Edit shift parameters"
                          onClick={() => handleOpenEdit(shift)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          className="btn-icon btn-icon--delete" 
                          title="Delete shift"
                          disabled={isDefault || employeeCount > 0}
                          onClick={() => handleDeleteShift(shift)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="shift-time-block">
                      <div className="time-item">
                        <span className="time-label">Start Time</span>
                        <span className="time-value">
                          {(() => { const t = to12Hour(shift.startTime); return `${t.time} ${t.period}`; })()}
                        </span>
                      </div>
                      <div className="arrow-divider">
                        <ArrowRight size={16} />
                      </div>
                      <div className="time-item">
                        <span className="time-label">End Time</span>
                        <span className="time-value">
                          {(() => { const t = to12Hour(shift.endTime); return `${t.time} ${t.period}`; })()}
                        </span>
                      </div>
                    </div>

                    <div className="shift-metrics">
                      <div className="metric-item">
                        <span className="metric-label">Required Time</span>
                        <span className="metric-value">{formatDuration(shift.requiredMinutes)}</span>
                      </div>
                    </div>

                    <div className="shift-breaks-list">
                      <span className="breaks-title">Allowed Breaks:</span>
                      {shift.hasBreaks ? (
                        <div className="breaks-badges">
                          {(() => {
                            const shiftHour = parseInt((shift.startTime || "09:00").split(":")[0], 10);
                            const isNightShift = !isNaN(shiftHour) && shiftHour >= 12;
                            return (
                              <>
                                {/* Morning Tea — only relevant for morning shifts */}
                                {shift.allowMorningTea && !isNightShift && (() => {
                                  const s = to12Hour(shift.morningTeaStart || "10:30");
                                  const e = to12Hour(shift.morningTeaEnd || "11:15");
                                  return <span className="break-badge">Morning Tea ({s.time} {s.period} – {e.time} {e.period})</span>;
                                })()}
                                {/* Lunch — only relevant for morning shifts */}
                                {shift.allowLunch && !isNightShift && (() => {
                                  const s = to12Hour(shift.lunchStart || "12:00");
                                  const e = to12Hour(shift.lunchEnd || "14:30");
                                  return <span className="break-badge">Lunch ({s.time} {s.period} – {e.time} {e.period})</span>;
                                })()}
                                {/* Evening Tea (morning) / Evening Snack (night) */}
                                {shift.allowEveningTea && (() => {
                                  const s = to12Hour(shift.eveningTeaStart || "15:30");
                                  const e = to12Hour(shift.eveningTeaEnd || "17:00");
                                  const label = isNightShift ? "Evening Snack" : "Evening Tea";
                                  return <span className="break-badge">{label} ({s.time} {s.period} – {e.time} {e.period})</span>;
                                })()}
                                {/* Dinner — only relevant for night shifts */}
                                {shift.allowDinner && isNightShift && (() => {
                                  const s = to12Hour(shift.dinnerStart || "20:00");
                                  const e = to12Hour(shift.dinnerEnd || "22:00");
                                  return <span className="break-badge">Dinner ({s.time} {s.period} – {e.time} {e.period})</span>;
                                })()}
                                {/* Fallback if nothing is applicable */}
                                {!shift.allowMorningTea && !shift.allowLunch && !shift.allowEveningTea && !shift.allowDinner && (
                                  <span className="break-badge break-badge--none">None allowed</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="break-status-disabled">Breaks Disabled</span>
                      )}
                    </div>

                    <div className="shift-card-footer">
                      <Users size={14} className="icon-subtle" />
                      <span className="assigned-text">
                        <strong>{employeeCount}</strong> employee{employeeCount !== 1 ? 's' : ''} assigned
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Right Column: Employee Shift Assignment Switcher */}
          <div className="switcher-section">
            <h2 className="section-subtitle">
              <RefreshCw size={18} />
              <span>Shift Switcher Directory</span>
            </h2>

            <div className="card switcher-card">
              <div className="switcher-filters">
                {/* Search Bar */}
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    placeholder="Search employees by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Dropdown */}
                <div className="filter-dropdown-wrapper">
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="select-input"
                  >
                    <option value="all">All Shifts</option>
                    <option value="unassigned">Unassigned Employees</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Employee Directory List */}
              <div className="switcher-list-container">
                <table className="switcher-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredEmployees.length > 0 &&
                            filteredEmployees.every(e => selectedEmployees.includes(e.id))
                          }
                          onChange={handleToggleAllFiltered}
                          className="checkbox-input"
                        />
                      </th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Current Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="table-empty-message">
                          <AlertCircle size={16} className="icon-subtle" />
                          <span>No employees match the current search or filters.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = selectedEmployees.includes(emp.id);
                        const assignedShift = shifts.find(s => s.id === emp.shiftId);
                        
                        return (
                          <tr 
                            key={emp.id} 
                            className={isSelected ? 'row--selected' : ''}
                            onClick={() => handleToggleEmployee(emp.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleEmployee(emp.id)}
                                className="checkbox-input"
                              />
                            </td>
                            <td>
                              <div className="employee-info-cell">
                                <span className="emp-name">{emp.firstName} {emp.lastName}</span>
                                <span className="emp-code">#{emp.employeeCode}</span>
                              </div>
                            </td>
                            <td>{emp.department?.name || 'N/A'}</td>
                            <td>
                              {assignedShift ? (
                                <span className="shift-badge-assigned">
                                  {assignedShift.name}
                                </span>
                              ) : (
                                <span className="shift-badge-none">Unassigned</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bulk Action Sticky Bar (Visible when employees are selected) */}
              {selectedEmployees.length > 0 && (
                <div className="switcher-bulk-bar">
                  <div className="bulk-bar-info">
                    <span className="bulk-selection-count">
                      <strong>{selectedEmployees.length}</strong> employee{selectedEmployees.length !== 1 ? 's' : ''} selected
                    </span>
                    <button className="btn-text-clear" onClick={() => setSelectedEmployees([])}>
                      Clear
                    </button>
                  </div>
                  
                  <div className="bulk-bar-actions">
                    <select
                      value={targetShiftId}
                      onChange={(e) => setTargetShiftId(e.target.value)}
                      className="select-input select-target-shift"
                      disabled={submitting}
                    >
                      <option value="">Select target shift...</option>
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>Change to: {s.name}</option>
                      ))}
                    </select>
                    
                    <button
                      className="btn btn--primary btn-assign-shift"
                      disabled={!targetShiftId || submitting}
                      onClick={handleBulkAssign}
                    >
                      {submitting ? "Assigning..." : "Assign Shift"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shift Form Modal (Create / Edit) */}
      <Modal
        open={formOpen}
        title={editingShift ? `Edit Shift: ${editingShift.name}` : "Create Shift Profile"}
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={handleFormSubmit} className="shift-form">
          <div className="form-group">
            <label htmlFor="shift-name">Shift Profile Name</label>
            <input
              id="shift-name"
              type="text"
              placeholder="e.g. Morning Shift, Night Shift"
              value={formState.name}
              onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
              required
              className="form-control"
              disabled={submitting || editingShift?.name === "Day Shift"}
            />
            {editingShift && editingShift.name === "Day Shift" && (
              <span className="form-input-hint warning">
                The Day Shift name is fixed by the system, but you can modify its timings.
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <TimeInput12
                value24={formState.startTime}
                placeholder="09:00"
                disabled={submitting}
                onChange={(val24) => setFormState(prev => ({ ...prev, startTime: val24 }))}
              />
            </div>

            <div className="form-group">
              <label>End Time</label>
              <TimeInput12
                value24={formState.endTime}
                placeholder="06:00"
                disabled={submitting}
                onChange={(val24) => setFormState(prev => ({ ...prev, endTime: val24 }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="shift-required">Required Work Duration (Minutes)</label>
              <input
                id="shift-required"
                type="number"
                min={60}
                value={formState.requiredMinutes}
                onChange={(e) => setFormState(prev => ({ ...prev, requiredMinutes: parseInt(e.target.value, 10) || 540 }))}
                required
                className="form-control"
                disabled={submitting}
              />
              <span className="form-input-hint">
                540 min = 9.0 hrs, 480 min = 8.0 hrs
              </span>
            </div>
          </div>

          <div className="form-group break-settings-section">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={formState.hasBreaks}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormState(prev => ({ ...prev, hasBreaks: checked }));
                }}
                className="checkbox-input"
                disabled={submitting}
              />
              <span className="checkbox-label-text">Enable Break Tracking & Penalties</span>
            </label>
            <span className="form-input-hint">
              If enabled, employees can take breaks, and late returns will trigger point and minute penalties. If disabled, breaks are not allowed.
            </span>
          </div>

          {formState.hasBreaks && (
            <div className="form-group break-toggles-grid">
              <label className="form-section-title">Allowed Break Types & Timing Windows</label>
              <div className="checkbox-grid">
                {(() => {
                  const hour = parseInt(formState.startTime.split(":")[0], 10);
                  const isMorning = !isNaN(hour) && hour < 12;

                  return (
                    <>
                      {/* Morning Tea — only for morning shifts */}
                      {isMorning && (
                        <div className="break-config-row">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={formState.allowMorningTea}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormState(prev => ({ ...prev, allowMorningTea: checked }));
                              }}
                              className="checkbox-input"
                              disabled={submitting}
                            />
                            <span className="checkbox-label-text">Morning Tea (15m)</span>
                          </label>
                          {formState.allowMorningTea && (
                            <div className="break-time-inputs">
                              <TimeInput12
                                value24={formState.morningTeaStart}
                                placeholder="10:30"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, morningTeaStart: val24 }))}
                                className="break-time-control"
                              />
                              <span className="time-sep">–</span>
                              <TimeInput12
                                value24={formState.morningTeaEnd}
                                placeholder="11:15"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, morningTeaEnd: val24 }))}
                                className="break-time-control"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lunch (morning) OR Dinner (night/afternoon) */}
                      {isMorning ? (
                        <div className="break-config-row">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={formState.allowLunch}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormState(prev => ({ ...prev, allowLunch: checked }));
                              }}
                              className="checkbox-input"
                              disabled={submitting}
                            />
                            <span className="checkbox-label-text">Lunch Break (40m)</span>
                          </label>
                          {formState.allowLunch && (
                            <div className="break-time-inputs">
                              <TimeInput12
                                value24={formState.lunchStart}
                                placeholder="12:00"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, lunchStart: val24 }))}
                                className="break-time-control"
                              />
                              <span className="time-sep">–</span>
                              <TimeInput12
                                value24={formState.lunchEnd}
                                placeholder="02:30"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, lunchEnd: val24 }))}
                                className="break-time-control"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="break-config-row">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={formState.allowDinner}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormState(prev => ({ ...prev, allowDinner: checked }));
                              }}
                              className="checkbox-input"
                              disabled={submitting}
                            />
                            <span className="checkbox-label-text">Dinner Break (40m)</span>
                          </label>
                          {formState.allowDinner && (
                            <div className="break-time-inputs">
                              <TimeInput12
                                value24={formState.dinnerStart}
                                placeholder="08:00"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, dinnerStart: val24 }))}
                                className="break-time-control"
                              />
                              <span className="time-sep">–</span>
                              <TimeInput12
                                value24={formState.dinnerEnd}
                                placeholder="10:00"
                                disabled={submitting}
                                onChange={(val24) => setFormState(prev => ({ ...prev, dinnerEnd: val24 }))}
                                className="break-time-control"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Evening Tea (morning shifts) OR Evening Snack (night shifts) */}
                      <div className="break-config-row">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            checked={formState.allowEveningTea}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormState(prev => ({ ...prev, allowEveningTea: checked }));
                            }}
                            className="checkbox-input"
                            disabled={submitting}
                          />
                          <span className="checkbox-label-text">
                            {isMorning ? "Evening Tea (20m)" : "Evening Snack (20m)"}
                          </span>
                        </label>
                        {formState.allowEveningTea && (
                          <div className="break-time-inputs">
                            <TimeInput12
                              value24={formState.eveningTeaStart}
                              placeholder="03:30"
                              disabled={submitting}
                              onChange={(val24) => setFormState(prev => ({ ...prev, eveningTeaStart: val24 }))}
                              className="break-time-control"
                            />
                            <span className="time-sep">–</span>
                            <TimeInput12
                              value24={formState.eveningTeaEnd}
                              placeholder="05:00"
                              disabled={submitting}
                              onChange={(val24) => setFormState(prev => ({ ...prev, eveningTeaEnd: val24 }))}
                              className="break-time-control"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="form-group shift-employees-section">
            <label className="form-section-title">Assign Employees to this Shift</label>
            <div className="shift-employee-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search employees by name or code..."
                value={empSearchQuery}
                onChange={(e) => setEmpSearchQuery(e.target.value)}
                className="form-control search-input-small"
              />
            </div>
            <div className="shift-employee-list-scrollable">
              {filteredFormEmployees.length === 0 ? (
                <div className="empty-message-small">No employees found.</div>
              ) : (
                filteredFormEmployees.map((emp) => {
                  const isChecked = formState.employeeIds.includes(emp.id);
                  const currentShift = shifts.find(s => s.id === emp.shiftId);
                  return (
                    <label key={emp.id} className="shift-employee-checkbox-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormState(prev => ({
                              ...prev,
                              employeeIds: [...prev.employeeIds, emp.id]
                            }));
                          } else {
                            setFormState(prev => ({
                              ...prev,
                              employeeIds: prev.employeeIds.filter(id => id !== emp.id)
                            }));
                          }
                        }}
                        className="checkbox-input"
                      />
                      <span className="checkbox-label-text">
                        {emp.firstName} {emp.lastName}
                        <span className="emp-code-small"> (#{emp.employeeCode})</span>
                        {currentShift && currentShift.id !== editingShift?.id && (
                          <span className="current-shift-hint"> (currently on: {currentShift.name})</span>
                        )}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
