import React, { useState, useEffect } from "react";
import { SendHorizontal, Eye, HelpCircle, CheckCircle2, Search, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiRequest } from "../../services/api";
import "./EmailBroadcasterPage.css";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode?: string;
  user?: {
    email: string;
  };
}

interface Department {
  id: number;
  name: string;
}

interface EmailBroadcasterPageProps {
  token: string;
}

export default function EmailBroadcasterPage({ token }: EmailBroadcasterPageProps) {
  const [loadingData, setLoadingData] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Form states
  const [recipientType, setRecipientType] = useState<"all" | "department" | "single">("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [subject, setSubject] = useState("Important Team Update: Operational Notice");
  const [title, setTitle] = useState("Operational Updates & Guidelines");
  const [message, setMessage] = useState("Dear Team,\n\nWe would like to share some critical updates regarding our standard operating procedures. Please make sure to review the complete documentation in the portal.\n\nShould you have any questions, reach out directly to the HR department.\n\nBest Regards,\nOperations Team");
  const link = "";
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch target list options on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [empData, deptData] = await Promise.all([
          apiRequest<{ items: Employee[] }>("/employees?limit=1000", { token }),
          apiRequest<Department[]>("/departments", { token })
        ]);

        if (empData.success && empData.data?.items) {
          const mapped = empData.data.items.map(e => ({
            ...e,
            email: e.email || e.user?.email || ""
          })).filter(e => e.email);
          setEmployees(mapped);
        }
        if (deptData.success && Array.isArray(deptData.data)) {
          setDepartments(deptData.data);
        }
      } catch (error: any) {
        console.error("Failed to load recipients list:", error);
        toast.error("Unable to load employees or departments list");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [token]);

  // Handle Manual email broadcasting
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim() || !message.trim()) {
      toast.error("Please fill in all required fields (Subject, Title, Message)");
      return;
    }

    if (recipientType === "single" && !selectedEmployeeId) {
      toast.error("Please select a recipient employee");
      return;
    }
    if (recipientType === "department" && !selectedDepartmentId) {
      toast.error("Please select a target department");
      return;
    }

    const confirmMsg = `Are you sure you want to broadcast this manual email notification to ${
      recipientType === "all"
        ? "all active employees"
        : recipientType === "department"
        ? `employees in the selected department`
        : `the selected employee`
    }? This action will send actual SMTP emails immediately.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setBroadcasting(true);
    const loadToast = toast.loading("Broadcasting emails. Please wait...");
    try {
      const response = await apiRequest<{ sentCount: number }>("/email-templates/send-manual", {
        method: "POST",
        token,
        body: {
          recipientType,
          employeeId: recipientType === "single" ? Number(selectedEmployeeId) : undefined,
          departmentId: recipientType === "department" ? Number(selectedDepartmentId) : undefined,
          subject,
          title,
          message,
          link: link.trim() || undefined,
        }
      });

      toast.dismiss(loadToast);
      if (response.success) {
        toast.success(`Success! Broadcast complete. ${response.data.sentCount} emails dispatched.`);
        // Reset message or CTA only if wanted, keeping basic template intact for convenience
      } else {
        throw new Error(response.message || "Failed to dispatch broadcast");
      }
    } catch (error: any) {
      toast.dismiss(loadToast);
      console.error(error);
      toast.error(error.message || "An error occurred during broadcasting");
    } finally {
      setBroadcasting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="broadcaster-container" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="spinner"></div>
        <p style={{ marginTop: "16px", color: "var(--studio-text-muted)" }}>Loading broadcaster parameters...</p>
      </div>
    );
  }

  // Find recipient target text for information banner
  const getSelectedCountText = () => {
    if (recipientType === "all") {
      return `All ${employees.length} registered active employees with email profiles.`;
    }
    if (recipientType === "department") {
      const dept = departments.find(d => d.id === Number(selectedDepartmentId));
      return `All active employees belonging to department: ${dept ? dept.name : "Unselected"}.`;
    }
    if (recipientType === "single") {
      const emp = employees.find(e => e.id === Number(selectedEmployeeId));
      return emp ? `1 recipient: ${emp.firstName} ${emp.lastName} (${emp.email}).` : "1 selected employee.";
    }
    return "";
  };

  return (
    <div className="broadcaster-container">
      {/* Visual Header */}
      <header className="broadcaster-header">
        <div className="broadcaster-header-meta">
          <div className="broadcaster-icon-badge">
            <SendHorizontal size={24} />
          </div>
          <div>
            <h1>Manual Email Broadcaster</h1>
            <p>Directly draft, visually verify, and securely dispatch custom bulk notifications system-wide.</p>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="broadcaster-workspace">
        
        {/* Left Panel: Composer & Selectors */}
        <form onSubmit={handleBroadcast} className="broadcaster-pane-card">
          <h3>Compose Broadcast</h3>

          {/* Recipient Targeting Selector */}
          <div className="broadcaster-input-group">
            <label>Target Audience Recipient Group</label>
            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              <select 
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value as any)}
                className="broadcaster-select"
                style={{ flex: 1 }}
              >
                <option value="all">📢 Broadcast to All Employees</option>
                <option value="single">👤 Send to Specific Employee</option>
              </select>
            </div>
          </div>

          {/* Department Selection dropdown */}
          {recipientType === "department" && (
            <div className="broadcaster-input-group animation-fade-in">
              <label htmlFor="dept-target">Select Target Department</label>
              <select
                id="dept-target"
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="broadcaster-select"
                required
              >
                <option value="">-- Choose Department --</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Single Employee Selection dropdown */}
          {recipientType === "single" && (
            <div className="broadcaster-input-group animation-fade-in" ref={employeeDropdownRef}>
              <label>Select Target Employee</label>
              
              <div className="custom-searchable-dropdown">
                {/* Trigger Button */}
                <div 
                  className={`dropdown-trigger ${isEmployeeDropdownOpen ? "active" : ""}`}
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                >
                  <div className="trigger-left">
                    <Search size={16} className="dropdown-search-icon" />
                    <span className="selected-value-text">
                      {selectedEmployeeId 
                        ? (() => {
                            const emp = employees.find(e => e.id === Number(selectedEmployeeId));
                            return emp 
                              ? `${emp.firstName} ${emp.lastName} ${emp.employeeCode ? `(#${emp.employeeCode})` : ""}`
                              : "-- Choose Employee --";
                          })()
                        : "-- Choose Employee --"}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`chevron-icon ${isEmployeeDropdownOpen ? "rotated" : ""}`} />
                </div>

                {/* Dropdown Floating Pane */}
                {isEmployeeDropdownOpen && (
                  <div className="dropdown-menu-pane animation-scale-up">
                    <div className="dropdown-search-wrapper">
                      <Search size={14} className="menu-search-icon" />
                      <input 
                        type="text"
                        placeholder="Search employees..."
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        className="menu-search-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      {employeeSearchQuery && (
                        <button 
                          type="button" 
                          className="search-clear-btn"
                          onClick={(e) => { e.stopPropagation(); setEmployeeSearchQuery(""); }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="dropdown-options-list">
                      {(() => {
                        const filtered = employees.filter(emp => {
                          const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                          const code = (emp.employeeCode || "").toLowerCase();
                          const query = employeeSearchQuery.toLowerCase();
                          return fullName.includes(query) || code.includes(query);
                        });

                        if (filtered.length === 0) {
                          return <div className="dropdown-empty-option">No employees match "{employeeSearchQuery}"</div>;
                        }

                        return filtered.map(emp => (
                          <div 
                            key={emp.id}
                            className={`dropdown-item-option ${selectedEmployeeId === String(emp.id) ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedEmployeeId(String(emp.id));
                              setIsEmployeeDropdownOpen(false);
                              setEmployeeSearchQuery("");
                            }}
                          >
                            <div className="option-name-box">
                              <span className="option-name">{emp.firstName} {emp.lastName}</span>
                              {emp.employeeCode && <span className="option-code">#{emp.employeeCode}</span>}
                            </div>
                            <span className="option-email">{emp.email}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subject Field */}
          <div className="broadcaster-input-group">
            <label htmlFor="subject-field">Email Subject Line (Subject)</label>
            <input
              id="subject-field"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. System Upgrades Maintenance Notice"
              className="broadcaster-input"
              required
            />
          </div>

          {/* Card Title Field */}
          <div className="broadcaster-input-group">
            <label htmlFor="title-field">Email Header Card Title (Title)</label>
            <input
              id="title-field"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Urgent Scheduled Service Optimizations"
              className="broadcaster-input"
              required
            />
          </div>

          {/* Message Content Field */}
          <div className="broadcaster-input-group">
            <label htmlFor="message-field">Email Body Text Content (Message)</label>
            <textarea
              id="message-field"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message text to be enclosed inside the email body card skeleton..."
              className="broadcaster-textarea"
              required
            />
          </div>

          {/* Dynamic Information Banner */}
          <div className="broadcaster-info-banner">
            <CheckCircle2 size={18} className="broadcaster-info-icon" />
            <div>
              <strong>Target recipients:</strong> {getSelectedCountText()}
              <br />
              <small>Recipients will also receive an in-app database notification alert panel immediately.</small>
            </div>
          </div>

          {/* Dispatch trigger button */}
          <button
            type="submit"
            disabled={broadcasting || (recipientType === "single" && !selectedEmployeeId) || (recipientType === "department" && !selectedDepartmentId)}
            className="broadcaster-btn"
          >
            <SendHorizontal size={16} />
            {broadcasting ? "Dispatching Broadcast..." : "Broadcast Email Notification"}
          </button>
        </form>

        {/* Right Panel: Live Visual Output Simulation */}
        <div className="broadcaster-preview-card">
          <div className="broadcaster-preview-title">
            <Eye size={16} />
            <span>Interactive Live Layout Preview</span>
          </div>

          {/* Subject Preview box */}
          <div className="broadcaster-preview-subject-bar">
            <span className="broadcaster-preview-subject-label">Subject:</span>
            <span className="broadcaster-preview-subject-val">{subject || "[No Subject Composed]"}</span>
          </div>

          {/* Full email card render representation */}
          <div className="broadcaster-email-wrapper">
            <h2 className="broadcaster-email-header">{title || "[No Card Title]"}</h2>
            
            <p className="broadcaster-email-body">
              {message || "Draft your email notification body on the left. All text formatting and line breaks will be preserved in real-time visual output."}
            </p>

            {link.trim() && (
              <div className="broadcaster-email-btn-box">
                <a href={link} className="broadcaster-email-btn" onClick={(e) => e.preventDefault()}>
                  View Details
                </a>
              </div>
            )}

            <div className="broadcaster-email-footer">
              This is an automated message from IntelliHRMS. Please do not reply.
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--studio-text-muted)", fontSize: "12px", justifyContent: "center" }}>
            <HelpCircle size={14} />
            <span>This layout represents the finalized compiled layout delivered to users.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
