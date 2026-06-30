import { useEffect, useState } from "react";
import { Trophy, Clock, Timer, ArrowLeft, ChevronLeft, ChevronRight, Medal, Star, Plus, Minus, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest, getFileUrl } from "../../services/api";
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
  profilePictureUrl?: string | null;
};

type PointHistoryEntry = {
  id: number;
  amount: number;
  reason: string;
  mode: string;
  createdAt: string;
  givenBy?: { firstName: string; lastName: string } | null;
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

type PointsEntry = {
  rank: number;
  employee: LeaderboardEmployee;
  points: number;
};

type PointsDisputeTicket = {
  id: number;
  pointHistoryId: number;
  employeeId: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hrRemarks: string | null;
  resolvedById: number | null;
  resolvedAt: string | null;
  createdAt: string;
  employee?: {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode: string;
    profilePictureUrl: string | null;
  };
  pointHistory?: PointHistoryEntry;
  resolvedBy?: { id: number; firstName: string; lastName: string } | null;
};


type LeaderboardData = {
  month: number;
  year: number;
  employeeOfMonth: WorkHoursEntry | null;
  workHoursRanking: WorkHoursEntry[];
  onTimeRanking: OnTimeEntry[];
  pointsRanking: PointsEntry[];
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

const AVATAR_COLORS = [
  "#e57373", // Red
  "#f06292", // Pink
  "#ba68c8", // Purple
  "#9575cd", // Deep Purple
  "#7986cb", // Indigo
  "#64b5f6", // Blue
  "#4fc3f7", // Light Blue
  "#4dd0e1", // Cyan
  "#4db6ac", // Teal
  "#81c784", // Green
  "#aed581", // Light Green
  "#d4e157", // Lime
  "#ffd54f", // Amber
  "#ffb74d", // Orange
  "#ff8a65", // Deep Orange
  "#a1887f", // Brown
  "#90a4ae"  // Blue Grey
];

function getAvatarColor(employeeId: number) {
  const index = Math.abs(employeeId) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function LeaderboardAvatar({ employee }: { employee: LeaderboardEmployee }) {
  const [error, setError] = useState(false);
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  
  const hasPic = !!(employee.profilePictureUrl && !error);
  const avatarBg = hasPic ? "transparent" : getAvatarColor(employee.id);

  return (
    <div className="lb-row-avatar" style={{ background: avatarBg }}>
      {hasPic ? (
        <img
          src={getFileUrl(employee.profilePictureUrl!) || ""}
          alt={`${employee.firstName} ${employee.lastName}`}
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function LeaderboardPage({ 
  token, 
  role = "EMPLOYEE",
  currentEmployeeId = null
}: { 
  token: string | null, 
  role?: string,
  currentEmployeeId?: number | null 
}) {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"WORK_HOURS" | "ON_TIME" | "POINTS" | "DISPUTES">("WORK_HOURS");

  // Points state
  const [pointsModal, setPointsModal] = useState<LeaderboardEmployee | null>(null);
  const [pointsMode, setPointsMode] = useState<"add" | "subtract">("add");
  const [pointsAmount, setPointsAmount] = useState(10);
  const [pointsReason, setPointsReason] = useState("");
  const [isSavingPoints, setIsSavingPoints] = useState(false);
  // local points map to avoid refetching entire leaderboard
  const [pointsMap, setPointsMap] = useState<Record<number, number>>({});
  
  // History state
  const [historyModal, setHistoryModal] = useState<LeaderboardEmployee | null>(null);
  const [pointsHistory, setPointsHistory] = useState<PointHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Disputes state
  const [disputesMap, setDisputesMap] = useState<Record<number, PointsDisputeTicket>>({});
  const [allDisputes, setAllDisputes] = useState<PointsDisputeTicket[]>([]);
  const [isLoadingDisputes, setIsLoadingDisputes] = useState(false);
  const [disputeReasonInput, setDisputeReasonInput] = useState<Record<number, string>>({});
  const [submittingDisputeId, setSubmittingDisputeId] = useState<number | null>(null);
  const [showDisputeFormId, setShowDisputeFormId] = useState<number | null>(null);
  const [hrRemarksInput, setHrRemarksInput] = useState<Record<number, string>>({});
  const [resolvingDisputeId, setResolvingDisputeId] = useState<number | null>(null);

  // Previous month winners for current month highlights
  const [prevWorkHoursWinnerId, setPrevWorkHoursWinnerId] = useState<number | null>(null);
  const [prevOnTimeWinnerId, setPrevOnTimeWinnerId] = useState<number | null>(null);
  const [prevWinnerEntry, setPrevWinnerEntry] = useState<WorkHoursEntry | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [month, year, token]);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      const currentPromise = apiRequest<LeaderboardData>(
        `/attendance/leaderboard?month=${month}&year=${year}`,
        { token }
      );

      let prevWorkHoursId: number | null = null;
      let prevOnTimeId: number | null = null;

      // Only fetch previous month's data if we are viewing the current month
      const isCurrMonth = month === now.getMonth() + 1 && year === now.getFullYear();
      let prevPromise = Promise.resolve<any>(null);
      if (isCurrMonth) {
        let prevM = month - 1;
        let prevY = year;
        if (prevM === 0) {
          prevM = 12;
          prevY = year - 1;
        }
        prevPromise = apiRequest<LeaderboardData>(
          `/attendance/leaderboard?month=${prevM}&year=${prevY}`,
          { token }
        ).catch(err => {
          console.error("Failed to load previous month leaderboard", err);
          return null;
        });
      }

      const [res, prevRes] = await Promise.all([currentPromise, prevPromise]);

      setData(res.data);
      // Seed pointsMap from fetched data
      const map: Record<number, number> = {};
      for (const entry of res.data.workHoursRanking) {
        map[entry.employee.id] = entry.employee.points ?? 0;
      }
      setPointsMap(map);

      if (prevRes && prevRes.data) {
        prevWorkHoursId = prevRes.data.workHoursRanking[0]?.employee.id ?? null;
        prevOnTimeId = prevRes.data.onTimeRanking[0]?.employee.id ?? null;
        setPrevWinnerEntry(prevRes.data.employeeOfMonth ?? prevRes.data.workHoursRanking[0] ?? null);
      } else {
        setPrevWinnerEntry(null);
      }
      setPrevWorkHoursWinnerId(prevWorkHoursId);
      setPrevOnTimeWinnerId(prevOnTimeId);
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
    if (!pointsReason.trim()) {
      toast.error("Please provide a reason for the points adjustment");
      return;
    }
    try {
      setIsSavingPoints(true);
      const res = await apiRequest<{ id: number; points: number }>(
        `/employees/${pointsModal.id}/points`,
        {
          method: "PATCH",
          token,
          body: { points: pointsAmount, mode: pointsMode, reason: pointsReason },
        }
      );
      const newPoints = res.data.points;
      setPointsMap(prev => ({ ...prev, [pointsModal.id]: newPoints }));
      toast.success(
        `${pointsMode === "add" ? "+" : "-"}${pointsAmount} pts → ${pointsModal.firstName} now has ${newPoints} pts`
      );
      setPointsModal(null);
      setPointsAmount(10);
      setPointsReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update points");
    } finally {
      setIsSavingPoints(false);
    }
  }

  async function handleViewHistory(emp: LeaderboardEmployee) {
    setHistoryModal(emp);
    setIsLoadingHistory(true);
    setPointsHistory([]);
    setDisputesMap({});
    setShowDisputeFormId(null);
    setDisputeReasonInput({});
    try {
      const [historyRes, disputesRes] = await Promise.all([
        apiRequest<PointHistoryEntry[]>(`/employees/${emp.id}/points-history`, { token }),
        apiRequest<PointsDisputeTicket[]>("/employees/disputes", { token })
      ]);
      setPointsHistory(historyRes.data);

      const dMap: Record<number, PointsDisputeTicket> = {};
      disputesRes.data.forEach(d => {
        dMap[d.pointHistoryId] = d;
      });
      setDisputesMap(dMap);
    } catch (err: any) {
      toast.error(err.message || "Failed to load history");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleRaiseDispute(pointHistoryId: number) {
    const reason = disputeReasonInput[pointHistoryId]?.trim();
    if (!reason) {
      toast.error("Please enter a reason for the dispute");
      return;
    }

    try {
      setSubmittingDisputeId(pointHistoryId);
      const res = await apiRequest<PointsDisputeTicket>("/employees/disputes", {
        method: "POST",
        token,
        body: { pointHistoryId, reason }
      });
      toast.success("Dispute ticket raised successfully");
      
      // Update local disputesMap immediately
      setDisputesMap(prev => ({
        ...prev,
        [pointHistoryId]: res.data
      }));
      setShowDisputeFormId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to raise dispute");
    } finally {
      setSubmittingDisputeId(null);
    }
  }

  async function fetchAllDisputes() {
    try {
      setIsLoadingDisputes(true);
      const res = await apiRequest<PointsDisputeTicket[]>("/employees/disputes", { token });
      setAllDisputes(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load disputes queue");
    } finally {
      setIsLoadingDisputes(false);
    }
  }

  async function handleResolveDispute(ticketId: number, status: "APPROVED" | "REJECTED") {
    const hrRemarks = hrRemarksInput[ticketId]?.trim();
    if (status === "REJECTED" && !hrRemarks) {
      toast.error("Remarks are required when rejecting a dispute");
      return;
    }

    try {
      setResolvingDisputeId(ticketId);
      const res = await apiRequest<PointsDisputeTicket>(`/employees/disputes/${ticketId}/resolve`, {
        method: "POST",
        token,
        body: { status, hrRemarks }
      });
      toast.success(`Dispute successfully ${status === "APPROVED" ? "approved" : "rejected"}`);
      
      // Update in the list
      setAllDisputes(prev => prev.map(d => d.id === ticketId ? res.data : d));
      
      // If approved, update the employee's points on our rankings in pointsMap!
      if (status === "APPROVED" && res.data.pointHistory) {
        const empId = res.data.employeeId;
        const originalAmount = res.data.pointHistory.amount;
        const originalMode = res.data.pointHistory.mode;
        
        let pointDiff = 0;
        if (originalMode === "subtract") {
          pointDiff = originalAmount; // we added them back
        } else if (originalMode === "add") {
          pointDiff = -originalAmount; // we deducted them
        }
        
        setPointsMap(prev => {
          const currentPoints = prev[empId] ?? 0;
          return {
            ...prev,
            [empId]: currentPoints + pointDiff
          };
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve dispute");
    } finally {
      setResolvingDisputeId(null);
    }
  }

  useEffect(() => {
    if (activeTab === "DISPUTES") {
      fetchAllDisputes();
    }
  }, [activeTab, token]);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const prevMonthIndex = month - 2 < 0 ? 11 : month - 2;
  const maxHours = data?.workHoursRanking[0]?.totalHours ?? 1;
  const maxOnTime = data?.onTimeRanking[0]?.onTimeDays ?? 1;


  return (
    <div className="lb-page">
      {/* Header */}
      <header className="lb-page-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%' }}>
        <div className="stack" style={{ gap: "4px" }}>
          <span className="eyebrow eyebrow--purple">Team Activity</span>
          <h2 className="page-title">Leaderboard</h2>
        </div>

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

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="button button--secondary"
            onClick={() => navigate(role === "MANAGER" ? "/team" : "/")}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <ArrowLeft size={18} />
            {role === "MANAGER" ? "Back to Team" : "Back to Dashboard"}
          </button>
        </div>
      </header>

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
          {/* Employee of the Month Hero / Current Month Split Hero */}
          {isCurrentMonth ? (
            <div className="lb-hero-combined lb-eom-card">
              <div className="lb-eom-glow" />
              
              {/* Previous Winner (Smaller Nested Container in Top-Left) */}
              {prevWinnerEntry ? (
                <div className="lb-hero-nested-prev">
                  <span className="lb-nested-crown">🏆</span>
                  <div className="lb-nested-info">
                    <span className="lb-nested-label">
                      Prev Winner ({MONTH_NAMES[prevMonthIndex]})
                    </span>
                    <span className="lb-nested-name">
                      {prevWinnerEntry.employee.firstName} {prevWinnerEntry.employee.lastName}
                    </span>
                    <span className="lb-nested-meta">
                      {prevWinnerEntry.totalHours}h worked · {prevWinnerEntry.presentDays}d present
                    </span>
                  </div>
                </div>
              ) : (
                <div className="lb-hero-nested-prev lb-hero-nested-empty">
                  <span className="lb-nested-crown">🏆</span>
                  <div className="lb-nested-info">
                    <span className="lb-nested-label">Prev Winner</span>
                    <span className="lb-nested-name" style={{ opacity: 0.6 }}>No data</span>
                  </div>
                </div>
              )}

              {/* Current Progress Leader (Prominently Focused in Main Area) */}
              {data.employeeOfMonth ? (
                <div className="lb-hero-current-main lb-eom-content">
                  <div className="lb-eom-crown" style={{ animationDelay: "0.5s" }}>⚡</div>
                  <div className="lb-eom-label">Current Leader (In Progress)</div>
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
                </div>
              ) : (
                <div className="lb-hero-current-main lb-eom-content lb-hero-empty-state">
                  <div className="lb-eom-crown">⚡</div>
                  <div className="lb-eom-label">Current Leader (In Progress)</div>
                  <div className="lb-eom-name" style={{ fontSize: "20px", opacity: 0.7 }}>No Data Available</div>
                </div>
              )}
            </div>
          ) : (
            /* Standard single EOM card for past months */
            data.employeeOfMonth && (
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
            )
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
              On-Time Ranking
            </button>
            <button
              className={`lb-tab ${activeTab === "POINTS" ? "lb-tab--active" : ""}`}
              onClick={() => setActiveTab("POINTS")}
            >
              <Star size={16} />
              Points Ranking
            </button>
            {(role === "HR" || role === "ADMIN") && (
              <button
                className={`lb-tab ${activeTab === "DISPUTES" ? "lb-tab--active" : ""}`}
                onClick={() => setActiveTab("DISPUTES")}
              >
                <History size={16} />
                Disputes Queue
              </button>
            )}
          </div>

          {/* Work Hours Ranking */}
          {activeTab === "WORK_HOURS" && (
            <div className="lb-ranking-card">
              <div className="lb-ranking-header">
                <Medal size={18} />
                <h3>Work Hours Ranking</h3>
                <span className="lb-ranking-period">{MONTH_NAMES[month - 1]} {year}</span>
              </div>
              {(() => {
                const selfIndex = data.workHoursRanking.findIndex(e => e.employee.id === currentEmployeeId);
                if (selfIndex === -1) return null;
                const selfEntry = data.workHoursRanking[selfIndex];
                const total = data.workHoursRanking.length;
                const percentile = Math.round(((total - selfIndex) / total) * 100);
                let nextRankDiff = null;
                if (selfIndex > 0) {
                  const nextEntry = data.workHoursRanking[selfIndex - 1];
                  nextRankDiff = +(nextEntry.totalHours - selfEntry.totalHours).toFixed(1);
                }
                return (
                  <div className="lb-self-standing-summary">
                    <div className="lb-standing-main">
                      <span className="lb-standing-indicator">Your Standing</span>
                      <div className="lb-standing-details">
                        <span className="lb-standing-rank">
                          Rank <strong>#{selfEntry.rank}</strong> of {total}
                        </span>
                        <span className="lb-standing-tier">({percentile}% Tier)</span>
                      </div>
                    </div>
                    <div className="lb-standing-gamification">
                      <span className="lb-standing-score">{selfEntry.totalHours}h worked</span>
                      {nextRankDiff !== null && nextRankDiff > 0 && (
                        <span className="lb-standing-next-tip">
                          ⚡ {nextRankDiff}h behind Rank #{selfEntry.rank - 1}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="lb-ranking-list">
                {data.workHoursRanking.map((entry) => {
                  const isPrevWinner = isCurrentMonth && entry.employee.id === prevWorkHoursWinnerId;
                  const isCurrentLeader = isCurrentMonth && entry.rank === 1;
                  const isSelf = entry.employee.id === currentEmployeeId;
                  return (
                    <div
                      key={entry.employee.id}
                      className={`lb-row ${entry.rank <= 3 ? "lb-row--top" : ""} ${
                        isPrevWinner ? "lb-row--previous-winner" : ""
                      } ${isCurrentLeader ? "lb-row--current-leader-inprogress" : ""} ${
                        isSelf ? "lb-row--self" : ""
                      }`}
                    >
                      <div className="lb-row-rank">
                        <RankBadge rank={entry.rank} />
                      </div>
                      <LeaderboardAvatar employee={entry.employee} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {entry.employee.firstName} {entry.employee.lastName}
                          <span className="lb-row-code">#{entry.employee.employeeCode}</span>
                          <span className="lb-points-badge"><Star size={10} />{pointsMap[entry.employee.id] ?? 0} pts</span>
                          {isSelf && (
                            <span className="lb-badge lb-badge--self" title="This is you">
                              You
                            </span>
                          )}
                          {isPrevWinner && (
                            <span className="lb-badge lb-badge--previous-winner" title="Winner of the previous month">
                              🏆 Previous Winner
                            </span>
                          )}
                          {isCurrentLeader && (
                            <span className="lb-badge lb-badge--current-leader" title="Current Leader (In Progress)">
                              ⚡ Leader (In Progress)
                            </span>
                          )}
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
                        {role !== "EMPLOYEE" && (
                          <button
                            type="button"
                            className="lb-award-btn"
                            onClick={() => { setPointsModal(entry.employee); setPointsMode("add"); setPointsAmount(10); setPointsReason(""); }}
                          >
                            <Star size={13} />
                            Points
                          </button>
                        )}
                        <button
                          type="button"
                          className="lb-award-btn"
                          style={{ padding: "8px", minWidth: "auto", background: "rgba(100, 116, 139, 0.1)", color: "#64748b" }}
                          onClick={() => handleViewHistory(entry.employee)}
                          title="View History"
                        >
                          <History size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                <>
                  {(() => {
                    const selfIndex = data.onTimeRanking.findIndex(e => e.employee.id === currentEmployeeId);
                    if (selfIndex === -1) return null;
                    const selfEntry = data.onTimeRanking[selfIndex];
                    const total = data.onTimeRanking.length;
                    const percentile = Math.round(((total - selfIndex) / total) * 100);
                    let nextRankDiff = null;
                    if (selfIndex > 0) {
                      const nextEntry = data.onTimeRanking[selfIndex - 1];
                      nextRankDiff = nextEntry.onTimeDays - selfEntry.onTimeDays;
                    }
                    return (
                      <div className="lb-self-standing-summary">
                        <div className="lb-standing-main">
                          <span className="lb-standing-indicator">Your Standing</span>
                          <div className="lb-standing-details">
                            <span className="lb-standing-rank">
                              Rank <strong>#{selfEntry.rank}</strong> of {total}
                            </span>
                            <span className="lb-standing-tier">({percentile}% Tier)</span>
                          </div>
                        </div>
                        <div className="lb-standing-gamification">
                          <span className="lb-standing-score">{selfEntry.onTimeRate}% rate ({selfEntry.onTimeDays} days)</span>
                          {nextRankDiff !== null && nextRankDiff > 0 && (
                            <span className="lb-standing-next-tip">
                              ⚡ {nextRankDiff} check-in{nextRankDiff > 1 ? "s" : ""} behind Rank #{selfEntry.rank - 1}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="lb-ranking-list">
                  {data.onTimeRanking.map((entry) => {
                    const isPrevWinner = isCurrentMonth && entry.employee.id === prevOnTimeWinnerId;
                    const isCurrentLeader = isCurrentMonth && entry.rank === 1;
                    const isSelf = entry.employee.id === currentEmployeeId;
                    return (
                      <div
                        key={entry.employee.id}
                        className={`lb-row ${entry.rank <= 3 ? "lb-row--top" : ""} ${
                          isPrevWinner ? "lb-row--previous-winner" : ""
                        } ${isCurrentLeader ? "lb-row--current-leader-inprogress" : ""} ${
                          isSelf ? "lb-row--self" : ""
                        }`}
                      >
                        <div className="lb-row-rank">
                          <RankBadge rank={entry.rank} />
                        </div>
                        <LeaderboardAvatar employee={entry.employee} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">
                            {entry.employee.firstName} {entry.employee.lastName}
                            <span className="lb-row-code">#{entry.employee.employeeCode}</span>
                            <span className="lb-points-badge"><Star size={10} />{pointsMap[entry.employee.id] ?? 0} pts</span>
                            {isSelf && (
                              <span className="lb-badge lb-badge--self" title="This is you">
                                You
                              </span>
                            )}
                            {isPrevWinner && (
                              <span className="lb-badge lb-badge--previous-winner" title="Winner of the previous month">
                                🏆 Previous Winner
                              </span>
                            )}
                            {isCurrentLeader && (
                              <span className="lb-badge lb-badge--current-leader" title="Current Leader (In Progress)">
                                ⚡ Leader (In Progress)
                              </span>
                            )}
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
                          {role !== "EMPLOYEE" && (
                            <button
                              type="button"
                              className="lb-award-btn"
                              onClick={() => { setPointsModal(entry.employee); setPointsMode("add"); setPointsAmount(10); setPointsReason(""); }}
                            >
                              <Star size={13} />
                              Points
                            </button>
                          )}
                          <button
                            type="button"
                            className="lb-award-btn"
                            style={{ padding: "8px", minWidth: "auto", background: "rgba(100, 116, 139, 0.1)", color: "#64748b" }}
                            onClick={() => handleViewHistory(entry.employee)}
                            title="View History"
                          >
                            <History size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>
          )}

          {/* Points Ranking */}
          {activeTab === "POINTS" && (
            <div className="lb-ranking-card">
              <div className="lb-ranking-header">
                <Star size={18} />
                <h3>Points Ranking</h3>
                <span className="lb-ranking-period">All Time</span>
              </div>
              {data.pointsRanking.length === 0 ? (
                <div className="lb-empty" style={{ padding: "40px" }}>
                  <p>No points data available.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const selfIndex = data.pointsRanking.findIndex(e => e.employee.id === currentEmployeeId);
                    if (selfIndex === -1) return null;
                    const selfEntry = data.pointsRanking[selfIndex];
                    const total = data.pointsRanking.length;
                    const percentile = Math.round(((total - selfIndex) / total) * 100);
                    
                    const selfPoints = pointsMap[selfEntry.employee.id] ?? selfEntry.points;
                    let nextRankDiff = null;
                    if (selfIndex > 0) {
                      const nextEntry = data.pointsRanking[selfIndex - 1];
                      const nextPoints = pointsMap[nextEntry.employee.id] ?? nextEntry.points;
                      nextRankDiff = nextPoints - selfPoints;
                    }
                    return (
                      <div className="lb-self-standing-summary">
                        <div className="lb-standing-main">
                          <span className="lb-standing-indicator">Your Standing</span>
                          <div className="lb-standing-details">
                            <span className="lb-standing-rank">
                              Rank <strong>#{selfEntry.rank}</strong> of {total}
                            </span>
                            <span className="lb-standing-tier">({percentile}% Tier)</span>
                          </div>
                        </div>
                        <div className="lb-standing-gamification">
                          <span className="lb-standing-score">{selfPoints} pts</span>
                          {nextRankDiff !== null && nextRankDiff > 0 && (
                            <span className="lb-standing-next-tip">
                              ⚡ {nextRankDiff} pt{nextRankDiff > 1 ? "s" : ""} behind Rank #{selfEntry.rank - 1}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="lb-ranking-list">
                  {data.pointsRanking.map((entry) => {
                    const isCurrentLeader = entry.rank === 1;
                    const maxPoints = data.pointsRanking[0]?.points ?? 1;
                    const isSelf = entry.employee.id === currentEmployeeId;
                    return (
                      <div
                        key={entry.employee.id}
                        className={`lb-row ${entry.rank <= 3 ? "lb-row--top" : ""} ${
                          isCurrentLeader ? "lb-row--current-leader-inprogress" : ""
                        } ${isSelf ? "lb-row--self" : ""}`}
                      >
                        <div className="lb-row-rank">
                          <RankBadge rank={entry.rank} />
                        </div>
                        <LeaderboardAvatar employee={entry.employee} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">
                            {entry.employee.firstName} {entry.employee.lastName}
                            <span className="lb-row-code">#{entry.employee.employeeCode}</span>
                            <span className="lb-points-badge"><Star size={10} />{pointsMap[entry.employee.id] ?? entry.points} pts</span>
                            {isSelf && (
                              <span className="lb-badge lb-badge--self" title="This is you">
                                You
                              </span>
                            )}
                            {isCurrentLeader && (
                              <span className="lb-badge lb-badge--current-leader" title="Current Points Leader">
                                👑 All-Time Leader
                              </span>
                            )}
                          </div>
                          <div className="lb-row-meta">
                            {entry.employee.jobTitle ?? "Employee"} · {entry.employee.department?.name ?? "—"}
                          </div>
                          <ProgressBar value={pointsMap[entry.employee.id] ?? entry.points} max={maxPoints} color="linear-gradient(90deg, #eab308, #fef08a)" />
                        </div>
                        <div className="lb-row-right">
                          <div className="lb-row-stat">
                            <div className="lb-row-stat-primary" style={{ color: "#ca8a04" }}>{pointsMap[entry.employee.id] ?? entry.points} pts</div>
                          </div>
                          {role !== "EMPLOYEE" && (
                            <button
                              type="button"
                              className="lb-award-btn"
                              onClick={() => { setPointsModal(entry.employee); setPointsMode("add"); setPointsAmount(10); setPointsReason(""); }}
                            >
                              <Star size={13} />
                              Points
                            </button>
                          )}
                          <button
                            type="button"
                            className="lb-award-btn"
                            style={{ padding: "8px", minWidth: "auto", background: "rgba(100, 116, 139, 0.1)", color: "#64748b" }}
                            onClick={() => handleViewHistory(entry.employee)}
                            title="View History"
                          >
                            <History size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>
          )}
          
          {/* Disputes Queue */}
          {activeTab === "DISPUTES" && (
            <div className="lb-ranking-card">
              <div className="lb-ranking-header">
                <History size={18} />
                <h3>Points Dispute Queue</h3>
                <span className="lb-ranking-period">Manage ticket disputes</span>
              </div>
              {isLoadingDisputes ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading disputes...</div>
              ) : allDisputes.length === 0 ? (
                <div className="lb-empty" style={{ padding: "40px" }}>
                  <p>No dispute tickets found.</p>
                </div>
              ) : (
                <div className="lb-disputes-queue" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {allDisputes.map(dispute => {
                    const original = dispute.pointHistory;
                    const isPending = dispute.status === "PENDING";
                    const isApproved = dispute.status === "APPROVED";
                    const isRejected = dispute.status === "REJECTED";
                    
                    return (
                      <div key={dispute.id} className="lb-dispute-card">
                        <div className="lb-dispute-header">
                          <div className="lb-dispute-emp-info">
                            <div className="lb-dispute-emp-avatar">
                              {dispute.employee?.firstName?.[0] || "U"}{dispute.employee?.lastName?.[0] || "P"}
                            </div>
                            <div>
                              <div className="lb-dispute-emp-name">
                                {dispute.employee?.firstName} {dispute.employee?.lastName}
                              </div>
                              <div className="lb-dispute-emp-code">
                                Code: #{dispute.employee?.employeeCode}
                              </div>
                            </div>
                          </div>
                          
                          <span className={`lb-dispute-badge lb-dispute-badge--${dispute.status.toLowerCase()}`}>
                            {isPending && "Pending Review"}
                            {isApproved && "Dispute Approved"}
                            {isRejected && "Dispute Rejected"}
                          </span>
                        </div>
                        
                        <div className="lb-dispute-details">
                          <div className="lb-dispute-history-ref">
                            <span>
                              Disputed points: <strong>{original?.mode === "subtract" ? "-" : "+"}{original?.amount} pts</strong>
                            </span>
                            <span>
                              Original date: {original ? new Date(original.createdAt).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            <strong>Original Reason:</strong> {original?.reason}
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className="lb-dispute-reason-label">Employee Dispute Reason:</span>
                          <div className="lb-dispute-reason-text">
                            {dispute.reason}
                          </div>
                        </div>
                        
                        {isPending ? (
                          <div className="lb-dispute-actions">
                            <textarea
                              className="lb-dispute-remarks-textarea"
                              placeholder="Add HR remarks or reason for decision here (Required for Rejections)"
                              value={hrRemarksInput[dispute.id] || ""}
                              onChange={e => setHrRemarksInput(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                              rows={2}
                              disabled={resolvingDisputeId === dispute.id}
                            />
                            
                            <div className="lb-dispute-buttons">
                              <button
                                className="button button--secondary"
                                onClick={() => handleResolveDispute(dispute.id, "REJECTED")}
                                style={{ background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}
                                disabled={resolvingDisputeId !== null}
                              >
                                {resolvingDisputeId === dispute.id ? "Processing..." : "Reject Dispute"}
                              </button>
                              <button
                                className="button button--primary"
                                onClick={() => handleResolveDispute(dispute.id, "APPROVED")}
                                style={{ background: "#ecfdf5", color: "#059669", borderColor: "#a7f3d0" }}
                                disabled={resolvingDisputeId !== null}
                              >
                                {resolvingDisputeId === dispute.id ? "Processing..." : "Approve (Reverse Points)"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="lb-dispute-resolved-info">
                            <div>
                              <strong>Status:</strong> {isApproved ? "Approved & Points Reversed" : "Rejected"}
                            </div>
                            {dispute.hrRemarks && (
                              <div>
                                <strong>Remarks:</strong> {dispute.hrRemarks}
                              </div>
                            )}
                            {dispute.resolvedBy && (
                              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                                Resolved by {dispute.resolvedBy.firstName} {dispute.resolvedBy.lastName} on {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleDateString() : ""}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
        onClose={() => { setPointsModal(null); setPointsAmount(10); setPointsReason(""); }}
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
          <div className="lb-custom-points" style={{ marginBottom: "16px" }}>
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

          <div className="lb-custom-points">
            <label className="lb-custom-label">Reason</label>
            <textarea
              value={pointsReason}
              onChange={e => setPointsReason(e.target.value)}
              className="lb-custom-input"
              rows={2}
              placeholder="Why are you awarding/deducting points?"
              style={{ width: "100%", resize: "none", fontSize: "14px" }}
            />
          </div>

          <div className="lb-points-preview">
            {pointsMode === "add" ? "+" : "-"}{pointsAmount} pts →{" "}
            <strong>
              {pointsMode === "add"
                ? (pointsMap[pointsModal?.id ?? -1] ?? 0) + pointsAmount
                : (pointsMap[pointsModal?.id ?? -1] ?? 0) - pointsAmount
              } pts
            </strong> total
          </div>

          <div className="lb-points-actions">
            <button
              className="button button--secondary"
              onClick={() => { setPointsModal(null); setPointsAmount(10); setPointsReason(""); }}
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

      {/* History Modal */}
      <Modal
        open={historyModal !== null}
        title={`Points History — ${historyModal?.firstName} ${historyModal?.lastName}`}
        onClose={() => setHistoryModal(null)}
      >
        <div className="lb-history-modal" style={{ padding: "12px 0" }}>
          {isLoadingHistory ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading history...</div>
          ) : pointsHistory.length === 0 ? (
            <div style={{ 
              padding: "40px 20px", 
              textAlign: "center", 
              color: "#64748b",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}>
              <Trophy size={40} style={{ opacity: 0.35 }} />
              <span style={{ fontSize: "12px", fontWeight: "500" }}>No points history found.</span>
            </div>
          ) : (
            <div className="lb-history-list" style={{ maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              {pointsHistory.map(entry => (
                <div key={entry.id} className="lb-history-item" style={{ padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                    <strong style={{ fontSize: "12px", color: entry.mode === "add" ? "#059669" : entry.mode === "subtract" ? "#dc2626" : "#4f46e5", display: "flex", alignItems: "center", gap: "6px" }}>
                      {entry.mode === "add" ? <Plus size={14} /> : entry.mode === "subtract" ? <Minus size={14} /> : <Star size={14} />}
                      {entry.amount} pts
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#334155", marginBottom: "8px", lineHeight: "1.5" }}>{entry.reason}</div>
                  {entry.givenBy && (
                    <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "10px", fontWeight: "bold" }}>
                        {entry.givenBy.firstName[0]}{entry.givenBy.lastName[0]}
                      </span>
                      Given by {entry.givenBy.firstName} {entry.givenBy.lastName}
                    </div>
                  )}

                  {/* Dispute Section */}
                  {(() => {
                    const dispute = disputesMap[entry.id];
                    if (dispute) {
                      const isPending = dispute.status === "PENDING";
                      const isApproved = dispute.status === "APPROVED";
                      const isRejected = dispute.status === "REJECTED";
                      
                      return (
                        <div style={{ marginTop: "12px", borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "#64748b" }}>Points Dispute</span>
                            <span className={`lb-dispute-badge lb-dispute-badge--${dispute.status.toLowerCase()}`}>
                              {isPending && "Pending Review"}
                              {isApproved && "Approved"}
                              {isRejected && "Rejected"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#475569" }}>
                            <strong>My Reason:</strong> {dispute.reason}
                          </div>
                          {dispute.hrRemarks && (
                            <div style={{ fontSize: "12px", color: "#0f172a", background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px", marginTop: "4px" }}>
                              <strong>HR Response:</strong> {dispute.hrRemarks}
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    // If no dispute exists, and this is the employee's own page, show dispute option
                    if (historyModal && historyModal.id === currentEmployeeId) {
                      const isShowForm = showDisputeFormId === entry.id;
                      
                      return (
                        <div style={{ marginTop: "12px", borderTop: "1px dashed #cbd5e1", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {!isShowForm ? (
                            <button
                              className="button button--secondary"
                              style={{ padding: "4px 8px", fontSize: "11px", height: "auto", alignSelf: "flex-end" }}
                              onClick={() => setShowDisputeFormId(entry.id)}
                            >
                              Dispute Transaction
                            </button>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <textarea
                                className="lb-dispute-remarks-textarea"
                                style={{ padding: "6px 8px", fontSize: "12px" }}
                                placeholder="State why you are disputing this points transaction..."
                                value={disputeReasonInput[entry.id] || ""}
                                onChange={e => setDisputeReasonInput(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                rows={2}
                                disabled={submittingDisputeId === entry.id}
                              />
                              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button
                                  className="button button--secondary"
                                  style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                                  onClick={() => setShowDisputeFormId(null)}
                                  disabled={submittingDisputeId === entry.id}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="button button--primary"
                                  style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                                  onClick={() => handleRaiseDispute(entry.id)}
                                  disabled={submittingDisputeId === entry.id}
                                >
                                  {submittingDisputeId === entry.id ? "Submitting..." : "Submit Dispute"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
