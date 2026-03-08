import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Phone, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Login = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleSendOtp = () => {
    if (phone.length >= 10) setOtpSent(true);
  };

  const handleVerifyOtp = () => {
    navigate("/dashboard");
  };

  const handleAdminLogin = () => {
    navigate("/dashboard");
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
            <h1 className="font-display text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <Tabs defaultValue="resident" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="resident" className="text-sm">Resident</TabsTrigger>
              <TabsTrigger value="admin" className="text-sm">Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="resident" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <Input
                    id="otp"
                    placeholder="6-digit OTP"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    OTP sent to {phone}
                  </p>
                </div>
              )}

              {!otpSent ? (
                <Button onClick={handleSendOtp} className="w-full gradient-primary text-primary-foreground">
                  Send OTP
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleVerifyOtp} className="w-full gradient-primary text-primary-foreground">
                  Verify & Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </TabsContent>

            <TabsContent value="admin" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@society.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={handleAdminLogin} className="w-full gradient-primary text-primary-foreground">
                Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground">
            New society?{" "}
            <button
              onClick={() => navigate("/onboarding")}
              className="text-primary font-medium hover:underline"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
