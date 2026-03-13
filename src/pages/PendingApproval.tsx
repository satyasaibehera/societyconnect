import { useAuth } from "@/contexts/AuthContext";
import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="font-display text-xl font-bold">Registration Pending</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your registration is currently under review. You'll be able to access the platform once an administrator approves your request.
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
