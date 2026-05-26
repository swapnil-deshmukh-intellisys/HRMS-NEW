import { useEffect, useState } from "react";
import { Trophy, Clock, Timer, ArrowLeft, ChevronLeft, ChevronRight, Medal, Star, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import toast from "react-hot-toast";
import Modal from "../../components/common/Modal";
import "./LeaderboardPage.css";

type LeaderboardEmployee = {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string | null;
  department: { name: string } | null;
  points?: number;
};

type WorkHoursEntry = {
  rank: number;
  employee: LeaderboardEmployee;
  totalMinutes: number;
  totalHours: number;
  presentDays: number;
};

type OnTimeEntry = {
  rank: number;
  employee: LeaderboardEmployee;
  onTimeDays: number;
  lateDays: number;
  totalDays: number;
  onTimeRate: number;
};

type LeaderboardData = {
  month: number;
  year: number;
  employeeOfMonth: WorkHoursEntry | null;
  workHoursRanking: WorkHoursEntry[];
  onTimeRanking: OnTimeEntry[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const QUICK_POINTS = [5, 10, 25, 50];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="lb-rank-badge lb-rank-badge--gold">🥇 1st</span>;
  if (rank === 2) return <span className="lb-rank-badge lb-rank-badge--silver">🥈 2nd</span>;
  if (rank === 3) return <span className="lb-rank-badge lb-rank-badge--bronze">🥉 3rd</span>;
  return <span className="lb-rank-badge lb-rank-badge--default">#{rank}</span>;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="lb-progress-track">
      <div className="lb-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function LeaderboardPage({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"WORK_HOURS" | "ON_TIME">("WORK_HOURS");

  // Points state
  const [pointsModal, setPointsModal] = useState<LeaderboardEmployee | null>(null);
  const [pointsMode, setPointsMode] = useState<"add" | "subtract">("add");
  const [pointsAmount, setPointsAmount] = useState(10);
  const [isSavingPoints, setIsSavingPoints] = useState(false);
  // local points map to avoid refetching entire leaderboard
  const [pointsMap, setPointsMap] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchLeaderboard();
  }, [month, year, token]);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      const res = await apiRequest<LeaderboardData>(
        `/attendance/leaderboard?month=${month}&year=${year}`,
        { token }
      );
      setData(res.data);
      // Seed pointsMap from fetched data
      const map: Record<number, number> = {};
      for (const entry of res.data.workHoursRanking) {
        map[entry.employee.id] = entry.employee.points ?? 0;
      }
      setPointsMap(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const current = new Date(year, month - 1);
    const today = new Date(now.getFullYear(), now.getMonth());
    if (current >= today) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function handleSavePoints() {
    if (!pointsModal) return;
    if (pointsAmount <= 0) {
      toast.error("Points must be greater than 0");
      return;
    }
    try {
      setIsSavingPoints(true);
      const res = await apiRequest<{ id: number; points: number }>(
        `/employees/${pointsModal.id}/points`,
        {
          method: "PATCH",
          token,
          body: { points: pointsAmount, mode: pointsMode },
        }
      );
      const newPoints = res.data.points;
      setPointsMap(prev => ({ ...prev, [pointsModal.id]: newPoints }));
      toast.success(
        `${pointsMode === "add" ? "+" : "-"}${pointsAmount} pts → ${pointsModal.firstName} now has ${newPoints} pts`
      );
      setPointsModal(null);
      setPointsAmount(10);
    } catch (err: any) {
      toast.error(err.message || "Failed to update points");
    } finally {
      setIsSavingPoints(false);
    }
  }

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const maxHours = data?.workHoursRanking[0]?.totalHours ?? 1;
  const maxOnTime = data?.onTimeRanking[0]?.onTimeDays ?? 1;


  return (
    <div className="lb-page">
      {/* Header */}
      <header className="lb-page-header">
        <div className="stack" style={{ gap: "4px" }}>
          <span className="eyebrow eyebrow--purple">Manager Console</span>
          <h2 className="page-title">Leaderboard</h2>
        </div>
        <button
          className="button button--secondary"
          onClick={() => navigate("/team")}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <ArrowLeft size={18} />
          Back to Team
        </button>
      </header>

      {/* Month Navigator */}
      <div className="lb-month-nav">
        <button className="lb-month-btn" onClick={prevMonth}>
          <ChevronLeft size={18} />
        </button>
        <span className="lb-month-label">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button className="lb-month-btn" onClick={nextMonth} disabled={isCurrentMonth}>
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="lb-loading">
          <div className="lb-skeleton lb-skeleton--hero" />
          <div className="lb-skeleton lb-skeleton--card" />
          <div className="lb-skeleton lb-skeleton--card" />
        </div>
      ) : !data || (data.workHoursRanking.length === 0 && data.onTimeRanking.length === 0) ? (
        <div className="lb-empty">
          <Trophy size={48} className="lb-empty-icon" />
          <h3>No Data Available</h3>
          <p>No attendance records found for {MONTH_NAMES[month - 1]} {year}.</p>
        </div>
      ) : (
        <>
          {/* Employee of the Month Hero */}
          {data.employeeOfMonth && (
            <div className="lb-eom-card">
              <div className="lb-eom-glow" />
              <div className="lb-eom-content">
                <div className="lb-eom-crown">👑</div>
                <div className="lb-eom-label">Employee of the Month</div>
                <div className="lb-eom-name">
                  {data.employeeOfMonth.employee.firstName} {data.employeeOfMonth.employee.lastName}
                </div>
                <div className="lb-eom-role">
                  {data.employeeOfMonth.employee.jobTitle ?? "Employee"}
                  {data.employeeOfMonth.employee.department && ` · ${data.employeeOfMonth.employee.department.name}`}
                </div>
                <div className="lb-eom-stats">
                  <div className="lb-eom-stat">
                    <Timer size={16} />
                    <span><strong>{data.employeeOfMonth.totalHours}h</strong> worked</span>
                  </div>
                  <div className="lb-eom-stat">
                    <Clock size={16} />
                    <span><strong>{data.employeeOfMonth.presentDays}</strong> days present</span>
                  </div>
                  <div className="lb-eom-stat">
                    <Star size={16} />
                    <span><strong>{pointsMap[data.employeeOfMonth.employee.id] ?? 0}</strong> pts total</span>
                  </div>
                </div>
                <div className="lb-eom-period">{MONTH_NAMES[month - 1]} {year}</div>
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="lb-tabs">
            <button
              className={`lb-tab ${activeTab === "WORK_HOURS" ? "lb-tab--active" : ""}`}
              onClick={() => setActiveTab("WORK_HOURS")}
            >
              <Timer size={16} />
              Work Hours Ranking
            </button>
            <button
              className={`lb-tab ${activeTab === "ON_TIME" ? "lb-tab--active" : ""}`}
              onClick={() => setActiveTab("ON_TIME")}
            >
              <Clock size={16} />
              On-Time Check-In Ranking
            </button>
          </div>

          {/* Work Hours Ranking */}
          {activeTab === "WORK_HOURS" && (
            <div className="lb-ranking-card">
              <div className="lb-ranking-header">
                <Medal size={18} />
                <h3>Work Hours Ranking</h3>
                <span className="lb-ranking-period">{MONTH_NAMES[month - 1]} {year}</span>
              </div>
              <div className="lb-ranking-list">
                {data.workHoursRanking.map((entry) => (
                    <div key={entry.employee.id} className={`lb-row ${entry.rank <= 3 ? "lb-row--top" : ""}`}>
                    <div className="lb-row-rank">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <div className="lb-row-avatar">
                      {entry.employee.firstName[0]}{entry.employee.lastName[0]}
                    </div>
                    <div className="lb-row-info">
                      <div className="lb-row-name">
                        {entry.employee.firstName} {entry.employee.lastName}
                        <span className="lb-row-code">#{entry.employee.employeeCode}</span>
                        <span className="lb-points-badge"><Star size={10} />{pointsMap[entry.employee.id] ?? 0} pts</span>
                      </div>
                      <div className="lb-row-meta">
                        {entry.employee.jobTitle ?? "Employee"} · {entry.employee.department?.name ?? "—"}
                      </div>
                      <ProgressBar value={entry.totalHours} max={maxHours} color="linear-gradient(90deg, #7c3aed, #a78bfa)" />
                    </div>
                    <div className="lb-row-right">
                      <div className="lb-row-stat">
                        <div className="lb-row-stat-primary">{entry.totalHours}h</div>
                        <div className="lb-row-stat-sub">{entry.presentDays} days</div>
                      </div>
                      <button
                        type="button"
                        className="lb-award-btn"
                        onClick={() => { setPointsModal(entry.employee); setPointsMode("add"); setPointsAmount(10); }}
                      >
                        <Star size={13} />
                        Points
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-Time Check-in Ranking */}
          {activeTab === "ON_TIME" && (
            <div className="lb-ranking-card">
              <div className="lb-ranking-header">
                <Clock size={18} />
                <h3>On-Time Check-In Ranking</h3>
                <span className="lb-ranking-period">{MONTH_NAMES[month - 1]} {year}</span>
              </div>
              {data.onTimeRanking.length === 0 ? (
                <div className="lb-empty" style={{ padding: "40px" }}>
                  <p>No check-in data for this month.</p>
                </div>
              ) : (
                <div className="lb-ranking-list">
                  {data.onTimeRanking.map((entry) => (
                    <div key={entry.employee.id} className={`lb-row ${entry.rank <= 3 ? "lb-row--top" : ""}`}>
                      <div className="lb-row-rank">
                        <RankBadge rank={entry.rank} />
                      </div>
                      <div className="lb-row-avatar">
                        {entry.employee.firstName[0]}{entry.employee.lastName[0]}
                      </div>
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {entry.employee.firstName} {entry.employee.lastName}
                          <span className="lb-row-code">#{entry.employee.employeeCode}</span>
                          <span className="lb-points-badge"><Star size={10} />{pointsMap[entry.employee.id] ?? 0} pts</span>
                        </div>
                        <div className="lb-row-meta">
                          {entry.employee.jobTitle ?? "Employee"} · {entry.employee.department?.name ?? "—"}
                        </div>
                        <ProgressBar value={entry.onTimeDays} max={maxOnTime} color="linear-gradient(90deg, #059669, #34d399)" />
                      </div>
                      <div className="lb-row-right">
                        <div className="lb-row-stat">
                          <div className="lb-row-stat-primary" style={{ color: "#059669" }}>{entry.onTimeRate}%</div>
                          <div className="lb-row-stat-sub">{entry.onTimeDays}/{entry.totalDays} days</div>
                        </div>
                        <button
                          type="button"
                          className="lb-award-btn"
                          onClick={() => { setPointsModal(entry.employee); setPointsMode("add"); setPointsAmount(10); }}
                        >
                          <Star size={13} />
                          Points
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Points Modal */}
      <Modal
        open={pointsModal !== null}
        title={`Award Points — ${pointsModal?.firstName} ${pointsModal?.lastName}`}
        onClose={() => { setPointsModal(null); setPointsAmount(10); }}
      >
        <div className="lb-points-modal">
          <div className="lb-points-current">
            <Star size={16} />
            <span>Current Points: <strong>{pointsMap[pointsModal?.id ?? -1] ?? 0}</strong></span>
          </div>

          {/* Mode toggle */}
          <div className="lb-points-mode">
            <button
              className={`lb-mode-btn ${pointsMode === "add" ? "lb-mode-btn--active-add" : ""}`}
              onClick={() => setPointsMode("add")}
            >
              <Plus size={14} /> Add
            </button>
            <button
              className={`lb-mode-btn ${pointsMode === "subtract" ? "lb-mode-btn--active-sub" : ""}`}
              onClick={() => setPointsMode("subtract")}
            >
              <Minus size={14} /> Deduct
            </button>
          </div>

          {/* Quick picks */}
          <div className="lb-quick-points">
            <span className="lb-quick-label">Quick select</span>
            <div className="lb-quick-chips">
              {QUICK_POINTS.map(q => (
                <button
                  key={q}
                  className={`lb-quick-chip ${pointsAmount === q ? "lb-quick-chip--active" : ""}`}
                  onClick={() => setPointsAmount(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="lb-custom-points">
            <label className="lb-custom-label">Custom amount</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={pointsAmount}
              onChange={e => setPointsAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="lb-custom-input"
            />
          </div>

          <div className="lb-points-preview">
            {pointsMode === "add" ? "+" : "-"}{pointsAmount} pts →{" "}
            <strong>
              {pointsMode === "add"
                ? (pointsMap[pointsModal?.id ?? -1] ?? 0) + pointsAmount
                : Math.max(0, (pointsMap[pointsModal?.id ?? -1] ?? 0) - pointsAmount)
              } pts
            </strong> total
          </div>

          <div className="lb-points-actions">
            <button
              className="button button--secondary"
              onClick={() => { setPointsModal(null); setPointsAmount(10); }}
              disabled={isSavingPoints}
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              onClick={handleSavePoints}
              disabled={isSavingPoints}
            >
              {isSavingPoints ? "Saving..." : "Save Points"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
