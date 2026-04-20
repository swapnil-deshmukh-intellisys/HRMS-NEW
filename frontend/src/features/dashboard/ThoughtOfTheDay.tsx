import { useMemo } from "react";

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
  "If you can dream it, you can do it."
];

export default function ThoughtOfTheDay() {
  const thought = useMemo(() => {
    // Current date in YYYY-MM-DD format to ensure same thought for the whole day
    const now = new Date();
    const dateStr = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    
    // Simple hash function to turn date string into an index
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    
    const index = Math.abs(hash) % thoughts.length;
    return thoughts[index];
  }, []);

  return (
    <p className="thought-of-the-day">
      {thought}
    </p>
  );
}
