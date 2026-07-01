import { useMemo } from "react";

/** General motivational thoughts shown to all employees */
const thoughts = [
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "Quality is not an act, it is a habit.",
  "Your attitude determines your direction.",
  "Do something today that your future self will thank you for.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Focus on being productive instead of busy.",
  "The expert in anything was once a beginner.",
  "Your time is limited, so don't waste it living someone else's life.",
  "Opportunity is missed by most people because it is dressed in overalls and looks like work.",
  "Hard work beats talent when talent doesn't work hard.",
  "Don't wait for opportunity. Create it.",
  "The only person you should try to be better than is the person you were yesterday.",
  "Small progress is still progress.",
  "Stay positive, work hard, and make it happen.",
  "Good things come to those who work.",
  "Every accomplishment starts with the decision to try.",
  "Challenges are what make life interesting; overcoming them is what makes life meaningful.",
  "The secret of getting ahead is getting started.",
  "If you can dream it, you can do it.",
];

/**
 * CEO / founder / business-growth thoughts curated specifically
 * for Rutik Bhosle — entrepreneur, CEO and IT company builder.
 */
const ceoThoughts = [
  "Build the company you wish existed. Then make the world need it.",
  "Every great business started with someone who refused to accept the world as it is.",
  "Vision without execution is just a dream. You have both — now scale it.",
  "The best CEOs don't just manage people — they multiply them.",
  "Your IT company is your most ambitious product. Keep shipping.",
  "Leaders grow companies. Legends grow industries.",
  "A partnership built on trust compounds faster than any investment.",
  "Revenue follows value. Build obsessively for your clients, and the numbers will follow.",
  "The riskiest thing in business is not taking any risks at all.",
  "Small team, big mission — that is how empires begin.",
  "Every client you serve today is a reference for your next 10 clients.",
  "Innovation is not a department. It is a culture you build every day.",
  "The fastest way to grow your company is to grow the people inside it.",
  "Your competition is not the enemy — complacency is.",
  "Founders who stay close to the problem build products that dominate.",
  "Great CEOs know when to zoom in and when to zoom out. Master both.",
  "Build systems that outlive your hustle. That is how you scale.",
  "The IT industry rewards those who solve real problems, not those who chase trends.",
  "Partnerships are leverage. Choose partners who multiply your strengths.",
  "The gap between where you are and where you want to be is called consistent action.",
  "Think like a founder, act like an operator, inspire like a leader.",
  "You are not just running a company. You are building a legacy.",
  "Every line of code your team ships is a brick in the empire you are building.",
  "The best time to plant a tree was 10 years ago. The second best time is today — for your next product line.",
  "Speed is a feature. Velocity is a culture. You choose which company you build.",
];

interface ThoughtOfTheDayProps {
  /** Optional employeeId to serve role-specific thoughts */
  employeeId?: number | null;
}

/** Rutik Bhosle's employee ID (ADMIN / CEO) */
const RUTIK_EMPLOYEE_ID = 34;

export default function ThoughtOfTheDay({ employeeId }: ThoughtOfTheDayProps = {}) {
  const thought = useMemo(() => {
    const pool = employeeId === RUTIK_EMPLOYEE_ID ? ceoThoughts : thoughts;

    // Current date in YYYY-MM-DD format to ensure same thought for the whole day
    const now = new Date();
    const dateStr = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();

    // Simple hash function to turn date string into a stable daily index
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % pool.length;
    return pool[index];
  }, [employeeId]);

  return (
    <p className="thought-of-the-day">
      {thought}
    </p>
  );
}
