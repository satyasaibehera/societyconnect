import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Shield, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchAdmins = async () => {
    setFetching(true);
    // Get all super_admin roles
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "super_admin");

    if (error || !roles) {
      setFetching(false);
      return;
    }

    // Get profiles for those users
    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const adminList: AdminUser[] = roles.map((r) => {
      const profile = profiles?.find((p) => p.user_id === r.user_id);
      return {
        user_id: r.user_id,
        email: profile?.full_name || r.user_id,
        full_name: profile?.full_name || null,
        role: r.role,
      };
    });

    setAdmins(adminList);
    setFetching(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddSuperAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      toast({ title: "Please fill email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Use edge function to create admin (we'll call signUp for now since auto-confirm is on)
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
        options: {
          data: { full_name: newAdminName },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Failed to create user");

      // Assign super_admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role: "super_admin" as any });

      if (roleError) throw roleError;

      toast({ title: "Super Admin added!", description: `${newAdminEmail} now has super admin access.` });
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminName("");
      fetchAdmins();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-3xl space-y-6">
        <Tabs defaultValue="admins">
          <TabsList>
            <TabsTrigger value="admins">Super Admins</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="mt-6 space-y-6">
            {/* Current Admins */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold">Current Super Admins</h2>
              </div>
              {fetching ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : (
                <div className="space-y-3">
                  {admins.map((admin) => (
                    <div key={admin.user_id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{admin.full_name || admin.user_id}</p>
                        <p className="text-xs text-muted-foreground">{admin.user_id}</p>
                      </div>
                      <Badge className="gradient-primary text-primary-foreground border-0">
                        Super Admin
                      </Badge>
                    </div>
                  ))}
                  {admins.length === 0 && (
                    <p className="text-sm text-muted-foreground">No super admins found.</p>
                  )}
                </div>
              )}
            </Card>

            {/* Add New Super Admin */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold">Add Super Admin</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="admin@society.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The new admin can change their password after first login.
                  </p>
                </div>
                <Button
                  onClick={handleAddSuperAdmin}
                  disabled={loading}
                  className="gradient-primary text-primary-foreground"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" /> Add Super Admin</>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <Card className="p-6">
              <h2 className="font-display font-semibold mb-4">My Profile</h2>
              <div className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</p>
                <p className="text-sm"><span className="text-muted-foreground">User ID:</span> {user?.id}</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
