import { useAuth } from "@/contexts/AuthContext";
import { Clock, LogOut, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-accent flex items-center justify-center">
          <Clock className="h-8 w-8 text-accent-foreground" />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          <MailCheck className="h-3.5 w-3.5 shrink-0" />
          Email verified
        </div>
        <h1 className="font-display text-xl font-bold">Awaiting Admin Approval</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your email is verified and your registration request is awaiting society admin review.
          You will get full access once an administrator approves your application.
        </p>
        <p className="text-xs text-muted-foreground">
          Please check back later or contact your society administrator for status updates.
        </p>
        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </Card>
    </div>
  );
};

export default PendingApproval;
