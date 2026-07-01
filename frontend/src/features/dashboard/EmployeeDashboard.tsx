import { useApp } from "../../context/AppContext";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";
import AnnouncementList from "./AnnouncementList";
import WorkdayTimeline from "./WorkdayTimeline";
import TodoWidget from "./TodoWidget";
import BirthdayCelebrations from "./BirthdayCelebrations";
import AssignedTasksWidget from "./AssignedTasksWidget";
import { addMinutesToTime } from "../../utils/format";


export default function EmployeeDashboard({ token }: { token: string | null }) {
  const { summary } = useApp();

  const attendanceToday = summary?.attendanceToday ?? null;
  const currentEmployee = summary?.currentEmployee ?? null;

  return (
    <section className="stack">
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row management-top-row">
            <div className="dashboard-hero-header dashboard-hero-header--left">
              <div className="dashboard-hero-greeting-container">
                <span className="greeting-text">Hi,</span>
                <span className="greeting-name">
                  {currentEmployee?.firstName} {currentEmployee?.lastName}
                </span>
                {currentEmployee?.jobTitle && (
                  <span className="dashboard-hero-designation-badge">
                    {currentEmployee.jobTitle}
                  </span>
                )}
              </div>
              <div className="dashboard-hero-context-title">
                <span className="context-eyebrow">Personal Workspace</span>
                <span className="context-divider">|</span>
                <span className="context-title">Employee Dashboard</span>
              </div>
            </div>
            <ThoughtOfTheDay jobTitle={currentEmployee?.jobTitle} role="EMPLOYEE" />
          </div>
          <AnnouncementList token={token} />
          <DashboardHeroClocks />
        </div>
      </article>

      <WorkdayTimeline 
        employeeId={currentEmployee?.id}
        startTime={currentEmployee?.shift?.startTime}
        endTime={currentEmployee?.shift?.endTime}
        lateThreshold={currentEmployee?.shift ? addMinutesToTime(currentEmployee.shift.startTime, currentEmployee.shift.gracePeriodMinutes) : undefined}
        checkInTime={attendanceToday?.checkInTime ?? null} 
        checkOutTime={attendanceToday?.checkOutTime ?? null}
        workedMinutes={attendanceToday?.workedMinutes ?? null}
        penaltyMinutes={attendanceToday?.penaltyMinutes ?? null}
        token={token} 
      />

      {/* Primary Action Row: Tasks, Personal Todo, & Celebrations */}
      <div className="grid cols-3 dashboard-grid">
        {/* Today's Tasks Widget (Assigned by Managers) */}
        <AssignedTasksWidget token={token} />

        {/* Todo List - Taking up space for visibility */}
        <TodoWidget token={token} />

        {/* Birthday Celebrations */}
        <BirthdayCelebrations token={token} />
      </div>
    </section>
  );
}
