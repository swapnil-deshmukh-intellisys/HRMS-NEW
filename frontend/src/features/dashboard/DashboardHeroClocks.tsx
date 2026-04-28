import { useEffect, useState, useRef, useMemo } from "react";
import { MoreVertical, Search, X } from "lucide-react";
import TimeCard from "../../components/common/TimeCard";
import "./DashboardHeroClocks.css";

const IST_TIMEZONE = "Asia/Kolkata";
const STORAGE_PREFIX = "hrms_dashboard_tz_";

const availableTimezones = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch (e) {
    return [
      "UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"
    ];
  }
})();

const CLOCKS: ClockConfig[] = [
  { id: "left-far", defaultTz: "America/Los_Angeles", variant: "minimal" },
  { id: "left-near", defaultTz: "America/New_York", variant: "minimal" },
  { id: "center", defaultTz: IST_TIMEZONE, fixed: true, variant: "default" },
  { id: "right-near", defaultTz: "Europe/London", variant: "minimal" },
  { id: "right-far", defaultTz: "Asia/Dubai", variant: "minimal" },
];

type ClockConfig = {
  id: string;
  defaultTz: string;
  fixed?: boolean;
  variant: "default" | "minimal";
};

function TimezoneDropdown({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (tz: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredTimezones = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return availableTimezones.filter(tz => 
      tz.toLowerCase().includes(term) || 
      tz.replace(/_/g, " ").toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className="clock-timezone-picker" ref={dropdownRef}>
      <button 
        className="clock-timezone-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change timezone"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="clock-timezone-dropdown">
          <div className="clock-timezone-search">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search region..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm("")}>
                <X size={12} />
              </button>
            )}
          </div>
          <div className="clock-timezone-list">
            {filteredTimezones.length > 0 ? (
              filteredTimezones.map(tz => (
                <button 
                  key={tz} 
                  className={`timezone-item ${tz === value ? "active" : ""}`}
                  onClick={() => {
                    onChange(tz);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {tz.replace(/_/g, " ")}
                </button>
              ))
            ) : (
              <div className="timezone-no-results">No regions found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardHeroClocks() {
  const [now, setNow] = useState(() => new Date());
  const [timezones, setTimezones] = useState<Record<string, string>>(() => {
    const saved: Record<string, string> = {};
    CLOCKS.forEach(clock => {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${clock.id}`);
      saved[clock.id] = clock.fixed ? IST_TIMEZONE : (stored || clock.defaultTz);
    });
    return saved;
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleTzChange = (id: string, tz: string) => {
    setTimezones(prev => ({ ...prev, [id]: tz }));
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, tz);
  };

  return (
    <div className="dashboard-hero-clocks">
      {CLOCKS.map((clock) => (
        <div key={clock.id} className="dashboard-hero-clock-wrapper">
          <TimeCard 
            timezone={timezones[clock.id]} 
            now={now} 
            variant={clock.variant}
          >
            {!clock.fixed && (
              <TimezoneDropdown 
                value={timezones[clock.id]} 
                onChange={(tz) => handleTzChange(clock.id, tz)} 
              />
            )}
          </TimeCard>
        </div>
      ))}
    </div>
  );
}
