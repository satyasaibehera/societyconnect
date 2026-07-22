import { useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendOtp, verifyOtp } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";

/** Local mock phone OTP — Twilio is not configured on this Supabase instance. */
const MOCK_PHONE_OTP = "9999";

interface OtpVerifyFieldProps {
  kind: "email" | "phone";
  target: string; // email address or "+<cc><number>"
  canSend: boolean; // true once target is valid
  verified: boolean;
  onVerified: () => void;
  onReset?: () => void; // call when user edits the underlying target
}

export function OtpVerifyField({ kind, target, canSend, verified, onVerified }: OtpVerifyFieldProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [mockPhoneCode, setMockPhoneCode] = useState<string | null>(null);

  const expectedLength = kind === "phone" ? MOCK_PHONE_OTP.length : 6;

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      // Phone OTP: mock locally — do not call Supabase/Twilio or the router.
      if (kind === "phone") {
        setMockPhoneCode(MOCK_PHONE_OTP);
        setCode("");
        setSent(true);
        toast({
          title: "[DEV MODE] Verification code is 9999",
          description: "Twilio is not configured. Use this mock code to continue.",
        });
        return;
      }

      const { data, error } = await sendOtp(target, { kind: "email" });
      if (error) throw error;

      setSent(true);
      const devCode =
        data && typeof data === "object" && "dev_code" in data
          ? (data as { dev_code?: string }).dev_code
          : undefined;

      if (devCode) {
        toast({
          title: "Dev OTP for email",
          description: `Code: ${devCode} — (live delivery not configured; using dev mode)`,
        });
      } else {
        toast({
          title: "Code sent",
          description: "Check your inbox for the 6-digit code.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send code";
      toast({ title: "Failed to send code", description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== expectedLength || verifying) return;
    setVerifying(true);
    try {
      if (kind === "phone") {
        if (code !== (mockPhoneCode || MOCK_PHONE_OTP)) {
          throw new Error("Invalid verification code");
        }
        onVerified();
        toast({ title: "Phone verified" });
        return;
      }

      const { error } = await verifyOtp(target, code, { kind: "email" });
      if (error) throw error;
      onVerified();
      toast({ title: "Email verified" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      toast({ title: "Verification failed", description: message, variant: "destructive" });
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
            maxLength={expectedLength}
            placeholder={kind === "phone" ? "4-digit code" : "6-digit code"}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, expectedLength))}
            className="flex-1"
          />
          <Button type="button" size="sm" disabled={code.length !== expectedLength || verifying} onClick={verify}>
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
