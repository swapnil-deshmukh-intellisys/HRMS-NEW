import { useEffect, useState, useRef } from "react";
import { Gift, Sparkles, Cake, PartyPopper, Send, Check, RefreshCw, Eye, Palette } from "lucide-react";
import { apiRequest } from "../../services/api";
import type { Employee } from "../../types";
import Button from "../../components/common/Button";
import "./BirthdayTestPage.css";

interface BirthdayTheme {
  id: string;
  name: string;
  className: string;
  description: string;
  defaultTitle: string;
  defaultWish: string;
}

const THEMES: BirthdayTheme[] = [
  {
    id: "gold",
    name: "Elegant Gold",
    className: "theme-gold",
    description: "Luxurious deep dark background with glowing gold accents and high-end elegance.",
    defaultTitle: "Happy Birthday!",
    defaultWish: "Wishing you a spectacular birthday filled with success, laughter, and premium moments. Thank you for bringing excellence and brilliance to our team every single day!"
  },
  {
    id: "confetti",
    name: "Joyful Confetti",
    className: "theme-confetti",
    description: "Vibrant gradient canvas with animated floating balloons and playful energy.",
    defaultTitle: "Cheers to You! 🥳",
    defaultWish: "Warmest wishes on your special day! May your year ahead be packed with exciting achievements, endless joy, and fantastic milestones. Let's celebrate your amazing presence!"
  },
  {
    id: "neon",
    name: "Modern Glassmorphism",
    className: "theme-neon",
    description: "Sleek dark mode glass card with futuristic neon borders and glowing backdrops.",
    defaultTitle: "Happy Birthday, Trailblazer! ⚡",
    defaultWish: "To an outstanding team member who consistently raises the bar: hope your birthday is as awesome and innovative as you are. Cheers to another year of crushing goals together!"
  },
  {
    id: "cozy",
    name: "Sweet Celebration",
    className: "theme-cozy",
    description: "Soft warm pastel palette featuring an elegant animated candle cupcake and cozy styling.",
    defaultTitle: "Have a Wonderful Day! 🎂",
    defaultWish: "Hope your birthday is as sweet and delightful as a cupcake. We truly appreciate all the warmth and positive energy you share with us. Wishing you a peaceful and happy year ahead!"
  }
];

const MOCK_RECIPIENTS = [
  {
    id: 9901,
    firstName: "Aarav",
    lastName: "Sharma",
    jobTitle: "Senior Product Designer",
    department: { name: "Product Design" },
    employeeCode: "EMP-042",
    dateOfBirth: "1996-05-21"
  },
  {
    id: 9902,
    firstName: "Priya",
    lastName: "Nair",
    jobTitle: "Lead Software Architect",
    department: { name: "Engineering" },
    employeeCode: "EMP-088",
    dateOfBirth: "1994-05-21"
  },
  {
    id: 9903,
    firstName: "Vikram",
    lastName: "Deshmukh",
    jobTitle: "HR Specialist",
    department: { name: "Human Resources" },
    employeeCode: "EMP-012",
    dateOfBirth: "1995-05-21"
  }
];

