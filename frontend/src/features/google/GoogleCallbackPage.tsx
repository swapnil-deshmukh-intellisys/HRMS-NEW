import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import MessageCard from "../../components/common/MessageCard";
import { useApp } from "../../context/AppContext";

type GoogleCallbackPageProps = {
  token: string | null;
};

export default function GoogleCallbackPage({ token }: GoogleCallbackPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSummary } = useApp();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStatus("error");
      setError(`Google Error: ${errorParam}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setError("No authorization code received from Google.");
      return;
    }

    async function exchangeToken() {
      try {
        await apiRequest("/google/callback", {
          method: "POST",
          token,
          body: { code },
        });
        setStatus("success");
        
        // Refresh summary to reflect Google Link status across the app
        void refreshSummary();
        
        // Return to the original page or dashboard
        const returnUrl = localStorage.getItem("hrms_google_callback_return") || "/";
        localStorage.removeItem("hrms_google_callback_return");
        
        setTimeout(() => {
          navigate(returnUrl);
        }, 1500);
      } catch (err: any) {
        setStatus("error");
        setError(err.message || "Failed to link Google account");
      }
    }

    void exchangeToken();
  }, [searchParams, token, navigate]);

  if (status === "loading") {
    return <MessageCard title="Redirecting..." tone="info" message="Finalizing your Google Workspace connection..." />;
  }

  if (status === "error") {
    return (
      <div className="stack">
        <MessageCard title="Connection failed" tone="error" message={error} />
        <button className="secondary" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <MessageCard 
      title="Success!" 
      tone="info" 
      message="Your Google Workspace account has been linked. Redirecting you back..." 
    />
  );
}
