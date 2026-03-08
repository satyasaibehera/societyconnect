import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <DashboardLayout title={title}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-12 text-center max-w-md">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {description || "This module is coming soon. Connect Lovable Cloud to enable full functionality."}
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}
