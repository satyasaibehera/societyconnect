import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyAppAccess } from "@/services/appAccessService";
import { signOut } from "@/services/authService";
import { ensurePendingResidentForUser } from "@/services/residentRegistrationService";

/**
 * Handles Supabase email confirmation redirects.
 * After the session is established, ensures a pending resident application exists,
 * then sends the user to /dashboard where ProtectedRoute shows Awaiting Admin Approval.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Supabase may deliver tokens in the URL hash or as ?code= for PKCE.
        const href = window.location.href;
        if (href.includes("code=")) {
          const url = new URL(href);
          const code = url.searchParams.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let session = sessionData.session;
        if (!session) {
          // Give the client a moment to parse hash tokens (#access_token=...)
          await new Promise((r) => setTimeout(r, 400));
          const retry = await supabase.auth.getSession();
          session = retry.data.session;
        }

        if (!session?.user) {
          setMessage("Could not confirm your session. Please open the link again or sign in.");
          setTimeout(() => navigate("/login", { replace: true }), 2500);
          return;
        }

        const access = verifyAppAccess(session.user);
        if (!access.allowed) {
          await signOut();
          setMessage("This account is not authorized for this application.");
          setTimeout(() => navigate("/login", { replace: true }), 2500);
          return;
        }

        if (cancelled) return;

        const meta = session.user.user_metadata || {};
        const onboardingType = (meta.onboarding as { type?: string } | undefined)?.type;

        if (onboardingType === "society_admin") {
          setMessage("Email verified. Your society onboarding request is pending platform review…");
        } else {
          setMessage("Email verified. Setting up your registration…");
          const { error: ensureError } = await ensurePendingResidentForUser(session.user.id);
          if (ensureError) {
            console.warn("[AuthCallback] ensurePendingResident:", ensureError.message);
          }
        }

        if (!cancelled) {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("[AuthCallback]", err);
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : "Email confirmation failed");
          setTimeout(() => navigate("/login", { replace: true }), 2500);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
    </div>
  );
};

export default AuthCallback;
