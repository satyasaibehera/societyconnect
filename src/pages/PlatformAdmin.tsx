import { Building2, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { APP_CONFIG } from "@/config/appConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PlatformAdmin = () => {
  const { signOut, tenantRole } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{APP_CONFIG.appName}</span>
        </div>
        <h1 className="font-display text-xl font-bold">Platform Administration</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You are signed in as a platform super administrator
          {tenantRole?.tenantDbName ? ` for tenant ${tenantRole.tenantDbName}` : ""}.
        </p>
        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </Card>
    </div>
  );
};

export default PlatformAdmin;
