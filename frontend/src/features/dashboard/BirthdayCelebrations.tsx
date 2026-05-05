import "./BirthdayCelebrations.css";
import { Cake, Calendar, Gift, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

type BirthdayEmployee = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  jobTitle?: string;
  department?: { name: string };
};

export default function BirthdayCelebrations({ token }: { token: string | null }) {
  const [birthdays, setBirthdays] = useState<BirthdayEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBirthdays() {
      try {
        const res = await apiRequest<BirthdayEmployee[]>("/employees/birthdays/upcoming", { token });
        setBirthdays(res.data);
      } catch (err) {
        console.error("Failed to fetch birthdays", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBirthdays();
  }, [token]);

  if (loading) {
    return (
      <div className="card birthday-card skeleton-birthday">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--long" />
      </div>
    );
  }

  const today = new Date();
  const todaysBirthdays = birthdays.filter(emp => {
    const dob = new Date(emp.dateOfBirth);
    return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
  });

  const upcomingBirthdays = birthdays.filter(emp => {
    const dob = new Date(emp.dateOfBirth);
    return dob.getDate() !== today.getDate() || dob.getMonth() !== today.getMonth();
  });

  if (birthdays.length === 0) return null;

  return (
    <div className="card birthday-card">
      <div className="birthday-card__header">
        <div className="birthday-card__title-group">
          <PartyPopper className="birthday-icon-main" size={20} />
          <h3>Celebrations</h3>
        </div>
        <span className="birthday-count-badge">{birthdays.length}</span>
      </div>

      <div className="birthday-content">
        {todaysBirthdays.map(emp => (
          <div key={emp.id} className="birthday-item today">
            <div className="birthday-today-banner">
              <div className="birthday-avatar today-avatar">
                <Cake size={24} strokeWidth={2.5} />
              </div>
              <div className="birthday-info">
                <p className="birthday-label-today">HAPPENING TODAY</p>
                <h4 className="birthday-name">{emp.firstName} {emp.lastName}</h4>
                <p className="birthday-meta">{emp.jobTitle} • {emp.department?.name}</p>
              </div>
              <div className="birthday-wish">
                <Gift size={20} className="gift-icon" />
                <span>Happy Birthday!</span>
              </div>
            </div>
          </div>
        ))}

        {upcomingBirthdays.length > 0 && (
          <div className="upcoming-section">
            <p className="upcoming-title">Upcoming Birthdays</p>
            <div className="upcoming-list">
              {upcomingBirthdays.map(emp => {
                const dob = new Date(emp.dateOfBirth);
                const bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                if (bdayThisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                  bdayThisYear.setFullYear(bdayThisYear.getFullYear() + 1);
                }
                const diffDays = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={emp.id} className="birthday-item upcoming">
                    <div className="upcoming-date-box">
                      <span className="upcoming-month">{dob.toLocaleString('default', { month: 'short' })}</span>
                      <span className="upcoming-day">{dob.getDate()}</span>
                    </div>
                    <div className="birthday-info">
                      <h4 className="birthday-name-sm">{emp.firstName} {emp.lastName}</h4>
                      <p className="birthday-meta-sm">{diffDays === 1 ? 'Tomorrow' : `In ${diffDays} days`}</p>
                    </div>
                    <Calendar className="calendar-icon-sm" size={14} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
