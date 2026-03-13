import { useState } from "react";
import { Building2, ArrowLeft, Eye, EyeOff, Mail, Lock, User, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SocietyAdminRegFormProps {
  onBack: () => void;
}

export function SocietyAdminRegForm({ onBack }: SocietyAdminRegFormProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.society_name) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-account", {
        body: {
          type: "society_admin",
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          society_name: form.society_name,
          address: form.address,
          city: form.city,
          state: form.state,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6 animate-fade-in text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="font-display text-xl font-bold">Registration Submitted!</h2>
        <p className="text-sm text-muted-foreground">
          Your society enrollment request for <strong>{form.society_name}</strong> has been submitted for review. 
          You'll be able to sign in once a platform administrator approves your request.
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

      {/* Account Details */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Account</p>
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Your full name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="email" placeholder="admin@society.com" value={form.email} onChange={(e) => update("email", e.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"} placeholder="••••••••"
              value={form.password} onChange={(e) => update("password", e.target.value)}
              className="pl-10 pr-10"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Society Details */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Society Details</p>
        <div className="space-y-2">
          <Label>Society Name *</Label>
          <Input placeholder="Green Valley Heights" value={form.society_name} onChange={(e) => update("society_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input placeholder="123, MG Road" value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input placeholder="Bangalore" value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input placeholder="Karnataka" value={form.state} onChange={(e) => update("state", e.target.value)} />
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full gradient-primary text-primary-foreground">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit Registration"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your request will be reviewed by the platform administrator before activation.
      </p>
    </div>
  );
}
