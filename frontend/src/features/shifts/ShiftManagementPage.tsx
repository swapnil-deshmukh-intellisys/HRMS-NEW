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
};

const initialFormState: ShiftFormState = {
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  requiredMinutes: 540,
  gracePeriodMinutes: 15,
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

  // Search & Filter & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [targetShiftId, setTargetShiftId] = useState<string>("");
  
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

  // 2. Form helper - open create
  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormState(initialFormState);
    setFormOpen(true);
  };

  // 3. Form helper - open edit
  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormState({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      requiredMinutes: shift.requiredMinutes,
      gracePeriodMinutes: shift.gracePeriodMinutes,
    });
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
    
    setSubmitting(true);
    try {
      if (editingShift) {
        // Update
        const res = await apiRequest<Shift>(`/shifts/${editingShift.id}`, {
          method: "PUT",
          token,
          body: formState,
        });
        setShifts(prev => prev.map(s => s.id === editingShift.id ? { ...s, ...res.data } : s));
        toast.success("Shift updated successfully");
      } else {
        // Create
        const res = await apiRequest<Shift>("/shifts", {
          method: "POST",
          token,
          body: formState,
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
    if (shift.name === "Standard Shift") {
      toast.error("Standard Shift is the system default and cannot be deleted");
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
                const isDefault = shift.name === "Standard Shift";
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
                        <span className="time-value">{shift.startTime}</span>
                      </div>
                      <div className="arrow-divider">
                        <ArrowRight size={16} />
                      </div>
                      <div className="time-item">
                        <span className="time-label">End Time</span>
                        <span className="time-value">{shift.endTime}</span>
                      </div>
                    </div>

                    <div className="shift-metrics">
                      <div className="metric-item">
                        <span className="metric-label">Required Time</span>
                        <span className="metric-value">{formatDuration(shift.requiredMinutes)}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Late Grace Period</span>
                        <span className="metric-value">{shift.gracePeriodMinutes} mins</span>
                      </div>
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
                    <option value="all">All Shifts (Current Filter)</option>
                    <option value="unassigned">Unassigned Employees</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>Filter: {s.name}</option>
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
              disabled={submitting || editingShift?.name === "Standard Shift"}
            />
            {editingShift && editingShift.name === "Standard Shift" && (
              <span className="form-input-hint warning">
                The Standard Shift name is fixed by the system, but you can modify its timings.
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="shift-start">Start Time (HH:MM)</label>
              <input
                id="shift-start"
                type="text"
                placeholder="09:00"
                value={formState.startTime}
                onChange={(e) => setFormState(prev => ({ ...prev, startTime: e.target.value }))}
                required
                className="form-control"
                disabled={submitting}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="shift-end">End Time (HH:MM)</label>
              <input
                id="shift-end"
                type="text"
                placeholder="18:00"
                value={formState.endTime}
                onChange={(e) => setFormState(prev => ({ ...prev, endTime: e.target.value }))}
                required
                className="form-control"
                disabled={submitting}
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

            <div className="form-group">
              <label htmlFor="shift-grace">Lateness Grace Period (Minutes)</label>
              <input
                id="shift-grace"
                type="number"
                min={0}
                value={formState.gracePeriodMinutes}
                onChange={(e) => setFormState(prev => ({ ...prev, gracePeriodMinutes: parseInt(e.target.value, 10) || 0 }))}
                required
                className="form-control"
                disabled={submitting}
              />
              <span className="form-input-hint">
                Standard late penalties will apply relative to this threshold.
              </span>
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
