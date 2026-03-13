import { Building2, Home, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RegistrationChoiceProps {
  onSelectSocietyAdmin: () => void;
  onSelectResident: () => void;
  onBack: () => void;
}

export function RegistrationChoice({ onSelectSocietyAdmin, onSelectResident, onBack }: RegistrationChoiceProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center lg:text-left">
        <h1 className="font-display text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground mt-1">How would you like to register?</p>
      </div>

      <div className="space-y-3">
        <Card
          className="p-5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          onClick={onSelectSocietyAdmin}
        >
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm">Enroll a New Society</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Register as a Society Admin to set up and manage a new housing society. Your request will be reviewed by the platform administrator.
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="p-5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          onClick={onSelectResident}
        >
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm">Register as a Resident</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Join an existing society as a flat owner or family member. Your request will be reviewed by the respective Society Admin.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button onClick={onBack} className="text-primary font-medium hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}
