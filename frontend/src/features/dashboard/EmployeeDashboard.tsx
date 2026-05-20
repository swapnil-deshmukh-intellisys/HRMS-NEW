import { useApp } from "../../context/AppContext";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";
import AnnouncementList from "./AnnouncementList";
import WorkdayTimeline from "./WorkdayTimeline";
import TodoWidget from "./TodoWidget";
import BirthdayCelebrations from "./BirthdayCelebrations";
import AssignedTasksWidget from "./AssignedTasksWidget";


export default function EmployeeDashboard({ token }: { token: string | null }) {
  const { summary } = useApp();

  const attendanceToday = summary?.attendanceToday ?? null;
  const currentEmployee = summary?.currentEmployee ?? null;

  return (
    <section className="stack">
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row">
            <ThoughtOfTheDay />
            <div className="dashboard-hero-header">
              <h3>
                Hi
                {currentEmployee?.firstName ? (
                  <>
                    , <span className="greeting-name">{currentEmployee.firstName}</span>
                  </>
                ) : null}
              </h3>
            </div>
          </div>
          <AnnouncementList token={token} />
          <DashboardHeroClocks />
        </div>
      </article>

      {/* Workday Progress Section */}
      <WorkdayTimeline checkInTime={attendanceToday?.checkInTime ?? null} token={token} />

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
