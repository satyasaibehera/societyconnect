import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface AppAccessDeniedProps {
  reason: string;
}

export function AppAccessDenied({ reason }: AppAccessDeniedProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Access Denied</h1>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => void handleSignOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </Card>
    </div>
  );
}
