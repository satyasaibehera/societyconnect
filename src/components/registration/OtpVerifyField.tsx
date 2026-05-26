import { useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OtpVerifyFieldProps {
  kind: "email" | "phone";
  target: string;          // email address or "+<cc><number>"
  canSend: boolean;        // true once target is valid
  verified: boolean;
  onVerified: () => void;
  onReset?: () => void;    // call when user edits the underlying target
}

export function OtpVerifyField({ kind, target, canSend, verified, onVerified }: OtpVerifyFieldProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { kind, target },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSent(true);
      if (data?.dev_code) {
        toast({
          title: `Dev OTP for ${kind === "email" ? "email" : "phone"}`,
          description: `Code: ${data.dev_code} — (live delivery not configured; using dev mode)`,
        });
      } else {
        toast({ title: "Code sent", description: `Check your ${kind === "email" ? "inbox" : "phone"} for the 6-digit code.` });
      }
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { kind, target, code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onVerified();
      toast({ title: `${kind === "email" ? "Email" : "Phone"} verified` });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-md px-3 py-2">
        <CheckCircle2 className="h-4 w-4" /> Verified
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!sent ? (
        <Button type="button" variant="outline" size="sm" disabled={!canSend || sending} onClick={send} className="w-full">
          {sending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Send className="h-3 w-3 mr-2" />}
          Send verification code
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="flex-1"
          />
          <Button type="button" size="sm" disabled={code.length !== 6 || verifying} onClick={verify}>
            {verifying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
            Verify
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={sending} onClick={send}>
            Resend
          </Button>
        </div>
      )}
    </div>
  );
}