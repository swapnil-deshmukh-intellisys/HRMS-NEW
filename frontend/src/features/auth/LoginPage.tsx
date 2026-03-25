import "./LoginPage.css";
import { useState } from "react";
import type { FormEvent } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { apiRequest } from "../../services/api";

type LoginPageProps = {
  onLogin: (token: string) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("admin@hrms.local");
  const [password, setPassword] = useState("Admin@123");
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
        <p className="eyebrow">HRMS Lean V1</p>
        <h1>Commercial MVP Workspace</h1>
        <p className="muted">Sign in to manage employees, attendance, leave, and payroll.</p>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
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
