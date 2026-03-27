import "./LoginPage.css";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { apiRequest } from "../../services/api";

type LoginPageProps = {
  onLogin: (token: string) => void;
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
      const response = await apiRequest<{ token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      onLogin(response.data.token);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">HRMS Portal</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your HRMS workspace.</p>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <div className="password-input-wrap">
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} required />
              <button
                type="button"
                className="password-visibility-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </div>
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
