import React, { useState, useEffect, useRef } from "react";
import { 
  Mail, 
  Save, 
  RotateCcw, 
  Send, 
  Monitor, 
  Smartphone, 
  Eye, 
  FileCode, 
  Sliders, 
  HelpCircle,
  AlertCircle,
  Maximize2,
  Minimize2
} from "lucide-react";
import toast from "react-hot-toast";
import { apiRequest } from "../../services/api";
import "./EmailTemplatesPage.css";

interface GlobalStyles {
  BASE_STYLES: string;
  CARD_STYLES: string;
  HEADER_STYLES: string;
  BUTTON_STYLES: string;
}

interface EmailTemplateConfig {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
}

// Preset dynamic mock variables to show in the live preview
const MOCK_DATA_PRESETS: Record<string, Record<string, any>> = {
  generic_notification: {
    title: "System Maintenance Notice",
    message: "The HRMS system will undergo scheduled database optimizations tonight from 10:00 PM to 12:00 AM UTC. Please save your work beforehand.",
    link: "https://hrms-new-frontend.vercel.app/dashboard",
  },
  leave_request: {
    employeeName: "Ritesh Jawale",
    leaveType: "Sick Leave",
    startDate: "2026-05-23",
    endDate: "2026-05-24",
    link: "https://hrms-new-frontend.vercel.app/leaves",
    reason: "Need medical rest due to severe flu symptoms and doctor's prescription.",
  },
  leave_approved: {
    employeeName: "Ritesh Jawale",
    leaveType: "Privilege Leave",
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    approvedBy: "Rahul Jadhav (Manager)",
    link: "https://hrms-new-frontend.vercel.app/leaves",
  },
  leave_rejected: {
    employeeName: "Ritesh Jawale",
    leaveType: "Casual Leave",
    startDate: "2026-05-25",
    endDate: "2026-05-26",
    rejectedBy: "Rahul Jadhav (Manager)",
    reason: "High density of team members taking leave during this week. Please reschedule.",
    link: "https://hrms-new-frontend.vercel.app/leaves",
  },
  colleague_birthday: {
    colleagueName: "Ritesh Jawale",
    employeeName: "Ritesh Jawale",
    link: "https://hrms-new-frontend.vercel.app/employees",
  },
  announcement: {
    title: "Annual Hackathon 2026 Announcement! 🚀",
    priority: "HIGH",
    contentStr: "Dear Team,\n\nWe are extremely thrilled to announce our Annual Hackathon 2026 scheduled for next weekend! Register your teams, draft your idea proposals, and prepare for a 36-hour sprint of pure creation, learning, and fun.\n\nFabulous prizes and custom swags await the winners!\n\nBest Regards,\nHR Team",
    link: "https://hrms-new-frontend.vercel.app/",
  },
  birthday_wish: {
    recipientName: "Test User",
    title: "Wishing You A Happy Birthday!",
    wishMessage: "May your day be filled with warm laughter, beautiful memories, and great accomplishments. Thank you for your incredible contributions to our family!",
    theme: "gold",
  },
};

interface EmailTemplatesPageProps {
  token: string;
}

