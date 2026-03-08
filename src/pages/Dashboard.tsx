import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  Car,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const stats = [
  {
    label: "Total Residents",
    value: "342",
    change: "+12",
    trend: "up" as const,
    icon: Users,
  },
  {
    label: "Active Visitors",
    value: "18",
    change: "+5",
    trend: "up" as const,
    icon: UserCheck,
  },
  {
    label: "Registered Vehicles",
    value: "186",
    change: "+3",
    trend: "up" as const,
    icon: Car,
  },
  {
    label: "Open Complaints",
    value: "7",
    change: "-2",
    trend: "down" as const,
    icon: MessageSquare,
  },
];

const recentActivity = [
  { text: "Visitor pass generated for Ravi Kumar", time: "2 min ago", type: "visitor" },
  { text: "New complaint filed — Water leak in B-305", time: "15 min ago", type: "complaint" },
  { text: "Vehicle KA-05-AB-1234 registered", time: "1 hr ago", type: "vehicle" },
  { text: "Emergency alert: Power outage in Block C", time: "2 hrs ago", type: "emergency" },
  { text: "AGM Meeting scheduled for March 15", time: "3 hrs ago", type: "meeting" },
];

const Dashboard = () => {
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold font-display mt-1">{stat.value}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-success" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-success" />
                )}
                <span className="text-success font-medium">{stat.change}</span>
                <span className="text-muted-foreground">this month</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold">Recent Activity</h2>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    item.type === "emergency" ? "bg-destructive" :
                    item.type === "complaint" ? "bg-warning" :
                    "bg-primary"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="font-display font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Add Visitor Pass", icon: UserCheck },
                { label: "Register Vehicle", icon: Car },
                { label: "Send Notice", icon: MessageSquare },
                { label: "Emergency Alert", icon: AlertTriangle },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 rounded-lg p-3 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  {action.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
