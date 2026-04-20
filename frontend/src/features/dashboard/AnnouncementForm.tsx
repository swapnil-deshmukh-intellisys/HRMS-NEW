import { useState } from "react";
import { Megaphone, Send, AlertTriangle, Info } from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Announcement.css";

type Priority = "NORMAL" | "HIGH" | "URGENT";

export default function AnnouncementForm({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setLoading(true);
    setError(null);
    try {
      await apiRequest("/announcements", {
        method: "POST",
        token,
        body: { title, content, priority }
      });
      setTitle("");
      setContent("");
      setPriority("NORMAL");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create announcement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card announcement-form-card">
      <div className="announcement-form-header">
        <div className="announcement-form-icon">
          <Megaphone size={20} />
        </div>
        <div>
          <h4>Broadcast Announcement</h4>
          <p className="muted">Send a message to all employees' dashboards</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="announcement-form">
        <div className="form-group">
          <input 
            type="text" 
            placeholder="Announcement Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <textarea 
            placeholder="What would you like to share?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={3}
          />
        </div>

        <div className="announcement-form-footer">
          <div className="priority-selector">
            <button 
              type="button" 
              className={`priority-btn normal ${priority === "NORMAL" ? "active" : ""}`}
              onClick={() => setPriority("NORMAL")}
            >
              <Info size={14} /> Normal
            </button>
            <button 
              type="button" 
              className={`priority-btn high ${priority === "HIGH" ? "active" : ""}`}
              onClick={() => setPriority("HIGH")}
            >
              High
            </button>
            <button 
              type="button" 
              className={`priority-btn urgent ${priority === "URGENT" ? "active" : ""}`}
              onClick={() => setPriority("URGENT")}
            >
              <AlertTriangle size={14} /> Urgent
            </button>
          </div>

          <button type="submit" disabled={loading || !title || !content} className="primary">
            {loading ? "Sending..." : (
              <>
                <Send size={16} /> Broadcast
              </>
            )}
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </form>
    </article>
  );
}
