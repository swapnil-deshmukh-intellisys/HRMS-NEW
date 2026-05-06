import { useApp } from "../../context/AppContext";
import { Coffee } from "lucide-react";
import "./TeamOnLeaveWidget.css";

export default function TeamOnLeaveWidget() {
  const { summary } = useApp();
  const teamOnLeave = (summary as any)?.teamOnLeaveToday ?? [];

  return (
    <article className="card metric-card team-on-leave-widget">
      <div className="stack" style={{ gap: '4px' }}>
        <p className="eyebrow">Attendance</p>
        <h3>Who's Out Today</h3>
      </div>
      
      {!teamOnLeave.length ? (
        <div className="team-on-leave-empty">
          <Coffee size={24} />
          <p>Everyone is in today!</p>
        </div>
      ) : (
        <div className="team-on-leave-list">
          {teamOnLeave.map((request: any) => (
            <div key={request.id} className="team-on-leave-item">
              <span className="team-on-leave-name">
                {request.employee.firstName} {request.employee.lastName}
              </span>
              <span className="team-on-leave-type">{request.leaveType.name}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
