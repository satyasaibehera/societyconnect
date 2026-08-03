import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User, Loader2, CheckCircle2 } from "lucide-react";
import {
  PasswordVisibilityIcon,
  passwordInputTypeFromVisible,
} from "@/components/ui/password-visibility-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardSociety } from "@/services/societyOnboardingService";
import { AUTH_MESSAGES } from "@/lib/authErrors";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput, fullPhone } from "./PhoneInput";

interface SocietyAdminRegFormProps {
  onBack: () => void;
}

type SubmittedMode = "platform_admin" | "standard" | null;

export function SocietyAdminRegForm({ onBack }: SocietyAdminRegFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMode, setSubmittedMode] = useState<SubmittedMode>(null);
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    society_name: "",
    address: "",
    city: "",
    state: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const fullPhoneNumber = fullPhone(countryCode, phoneNumber);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const phoneValid = /^\+\d{1,4}\d{7,12}$/.test(fullPhoneNumber);
  const passwordInputType = passwordInputTypeFromVisible(showPassword);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.society_name) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!emailValid) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (!phoneValid) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await onboardSociety({
        society_name: form.society_name,
        address: form.address,
        city: form.city,
        state: form.state,
        isActive: false,
        provisionDatabase: true,
        admin: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: fullPhoneNumber,
        },
      });

      if (!result.success) {
        if (result.duplicateAccount) {
          toast({ description: AUTH_MESSAGES.duplicateRegistration });
          navigate("/login");
          return;
        }
        throw new Error(result.error || "Society registration failed");
      }

      if (result.mode === "platform_admin") {
        toast({
          title: "Platform Admin account initialized and approved!",
          description: "You can now log in directly using the password you just set.",
        });
        setSubmittedMode("platform_admin");
      } else {
        setSubmittedMode("standard");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    if (submittedMode === "platform_admin") {
      return (
        <div className="space-y-6 animate-fade-in text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold">Platform Admin Ready</h2>
          <p className="text-sm text-muted-foreground">
            Platform Admin account initialized and approved! You can now log in directly using the
            password you just set.
          </p>
          <Button onClick={onBack} variant="outline" className="w-full">
            Back to Sign In
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold">Society Onboarding Request Submitted!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We have sent a verification link to your email address. Please verify your email to
          complete the initial step. Once verified, your society onboarding request will be
          forwarded to the Platform Administration team for review and approval.
        </p>
        <Button onClick={onBack} variant="outline" className="w-full">
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold">Enroll New Society</h1>
          <p className="text-xs text-muted-foreground">Register as a Society Admin</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Account</p>
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Your full name"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="admin@society.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Phone Number *</Label>
          <PhoneInput
            countryCode={countryCode}
            number={phoneNumber}
            onCountryChange={setCountryCode}
            onNumberChange={setPhoneNumber}
          />
        </div>
        <div className="space-y-2">
          <Label>Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type={passwordInputType}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={passwordInputType === "password" ? "Show password" : "Hide password"}
            >
              <PasswordVisibilityIcon inputType={passwordInputType} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Society Details</p>
        <div className="space-y-2">
          <Label>Society Name *</Label>
          <Input
            placeholder="Green Valley Heights"
            value={form.society_name}
            onChange={(e) => update("society_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            placeholder="e.g. 123, Master Canteen"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input placeholder="e.g. Bhubaneswar" value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input placeholder="e.g. Odisha" value={form.state} onChange={(e) => update("state", e.target.value)} />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={
          submitting ||
          !form.full_name ||
          !form.email ||
          !emailValid ||
          !form.password ||
          !form.society_name ||
          !phoneValid
        }
        className="w-full gradient-primary text-primary-foreground"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
          </>
        ) : (
          "Submit Registration"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your request will be reviewed by the platform administrator before activation.
      </p>
    </div>
  );
}