export default function EmailTemplatesPage({ token }: EmailTemplatesPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Database States
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>({
    BASE_STYLES: "",
    CARD_STYLES: "",
    HEADER_STYLES: "",
    BUTTON_STYLES: "",
  });
  const [templates, setTemplates] = useState<Record<string, EmailTemplateConfig>>({});
  
  // Editor States
  const [selectedId, setSelectedId] = useState("leave_request");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [mockVars, setMockVars] = useState<Record<string, any>>({});
  const [lastFocusedField, setLastFocusedField] = useState<"subject" | "body">("body");
  
  // Layout States
  const [activeTab, setActiveTab] = useState<"template" | "styles">("template");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  
  // Testing State
  const [testTo, setTestTo] = useState("riteshrjawale@gmail.com");
  
  // Loading status UI
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleFullscreenToggle = () => {
    if (!cardRef.current) return;

    if (!document.fullscreenElement) {
      cardRef.current.requestFullscreen().catch((err) => {
        toast.error(`Error entering fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // 1. Fetch templates configuration from backend on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ globalStyles: GlobalStyles; templates: Record<string, EmailTemplateConfig> }>(
        "/email-templates",
        { token }
      );
      if (data.success) {
        setGlobalStyles(data.data.globalStyles);
        setTemplates(data.data.templates);
        
        // Setup initial default selected template values
        const initialTemplate = data.data.templates[selectedId];
        if (initialTemplate) {
          setCustomSubject(initialTemplate.subject);
          setCustomBody(initialTemplate.body);
        }
        
        // Setup mock data presets
        setMockVars(MOCK_DATA_PRESETS[selectedId] || {});
      } else {
        throw new Error(data.message || "Failed to load templates.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to reach templates server. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Synchronize editor fields when template selection changes
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    const template = templates[id];
    if (template) {
      setCustomSubject(template.subject);
      setCustomBody(template.body);
      setMockVars(MOCK_DATA_PRESETS[id] || {});
    }
  };

  // 3. Compile email rendering in real time for dynamic iframe preview
  const getRenderedOutput = () => {
    const { BASE_STYLES, CARD_STYLES, HEADER_STYLES, BUTTON_STYLES } = globalStyles;
    
    // Inject CSS variables
    const renderVars: Record<string, any> = {
      ...mockVars,
      BASE_STYLES,
      CARD_STYLES,
      HEADER_STYLES,
      BUTTON_STYLES,
    };

    // Specialty logic: Leave request duration and range formatting
    if (selectedId === "leave_request" || selectedId === "leave_approved" || selectedId === "leave_rejected") {
      try {
        const start = new Date(mockVars.startDate || "2026-05-23");
        const end = new Date(mockVars.endDate || "2026-05-24");
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        renderVars.durationDays = diffDays;
        renderVars.isSingleDay = (mockVars.startDate === mockVars.endDate) || (diffDays === 1);

        const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', formatOptions);
        const endStr = end.toLocaleDateString('en-US', formatOptions);
        
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        let range = "";
        if (startYear === endYear) {
          const startMonthDay = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          range = `${startMonthDay} – ${endStr}`;
        } else {
          range = `${startStr} – ${endStr}`;
        }
        renderVars.formattedRange = range;
      } catch (err) {
        renderVars.durationDays = 2;
        renderVars.isSingleDay = false;
        renderVars.formattedRange = "May 23 – May 24, 2026";
      }
    }

    // Specialty logic: Birthday theme style compiler
    if (selectedId === "birthday_wish" && mockVars.theme) {
      const theme = mockVars.theme;
      const recipientName = mockVars.recipientName || "Valued Employee";
      renderVars.recipientInitials = recipientName.charAt(0).toUpperCase();

      if (theme === "gold") {
        renderVars.cardStyles = `background: radial-gradient(circle, #222228 0%, #0d0d10 100%); border: 2px solid #bf953f; color: #e2e8f0; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(191, 149, 63, 0.2);`;
        renderVars.titleStyles = `color: #fcf6ba; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "👑";
      } else if (theme === "neon") {
        renderVars.cardStyles = `background-color: #0c0a0f; border: 2px solid #a855f7; color: #e4e4e7; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(168, 85, 247, 0.2);`;
        renderVars.titleStyles = `color: #c084fc; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "⚡";
      } else if (theme === "cozy") {
        renderVars.cardStyles = `background: linear-gradient(135deg, #fffaf3 0%, #fff6ea 100%); border: 1px solid #f97316; color: #451a03; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(249, 115, 22, 0.1);`;
        renderVars.titleStyles = `color: #ea580c; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "🎂";
      } else {
        // default/confetti
        renderVars.cardStyles = `background: linear-gradient(135deg, #fff5f7 0%, #ffedf1 100%); border: 2px solid #fecdd3; color: #1e293b; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(244, 114, 182, 0.15);`;
        renderVars.titleStyles = `color: #be185d; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "🎈";
      }
    }

    // Specialty logic: Announcements priority
    if (selectedId === "announcement" && mockVars.priority) {
      renderVars.isHighPriority = mockVars.priority === "HIGH" || mockVars.priority === "URGENT";
    }

    // Specialty logic: Colleague Birthday aliasing for colleagueName and employeeName
    if (selectedId === "colleague_birthday") {
      const name = mockVars.colleagueName || mockVars.employeeName || "Colleague";
      renderVars.colleagueName = name;
      renderVars.employeeName = name;
    }

    // Simple Token Engine
    const parseTokens = (str: string) => {
      let result = str;

      // 1. Conditionals {{#if key}} content {{/if}}
      const ifRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
      result = result.replace(ifRegex, (_match, key, content) => {
        const val = key.split('.').reduce((o: any, i: string) => o?.[i], renderVars);
        return val ? content : "";
      });

      // 2. Unless block
      const unlessRegex = /\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
      result = result.replace(unlessRegex, (_match, key, content) => {
        const val = key.split('.').reduce((o: any, i: string) => o?.[i], renderVars);
        return !val ? content : "";
      });

      // 3. Variables {{key}}
      const tokenRegex = /\{\{([\w.]+)\}\}/g;
      result = result.replace(tokenRegex, (_match, key) => {
        const val = key.split('.').reduce((o: any, i: string) => o?.[i], renderVars);
        return val !== undefined ? String(val) : "";
      });

      return result;
    };

    const renderedSubject = parseTokens(customSubject);
    const renderedBody = parseTokens(customBody);

    // Apply global base skeleton wrapper (except birthday wishes, leave request, leave approved, leave rejected which contain self-contained styling wrappers)
    const finalHtml = (selectedId === "birthday_wish" || selectedId === "leave_request" || selectedId === "leave_approved" || selectedId === "leave_rejected")
      ? renderedBody
      : `<div style="${BASE_STYLES}">
          <div style="${CARD_STYLES}">
            ${renderedBody}
          </div>
          <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px;">
            This is an automated message from IntelliHRMS. Please do not reply.
          </div>
        </div>`;

    return {
      subject: renderedSubject,
      html: finalHtml
    };
  };

  // 4. Inject rendered HTML to preview frame when code edits happen
  const preview = getRenderedOutput();

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(preview.html);
        doc.close();
      }
    }
  }, [preview.html, previewMode]);

  // 5. Save edited template or global wrapper styles to the backend
  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === "template") {
        // Save current template configurations
        const data = await apiRequest<EmailTemplateConfig>(`/email-templates/${selectedId}`, {
          method: "PUT",
          token,
          body: {
            subject: customSubject,
            body: customBody,
          },
        });
        if (data.success) {
          setTemplates((prev) => ({
            ...prev,
            [selectedId]: {
              ...prev[selectedId],
              subject: customSubject,
              body: customBody,
            },
          }));
          toast.success("Email template saved successfully!");
        } else {
          throw new Error(data.message || "Failed to save template.");
        }
      } else {
        // Save global wrapper CSS styles layout
        const data = await apiRequest<GlobalStyles>("/email-templates/styles", {
          method: "PUT",
          token,
          body: globalStyles,
        });
        if (data.success) {
          setGlobalStyles(data.data);
          toast.success("Global styles updated system-wide!");
        } else {
          throw new Error(data.message || "Failed to save global styles.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // 6. Reset selected template or global styles back to factory defaults
  const handleReset = async () => {
    if (!window.confirm(`Are you sure you want to restore defaults for the current ${activeTab === 'template' ? 'template' : 'styles'}? All overrides will be lost.`)) {
      return;
    }
    
    setResetting(true);
    try {
      if (activeTab === "template") {
        const data = await apiRequest<EmailTemplateConfig>(`/email-templates/${selectedId}/reset`, {
          method: "POST",
          token,
        });
        if (data.success) {
          setCustomSubject(data.data.subject);
          setCustomBody(data.data.body);
          setTemplates((prev) => ({
            ...prev,
            [selectedId]: data.data,
          }));
          toast.success("Template reverted to factory defaults!");
        } else {
          throw new Error(data.message || "Failed to reset template.");
        }
      } else {
        const data = await apiRequest<GlobalStyles>("/email-templates/styles/reset", {
          method: "POST",
          token,
        });
        if (data.success) {
          setGlobalStyles(data.data);
          toast.success("Global layout styles reset to defaults!");
        } else {
          throw new Error(data.message || "Failed to reset styles.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred during reset.");
    } finally {
      setResetting(false);
    }
  };

  // 7. Dispatch actual test email to check layout rendering inside real mail client
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo) return;

    setTesting(true);
    try {
      const data = await apiRequest<any>(`/email-templates/${selectedId}/send-test`, {
        method: "POST",
        token,
        body: {
          to: testTo,
          variables: mockVars,
        },
      });
      if (data.success) {
        toast.success(`Test email dispatched successfully to ${testTo}`);
      } else {
        throw new Error(data.message || "Failed to send test email.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "SMTP transporter failed. Verify env variables.");
    } finally {
      setTesting(false);
    }
  };

  const handleMockVarChange = (key: string, value: any) => {
    setMockVars((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      const isLeave = selectedId === "leave_request" || selectedId === "leave_approved" || selectedId === "leave_rejected";
      if (isLeave && key === "startDate" && prev.startDate === prev.endDate) {
        updated.endDate = value;
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="templates-loading-container">
        <div className="spinner"></div>
        <p>Loading real-time templates playground...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="templates-error-card">
        <AlertCircle size={40} className="error-icon" />
        <h3>Failed to Load Email Studio</h3>
        <p>{error}</p>
        <button onClick={fetchTemplates} className="primary-btn">Retry Connection</button>
      </div>
    );
  }

  const currentTemplate = templates[selectedId];

  return (
    <div className="email-studio-container">
      {/* Visual Header */}
      <header className="studio-header">
        <div className="header-meta">
          <div className="meta-icon-badge">
            <Mail size={24} />
          </div>
          <div>
            <h1>Email Template Studio</h1>
            <p>Design, customize, styling adjustments, and verify transactional emails system-wide.</p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="header-actions">
          <button 
            onClick={handleReset} 
            disabled={saving || resetting || testing}
            className="secondary-btn btn-with-icon warning-outline-hover"
            title="Reset active tab elements to defaults"
          >
            <RotateCcw size={16} className={resetting ? "spin-animation" : ""} />
            Reset Defaults
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || resetting || testing}
            className="primary-btn btn-with-icon"
          >
            <Save size={16} />
            {saving ? "Saving Changes..." : "Save Template"}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="studio-workspace">
        
        {/* Left Panel: Editor & Controllers */}
        <div className="workspace-editor-pane">
          <div className="pane-card select-template-card">
            <h3>Select Email Event Template</h3>
            <div className="select-wrapper">
              <select value={selectedId} onChange={handleTemplateChange} className="large-select">
                {Object.values(templates)
                  .filter((t) => t.id !== "generic_notification")
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>
            {currentTemplate && (
              <p className="template-desc-text">
                <strong>Event description:</strong> {currentTemplate.description}
              </p>
            )}
          </div>

          {/* Configuration Tabs Toggler */}
          <div className="tab-control-bar">
            <button 
              className={`tab-btn ${activeTab === "template" ? "active" : ""}`}
              onClick={() => setActiveTab("template")}
            >
              <FileCode size={16} />
              HTML Body Content
            </button>
            <button 
              className={`tab-btn ${activeTab === "styles" ? "active" : ""}`}
              onClick={() => setActiveTab("styles")}
            >
              <Sliders size={16} />
              Global Layout Styles
            </button>
          </div>

          {/* Active Configuration Workspace Panel */}
          {activeTab === "template" ? (
            <div className="pane-card content-editor-card animation-fade-in">
              <div className="input-group">
                <label htmlFor="email-subject-field">Email Subject Template</label>
                <input 
                  id="email-subject-field"
                  type="text" 
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onFocus={() => setLastFocusedField("subject")}
                  placeholder="Enter email subject template..."
                  className="full-width-input font-bold"
                />
              </div>

              <div className="input-group text-area-group">
                <div className="label-with-meta">
                  <label htmlFor="email-body-editor">Template HTML Body</label>
                  <span className="badge-meta">Raw Monospace Editor</span>
                </div>
                <textarea 
                  id="email-body-editor"
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  onFocus={() => setLastFocusedField("body")}
                  placeholder="<h1>Hello {{employeeName}}</h1>..."
                  className="monospace-editor"
                  spellCheck="false"
                />
              </div>

              {/* Variable Helper chips bar */}
              {currentTemplate && (
                <div className="variable-chips-section">
                  <h4>Available Placeholders:</h4>
                  <div className="chips-wrapper">
                    {currentTemplate.variables.map((v) => (
                      <span 
                        key={v} 
                        className="variable-chip"
                        onClick={() => {
                          const fieldId = lastFocusedField === "subject" ? "email-subject-field" : "email-body-editor";
                          const element = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement;
                          if (element) {
                            const start = element.selectionStart ?? 0;
                            const end = element.selectionEnd ?? 0;
                            const text = element.value;
                            const before = text.substring(0, start);
                            const after  = text.substring(end, text.length);
                            const insertion = `{{${v}}}`;
                            if (lastFocusedField === "subject") {
                              setCustomSubject(before + insertion + after);
                            } else {
                              setCustomBody(before + insertion + after);
                            }
                            element.focus();
                            // Move cursor after the token
                            setTimeout(() => {
                              element.selectionStart = element.selectionEnd = start + insertion.length;
                            }, 50);
                          }
                        }}
                        title={`Click to insert {{${v}}}`}
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                  <small className="chips-helper">Tip: Click any placeholder chip badge to insert it at your active cursor location (Subject or Body).</small>
                </div>
              )}
            </div>
          ) : (
            <div className="pane-card global-styles-editor-card animation-fade-in">
              <div className="alert-banner-info">
                <HelpCircle size={16} />
                <span>Modifications made here apply container skeleton styles across all email events globally.</span>
              </div>

              <div className="input-group">
                <label>Base Styling (`BASE_STYLES` Wrapper)</label>
                <textarea
                  value={globalStyles.BASE_STYLES}
                  onChange={(e) => setGlobalStyles({ ...globalStyles, BASE_STYLES: e.target.value })}
                  className="monospace-style-editor"
                  spellCheck="false"
                />
              </div>

              <div className="input-group">
                <label>Base Card Layout (`CARD_STYLES` Wrapper)</label>
                <textarea
                  value={globalStyles.CARD_STYLES}
                  onChange={(e) => setGlobalStyles({ ...globalStyles, CARD_STYLES: e.target.value })}
                  className="monospace-style-editor"
                  spellCheck="false"
                />
              </div>

              <div className="input-group">
                <label>Header Style CSS (`HEADER_STYLES` Modifier)</label>
                <textarea
                  value={globalStyles.HEADER_STYLES}
                  onChange={(e) => setGlobalStyles({ ...globalStyles, HEADER_STYLES: e.target.value })}
                  className="monospace-style-editor"
                  spellCheck="false"
                />
              </div>

              <div className="input-group">
                <label>CTA Button Style CSS (`BUTTON_STYLES` Modifier)</label>
                <textarea
                  value={globalStyles.BUTTON_STYLES}
                  onChange={(e) => setGlobalStyles({ ...globalStyles, BUTTON_STYLES: e.target.value })}
                  className="monospace-style-editor"
                  spellCheck="false"
                />
              </div>
            </div>
          )}

          {/* Variables Sandbox Values panel */}
          <div className="pane-card variable-sandbox-card">
            <div className="sandbox-header">
              <h3>Preview Sandbox Mock Values</h3>
              <span className="badge-sandbox">Interactive Controls</span>
            </div>
            <p className="sandbox-helper-text">Customize the parameters below to verify how different fields impact the visual email wrapper output in real time.</p>
            
            <div className="sandbox-grid">
              {(selectedId === "leave_request" || selectedId === "leave_approved" || selectedId === "leave_rejected") && (
                <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <input
                    id="sandbox-one-day-toggle"
                    type="checkbox"
                    checked={mockVars.startDate === mockVars.endDate}
                    onChange={() => {
                      const isOneDay = mockVars.startDate === mockVars.endDate;
                      if (!isOneDay) {
                        setMockVars((prev) => ({
                          ...prev,
                          endDate: prev.startDate,
                        }));
                      } else {
                        try {
                          const d = new Date(mockVars.startDate || "2026-05-23");
                          d.setDate(d.getDate() + 1);
                          const tomorrowStr = d.toISOString().split('T')[0];
                          setMockVars((prev) => ({
                            ...prev,
                            endDate: tomorrowStr,
                          }));
                        } catch (err) {
                          setMockVars((prev) => ({
                            ...prev,
                            endDate: "2026-05-24",
                          }));
                        }
                      }
                    }}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="sandbox-one-day-toggle" style={{ fontWeight: "600", cursor: "pointer", fontSize: "13px", color: "var(--studio-text-strong)", margin: 0 }}>
                    One Day Leave / Single Date Request
                  </label>
                </div>
              )}
              {Object.entries(mockVars)
                .filter(([key]) => !((mockVars.startDate === mockVars.endDate) && (selectedId === "leave_request" || selectedId === "leave_approved" || selectedId === "leave_rejected") && key === "endDate"))
                .map(([key, value]) => (
                  <div key={key} className="sandbox-field-group">
                    <label htmlFor={`sandbox-val-${key}`}>{key}</label>
                    
                    {key === "theme" && selectedId === "birthday_wish" ? (
                      <select 
                        id={`sandbox-val-${key}`}
                        value={value} 
                        onChange={(e) => handleMockVarChange(key, e.target.value)}
                        className="sandbox-input select-sandbox"
                      >
                        <option value="default">Default (Confetti Pink)</option>
                        <option value="gold">Gold Theme</option>
                        <option value="neon">Neon Theme</option>
                        <option value="cozy">Cozy Warm Theme</option>
                      </select>
                    ) : key === "priority" && selectedId === "announcement" ? (
                      <select
                        id={`sandbox-val-${key}`}
                        value={value}
                        onChange={(e) => handleMockVarChange(key, e.target.value)}
                        className="sandbox-input select-sandbox"
                      >
                        <option value="NORMAL">Normal Priority</option>
                        <option value="HIGH">High Priority</option>
                        <option value="URGENT">Urgent Priority</option>
                      </select>
                    ) : key === "contentStr" || key === "message" || key === "reason" ? (
                      <textarea
                        id={`sandbox-val-${key}`}
                        value={value}
                        onChange={(e) => handleMockVarChange(key, e.target.value)}
                        className="sandbox-input textarea-sandbox"
                        rows={3}
                      />
                    ) : (key === "startDate" || key === "endDate") ? (
                      <input 
                        id={`sandbox-val-${key}`}
                        type="date"
                        value={value}
                        onChange={(e) => handleMockVarChange(key, e.target.value)}
                        className="sandbox-input"
                      />
                    ) : (
                      <input 
                        id={`sandbox-val-${key}`}
                        type="text"
                        value={value}
                        onChange={(e) => handleMockVarChange(key, e.target.value)}
                        className="sandbox-input"
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Test Email Transporter */}
          <div className="pane-card test-email-card">
            <h3>Test Dispatch Mailbox</h3>
            <p className="test-desc">Send the current live configuration rendering directly to a physical mailbox to verify layouts, line wraps, margins, and button shapes.</p>
            <form onSubmit={handleSendTest} className="test-email-form">
              <div className="email-transporter-input-wrapper">
                <input 
                  type="email" 
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="enter.your.email@example.com"
                  className="test-email-input"
                  required
                />
                <button 
                  type="submit" 
                  disabled={saving || resetting || testing || !testTo}
                  className="test-submit-btn"
                >
                  <Send size={14} className={testing ? "send-fly-animation" : ""} />
                  {testing ? "Sending..." : "Dispatch Test"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Panel: Live Visual Output Preview */}
        <div className="workspace-preview-pane">
          <div ref={cardRef} className={`preview-container-card ${isFullscreen ? "is-fullscreen" : ""}`}>
            
            {/* Viewport & Device Toggler */}
            <div className="preview-toolbar">
              <div className="preview-title-meta">
                <Eye size={16} />
                <span>Live Rendering Preview</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="viewport-toggle-wrapper">
                  <button 
                    type="button"
                    className={`viewport-btn ${previewMode === "desktop" ? "active" : ""}`}
                    onClick={() => setPreviewMode("desktop")}
                    title="Desktop Layout View"
                  >
                    <Monitor size={15} />
                    Desktop
                  </button>
                  <button 
                    type="button"
                    className={`viewport-btn ${previewMode === "mobile" ? "active" : ""}`}
                    onClick={() => setPreviewMode("mobile")}
                    title="Mobile Responsive View"
                  >
                    <Smartphone size={15} />
                    Mobile
                  </button>
                </div>
                <button
                  type="button"
                  className="viewport-btn"
                  onClick={handleFullscreenToggle}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid var(--studio-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    background: "none"
                  }}
                >
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            {/* Subject preview box */}
            <div className="subject-preview-bar">
              <span className="subject-label">Subject:</span>
              <span className="subject-content-text">{preview.subject || "[No Subject Specified]"}</span>
            </div>

            {/* Dynamic Sandbox isolated responsive Frame */}
            <div className="viewport-screen-container">
              <div className={`viewport-device-shell ${previewMode}`}>
                <iframe 
                  ref={iframeRef}
                  title="HTML Email Live Sandbox Frame"
                  className="live-preview-iframe"
                />
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
