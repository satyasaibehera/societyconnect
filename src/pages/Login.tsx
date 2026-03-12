import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Phone, Lock, ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: adminEmail,
          password: adminPassword,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account, then sign in.",
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
            <span className="font-display text-xl font-bold">SocietyConnect</span>
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight mb-4">
              Manage your society,
              <br />
              <span className="text-white/80">effortlessly.</span>
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              Resident management, visitor passes, digital IDs, voting, complaints — everything in one platform.
            </p>
          </div>
          <div className="flex gap-8 text-sm text-white/60">
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              Societies
            </div>
            <div>
              <div className="text-2xl font-bold text-white">50K+</div>
              Residents
            </div>
            <div>
              <div className="text-2xl font-bold text-white">99.9%</div>
              Uptime
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">SocietyConnect</span>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="font-display text-2xl font-bold">
              {isSignUp ? "Create Account" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSignUp ? "Register your account" : "Sign in to your account"}
            </p>
          </div>

          <div className="space-y-4">
            {isSignUp && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="fullname">Full Name</Label>
                <Input
                  id="fullname"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@society.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="pl-10 pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              onClick={handleAdminLogin}
              disabled={submitting}
              className="w-full gradient-primary text-primary-foreground"
            >
              {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {!isSignUp && (
            <div className="text-center">
              <button
                onClick={async () => {
                  if (!adminEmail) {
                    toast({ title: "Enter your email first", variant: "destructive" });
                    return;
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                  else toast({ title: "Reset link sent", description: "Check your email for the password reset link." });
                }}
                className="text-sm text-primary font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button onClick={() => setIsSignUp(false)} className="text-primary font-medium hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need an account?{" "}
                <button onClick={() => setIsSignUp(true)} className="text-primary font-medium hover:underline">
                  Register here
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
