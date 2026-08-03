import { ShieldOff } from "lucide-react";
import { APP_CONFIG } from "@/config/appConfig";
import { Button } from "@/components/ui/button";
import { signOut } from "@/services/authService";

interface AppAccessDeniedProps {
  reason?: string;
}

export default function AppAccessDenied({ reason }: AppAccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground">
            {reason ||
              `Your account is not authorized to use ${APP_CONFIG.appName}. Please sign in with an account registered for this application.`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void signOut().then(() => {
              window.location.href = "/login";
            });
          }}
        >
          Return to sign in
        </Button>
      </div>
    </div>
  );
}