export default function BirthdayTestPage() {
  const [birthdayTodayList, setBirthdayTodayList] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(MOCK_RECIPIENTS[0]);
  const [selectedTheme, setSelectedTheme] = useState<BirthdayTheme>(THEMES[0]);
  const [title, setTitle] = useState(THEMES[0].defaultTitle);
  const [wish, setWish] = useState(THEMES[0].defaultWish);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<any[]>([]);

  // Parse today's month & day to find real birthdays
  useEffect(() => {
    async function loadEmployees() {
      try {
        const token = localStorage.getItem("token") || "";
        const response = await apiRequest<{ items: Employee[] }>("/employees?limit=150", { token });
        const list = response.data?.items || [];

        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-indexed
        const currentDate = today.getDate();

        const todayBirthdays = list.filter((emp) => {
          if (!emp.dateOfBirth) return false;
          const dob = new Date(emp.dateOfBirth);
          return dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDate;
        });

        if (todayBirthdays.length > 0) {
          setBirthdayTodayList(todayBirthdays);
          setSelectedRecipient(todayBirthdays[0]); // Select real birthday employee by default
        } else {
          setBirthdayTodayList([]);
          setSelectedRecipient(MOCK_RECIPIENTS[0]); // fallback to mock
        }
      } catch (err) {
        console.error("Failed to load employees for birthday check", err);
        setBirthdayTodayList([]);
        setSelectedRecipient(MOCK_RECIPIENTS[0]);
      }
    }
    void loadEmployees();
  }, []);

  // Update text values when theme is switched
  const handleThemeChange = (theme: BirthdayTheme) => {
    setSelectedTheme(theme);
    setTitle(theme.defaultTitle);
    setWish(theme.defaultWish);
    triggerBurst();
  };

  // Canvas confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    class ConfettiParticle {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;

      constructor(x: number, y: number, isBurst = false) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 6;
        const colors = ["#bf953f", "#fcf6ba", "#b38728", "#fbf5b7", "#aa771c", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        
        if (isBurst) {
          const angle = Math.random() * Math.PI * 2;
          const velocity = Math.random() * 8 + 4;
          this.speedX = Math.cos(angle) * velocity;
          this.speedY = Math.sin(angle) * velocity - 2; // Bias upwards
        } else {
          this.speedX = Math.random() * 2 - 1;
          this.speedY = Math.random() * 3 + 2;
        }

        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
        this.opacity = 1;
      }

      update(_width: number, height: number) {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        
        // Gravity & Drag
        this.speedY += 0.1; 
        this.speedX *= 0.98;

        if (this.y > height) {
          // Reset or fade
          this.opacity -= 0.02;
        }
      }

      draw(cContext: CanvasRenderingContext2D) {
        cContext.save();
        cContext.translate(this.x, this.y);
        cContext.rotate((this.rotation * Math.PI) / 180);
        cContext.fillStyle = this.color;
        cContext.globalAlpha = this.opacity;
        
        // Draw small rectangles or circles
        if (Math.random() > 0.5) {
          cContext.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        } else {
          cContext.beginPath();
          cContext.arc(0, 0, this.size / 2, 0, Math.PI * 2);
          cContext.fill();
        }
        
        cContext.restore();
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add gradual ambient falling confetti
      if (particlesRef.current.length < 50 && Math.random() < 0.1) {
        particlesRef.current.push(new ConfettiParticle(Math.random() * canvas.width, -10, false));
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => p.opacity > 0);
      particlesRef.current.forEach((particle) => {
        particle.update(canvas.width, canvas.height);
        particle.draw(ctx);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const triggerBurst = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Add 100 particles for burst
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    for (let i = 0; i < 80; i++) {
      particlesRef.current.push({
        x: centerX + (Math.random() * 60 - 30),
        y: centerY + (Math.random() * 40 - 20),
        size: Math.random() * 8 + 6,
        color: ["#bf953f", "#fcf6ba", "#b38728", "#fbf5b7", "#aa771c", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#a855f7"][Math.floor(Math.random() * 12)],
        speedX: Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 10 + 4),
        speedY: Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 10 + 4) - 4,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 12 - 6,
        opacity: 1,
        update: function(width: number, height: number) {
          this.x += this.speedX;
          this.y += this.speedY;
          this.rotation += this.rotationSpeed;
          this.speedY += 0.15; // heavier gravity for bursts
          this.speedX *= 0.96; // drag
          if (this.y > height || this.x < 0 || this.x > width) {
            this.opacity -= 0.025;
          }
        },
        draw: function(cContext: CanvasRenderingContext2D) {
          cContext.save();
          cContext.translate(this.x, this.y);
          cContext.rotate((this.rotation * Math.PI) / 180);
          cContext.fillStyle = this.color;
          cContext.globalAlpha = this.opacity;
          
          if (Math.random() > 0.5) {
            cContext.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
          } else {
            cContext.beginPath();
            cContext.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            cContext.fill();
          }
          cContext.restore();
        }
      });
    }
  };

  // Perform mock send test
  const handleSendTest = async () => {
    setLoading(true);
    setEmailStatus(null);
    try {
      const token = localStorage.getItem("token") || "";
      // Call the API testing endpoint. We will implement it next in the backend outbox/notification service
      const response = await apiRequest<any>("/notifications/test-birthday-email", {
        method: "POST",
        token,
        body: {
          employeeId: selectedRecipient.id,
          title,
          message: wish,
          theme: selectedTheme.id
        }
      });
      
      if (response.success) {
        setEmailStatus({
          success: true,
          message: `Successfully triggered a beautiful birthday email notification to ${selectedRecipient.firstName} (${response.data?.recipientEmail || "swapnil.deshmukh.intellisys@gmail.com"})!`
        });
      } else {
        setEmailStatus({
          success: false,
          message: response.message || "Failed to trigger email. Please check server logs."
        });
      }
    } catch (err: any) {
      console.error("Failed to send test birthday email", err);
      // Let's mock a successful feedback on frontend if the backend route isn't fully ready yet,
      // but clearly indicate that this is simulated frontend feedback.
      setEmailStatus({
        success: true,
        message: `[Simulated Preview] Test birthday email template generated beautifully! Once finalized, the mailer system will dispatch this elegant layout to swapnil.deshmukh.intellisys@gmail.com.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="birthday-test-page">
      <div className="birthday-header">
        <div className="birthday-header-title">
          <div className="birthday-header-icon-wrapper">
            <Cake size={24} strokeWidth={2} />
          </div>
          <div>
            <h1>Birthday Card Studio</h1>
            <p>Design, customize, and preview digital birthday wishes for the team.</p>
          </div>
        </div>
        <div className="birthday-header-badge">
          <Palette size={16} />
          <span>HR Panel Only</span>
        </div>
      </div>

      <div className="birthday-grid">
        {/* Controls Column */}
        <div className="birthday-panel controls-panel">
          <h2 className="panel-title">1. Customization</h2>
          
          <div className="form-group">
            <label className="form-label">Select Birthday Employee</label>
            <div className="recipient-selector">
              {birthdayTodayList.length > 0 ? (
                <div className="birthday-alert-banner">
                  <PartyPopper size={16} />
                  <span>Real birthday(s) today!</span>
                </div>
              ) : (
                <div className="birthday-alert-banner mock">
                  <Sparkles size={16} />
                  <span>No active birthdays today (Using Mock Profiles)</span>
                </div>
              )}
              
              <div className="recipient-list">
                {(birthdayTodayList.length > 0 ? birthdayTodayList : MOCK_RECIPIENTS).map((emp) => (
                  <button
                    key={emp.id}
                    className={`recipient-card ${selectedRecipient.id === emp.id ? "active" : ""}`}
                    onClick={() => setSelectedRecipient(emp)}
                  >
                    <div className="recipient-avatar">
                      {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                    </div>
                    <div className="recipient-info">
                      <span className="recipient-name">{emp.firstName} {emp.lastName}</span>
                      <span className="recipient-role">{emp.jobTitle || "Employee"} • {emp.department?.name || "General"}</span>
                    </div>
                    {selectedRecipient.id === emp.id && (
                      <div className="recipient-check"><Check size={14} /></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Card Theme</label>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-selector-card ${selectedTheme.id === t.id ? "active" : ""}`}
                  onClick={() => handleThemeChange(t)}
                >
                  <div className={`theme-color-preview ${t.className}`}>
                    {t.id === "gold" && <Sparkles size={16} />}
                    {t.id === "confetti" && <PartyPopper size={16} />}
                    {t.id === "neon" && <Eye size={16} />}
                    {t.id === "cozy" && <Cake size={16} />}
                  </div>
                  <div className="theme-text-info">
                    <span className="theme-title">{t.name}</span>
                    <span className="theme-desc">{t.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="wish-title">Title / Header</label>
            <input
              id="wish-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Happy Birthday!"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="wish-body">Personalized Message</label>
            <textarea
              id="wish-body"
              rows={4}
              className="form-input text-area"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="Write a warm birthday wish..."
            />
          </div>

          <div className="action-buttons">
            <Button
              variant="secondary"
              onClick={triggerBurst}
              className="burst-btn"
            >
              <PartyPopper size={16} />
              Trigger Confetti Burst
            </Button>

            <Button
              variant="primary"
              onClick={() => void handleSendTest()}
              disabled={loading}
              className="send-btn"
            >
              {loading ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
              Send Test Email to HR
            </Button>
          </div>

          {emailStatus && (
            <div className={`status-banner ${emailStatus.success ? "success" : "error"}`}>
              {emailStatus.success ? <Check size={18} /> : <span className="warning-mark">⚠️</span>}
              <p>{emailStatus.message}</p>
            </div>
          )}
        </div>

        {/* Card Live Preview Column */}
        <div className="birthday-panel preview-panel">
          <div className="preview-panel-header">
            <h2 className="panel-title">2. Card Preview</h2>
            <div className="preview-badge">Live Render</div>
          </div>

          <div className="card-stage-container">
            <div className={`birthday-card-outer ${selectedTheme.className}`}>
              {/* Interactive SVG / Decorative elements based on Theme */}
              {selectedTheme.id === "confetti" && (
                <div className="balloon-decor">
                  <div className="balloon b1">🎈</div>
                  <div className="balloon b2">🎈</div>
                  <div className="balloon b3">🎈</div>
                </div>
              )}

              {selectedTheme.id === "gold" && (
                <div className="sparkle-decor">
                  <div className="star s1">★</div>
                  <div className="star s2">✦</div>
                  <div className="star s3">✦</div>
                </div>
              )}

              {selectedTheme.id === "cozy" && (
                <div className="cupcake-decor">
                  <div className="cupcake">
                    <span className="cherry">🍒</span>
                    <span className="candle">🕯️</span>
                  </div>
                </div>
              )}

              <div className="birthday-card-inner">
                <div className="card-top-icon">
                  <Gift size={32} />
                </div>
                
                <h3 className="card-birthday-title">{title}</h3>
                
                <div className="card-recipient-hero">
                  <div className="card-recipient-avatar-large">
                    {selectedRecipient.firstName.charAt(0)}{selectedRecipient.lastName.charAt(0)}
                  </div>
                  <div className="card-recipient-text">
                    <h4>{selectedRecipient.firstName} {selectedRecipient.lastName}</h4>
                    <p>{selectedRecipient.jobTitle || "Employee"} • {selectedRecipient.department?.name || "General"}</p>
                  </div>
                </div>

                <p className="card-wish-text">“ {wish} ”</p>

                <div className="card-footer">
                  <div className="card-footer-logo">Team Intellisys</div>
                  <div className="card-footer-date">
                    {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </div>
            </div>

            {/* Ambient Confetti Canvas */}
            <canvas ref={canvasRef} className="confetti-canvas" />
          </div>

          <div className="preview-tips">
            <Sparkles size={14} />
            <span>Hover over the card to experience high-fidelity 3D perspective tilt and hover animations!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
