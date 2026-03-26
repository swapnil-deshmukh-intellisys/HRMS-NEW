import "./EmployeeProfileTabs.css";

export type EmployeeProfileTabKey = "overview" | "attendance" | "leaves" | "payroll";

type EmployeeProfileTabsProps = {
  activeTab: EmployeeProfileTabKey;
  tabs?: Array<{ key: EmployeeProfileTabKey; label: string }>;
  onChange: (tab: EmployeeProfileTabKey) => void;
};

const defaultTabs: Array<{ key: EmployeeProfileTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "attendance", label: "Attendance" },
  { key: "leaves", label: "Leaves" },
  { key: "payroll", label: "Payroll" },
];

export default function EmployeeProfileTabs({ activeTab, tabs = defaultTabs, onChange }: EmployeeProfileTabsProps) {
  return (
    <div className="card employee-profile-tabs" role="tablist" aria-label="Employee profile sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          className={activeTab === tab.key ? "employee-profile-tab active" : "employee-profile-tab"}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
