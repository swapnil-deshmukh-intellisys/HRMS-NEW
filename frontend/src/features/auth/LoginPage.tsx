import "./LoginPage.css";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { apiRequest } from "../../services/api";
import type { AuthLoginResponse, SessionUser } from "../../types";

type LoginPageProps = {
  onLogin: (token: string, user?: SessionUser | null) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<AuthLoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      onLogin(response.data.token, response.data.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-showcase" aria-hidden="true">
        <div className="login-showcase__backdrop" />
        <div className="login-showcase__content">
          <div className="login-showcase__header">
            <p className="eyebrow">Intellisys HRMS</p>
            <h1>HRMS workspace</h1>
          </div>
          <img
            className="login-showcase__illustration"
            src="/assets/images/communication-flat-icon.png"
            alt=""
          />
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__header">
            <p className="eyebrow">HRMS Portal</p>
            <h2>Welcome back</h2>
            <p className="muted">Use your work credentials to continue.</p>
          </div>

          <form className="stack login-form" onSubmit={handleSubmit}>
            <label>
              Work email
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" required />
            </label>
            <label className="password-label">
              Password
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-visibility-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="login-trust-row">
            <div>
              <span className="login-trust-row__label">Access</span>
              <strong>Role-based workspace</strong>
            </div>
            <div>
              <span className="login-trust-row__label">Users</span>
              <strong>HR, managers, employees</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
