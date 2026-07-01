import { useMemo } from "react";

/** General motivational thoughts shown to developers, QA, analysts, and tech staff */
const employeeThoughts = [
  "First, solve the problem. Then, write the code.",
  "Clean code always looks like it was written by someone who cares.",
  "Simplicity is the soul of efficiency.",
  "The best error message is the one that never shows up because the system works flawlessly.",
  "Growth begins at the end of your console log of errors.",
  "A clever person solves a problem. A wise person avoids it through solid design.",
  "Code is like humor. When you have to explain it, it's bad.",
  "Every bug you fix is a step toward building a more robust software craftsman.",
  "Productivity isn't about working more hours. It's about making each hour count.",
  "Continuous learning is the minimum requirement for success in our field.",
  "Great developers write code that humans can understand, not just machines.",
  "Design is not just what it looks like and feels like. Design is how it works.",
  "Testing is an investment in your peace of mind and the client's trust.",
  "Small refactors today prevent massive rewrites tomorrow.",
  "Stay curious, write clean code, and never stop building.",
  "Opportunity is missed by most people because it is dressed in overalls and looks like work.",
  "Hard work beats talent when talent doesn't work hard.",
  "Small progress is still progress.",
  "Believe you can and you're halfway there.",
  "Success is the sum of small efforts repeated day in and day out.",
];

/** CEO thoughts focusing on business growth, partner coordination, IT scaling, and entrepreneurship */
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
];

/** Managing Director (MD) thoughts focusing on strategy, execution, system design, and organizational alignment */
const mdThoughts = [
  "Good strategy is about making choices, trade-offs; it's about deliberately choosing to be different.",
  "Execution is everything. The best strategy is useless without action.",
  "Excellence is not a destination; it is a continuous journey that we build day by day.",
  "A company is only as strong as its operations and the systems that support them.",
  "Management is efficiency in climbing the ladder of success; leadership determines whether the ladder is leaning against the right wall.",
  "Customer satisfaction is worthless. Customer loyalty is priceless.",
  "Build a system that functions smoothly even in your absence. That is the true test of operational excellence.",
  "A business that makes nothing but money is a poor business.",
  "Quality means doing it right when no one is looking.",
  "Operations keeps the lights on, strategy decides where we shine them next.",
  "Growth is never by mere chance; it is the result of forces working together.",
  "Strategy is not the consequence of planning, but the starting point.",
  "Focus on details, align the processes, and the results will take care of themselves.",
  "Empower your managers to execute, and guide them with clear, long-term vision.",
  "Operational discipline is the bridge between goals and accomplishments.",
  "Scale requires standardization. Build robust systems to unlock corporate potential.",
];

/** HR thoughts focusing on company culture, mentoring, synergy, talent growth, and employee support */
const hrThoughts = [
  "Train people well enough so they can leave, treat them well enough so they don't want to.",
  "Human resources isn't a thing we do. It's the run that runs our business.",
  "Appreciation can make a day, even change a life. Your willingness to put it into words is all that is necessary.",
  "Culture is what people do when no one is looking.",
  "An employee's motivation is a direct reflection of their work environment.",
  "The art of mentoring is the art of assisting discovery.",
  "To build a great company, start by building a great place to work.",
  "Synergy is the highest activity of life — it creates new, untapped alternatives.",
  "Behind every successful project is a team of motivated, supported individuals.",
  "We don't build businesses. We build people, and then people build the business.",
  "A workplace built on empathy and growth compiles the most resilient teams.",
  "Listen with curiosity. Speak with honesty. Act with integrity.",
  "Our greatest asset is the potential of our people. Invest in it daily.",
  "A positive work culture is the fuel that keeps productivity burning.",
];

interface ThoughtOfTheDayProps {
  /** Optional job title to serve role-specific thoughts */
  jobTitle?: string | null;
  /** Optional role to serve role-specific thoughts */
  role?: string | null;
}

export default function ThoughtOfTheDay({ jobTitle, role }: ThoughtOfTheDayProps) {
  const thought = useMemo(() => {
    // Select the appropriate thought pool based on jobTitle or role
    let pool = employeeThoughts;
    
    const titleLower = (jobTitle || "").toLowerCase();
    const roleLower = (role || "").toLowerCase();

    if (titleLower.includes("ceo")) {
      pool = ceoThoughts;
    } else if (titleLower.includes("managing director") || titleLower === "md") {
      pool = mdThoughts;
    } else if (roleLower === "hr" || titleLower.includes("hr") || titleLower.includes("human resources")) {
      pool = hrThoughts;
    }

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
  }, [jobTitle, role]);

  return (
    <p className="thought-of-the-day">
      {thought}
    </p>
  );
}
