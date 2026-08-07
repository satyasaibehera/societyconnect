import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Lock, ArrowRight, Eye, EyeOff, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signIn } from "@/services/authService";
import { AUTH_MESSAGES } from "@/lib/authErrors";
import { APP_CONFIG } from "@/config/appConfig";
import { useToast } from "@/hooks/use-toast";
import {
  LOGIN_BANNER_INVALID_CREDENTIALS,
  useAuth,
} from "@/contexts/AuthContext";
import { RegistrationChoice } from "@/components/registration/RegistrationChoice";
import { SocietyAdminRegForm } from "@/components/registration/SocietyAdminRegForm";
import { ResidentRegDialog } from "@/components/registration/ResidentRegDialog";

type View = "login" | "register_choice" | "register_society";

const Login = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const {
    loading,
    roleLoading,
    isAuthenticated,
    tenantRole,
    loginBannerError,
    clearLoginBannerError,
    setLoginBannerError,
    completeSignIn,
  } = useAuth();

  const [view, setView] = useState<View>("login");
  const [showResidentDialog, setShowResidentDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email")?.trim();
    if (emailParam) {
      setEmail(emailParam);
      setView("login");
    }
  }, [searchParams]);

  if (loading || (isAuthenticated && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && tenantRole) {
    return null;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    clearLoginBannerError();
    try {
      const { data, error } = await signIn({ email, password });
      if (error) throw error;

      if (data?.session?.access_token) {
        await completeSignIn(data.session);
      }
      // AuthRouteGuard handles navigation once tenantRole resolves.
    } catch (error: unknown) {
      setLoginBannerError(LOGIN_BANNER_INVALID_CREDENTIALS);
      const message = error instanceof Error ? error.message : AUTH_MESSAGES.signInFailed;
      toast({ title: "Sign in failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderRightPanel = () => {
    switch (view) {
      case "register_choice":
        return (
          <RegistrationChoice
            onSelectSocietyAdmin={() => setView("register_society")}
            onSelectResident={() => setShowResidentDialog(true)}
            onBack={() => setView("login")}
          />
        );
      case "register_society":
        return <SocietyAdminRegForm onBack={() => setView("register_choice")} />;
      default:
        return (
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="font-display text-2xl font-bold">Welcome back</h1>
              <p className="text-muted-foreground mt-1">Sign in to your account</p>
            </div>

            {loginBannerError && (
              <div
                role="alert"
                className="w-full bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-lg text-sm flex items-center gap-2.5 mb-4"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="leading-snug">{loginBannerError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleLogin} disabled={submitting} className="w-full gradient-primary text-primary-foreground">
                {submitting ? "Please wait..." : "Sign In"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <button
                onClick={async () => {
                  if (!email) {
                    toast({ title: "Enter your email first", variant: "destructive" });
                    return;
                  }
                  await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  toast({
                    title: "Check your email",
                    description: AUTH_MESSAGES.resetPasswordSent,
                  });
                }}
                className="text-sm text-primary font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Need an account?{" "}
              <button onClick={() => setView("register_choice")} className="text-primary font-medium hover:underline">
                Register here
              </button>
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,hsl(234_85%_70%/0.3),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold">{APP_CONFIG.appName}</span>
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight mb-4">
              Manage your society,<br />
              <span className="text-white/80">effortlessly.</span>
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              Resident management, visitor passes, digital IDs, voting, complaints — everything in one platform.
            </p>
          </div>
          <div className="flex gap-8 text-sm text-white/60">
            <div><div className="text-2xl font-bold text-white">500+</div>Societies</div>
            <div><div className="text-2xl font-bold text-white">50K+</div>Residents</div>
            <div><div className="text-2xl font-bold text-white">99.9%</div>Uptime</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-6">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">{APP_CONFIG.appName}</span>
          </div>
          {renderRightPanel()}
        </div>
      </div>

      <ResidentRegDialog open={showResidentDialog} onOpenChange={setShowResidentDialog} />
    </div>
  );
};

export default Login;
