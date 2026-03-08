import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Shield, Loader2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface Profile {
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
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

  // Profile state
  const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null, date_of_birth: null });
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", date_of_birth: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, date_of_birth")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      setProfileForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        date_of_birth: data.date_of_birth || "",
      });
    }
    setProfileLoading(false);
  }, [user]);

  const fetchAdmins = async () => {
    setFetching(true);
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "super_admin");

    if (error || !roles) {
      setFetching(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const adminList: AdminUser[] = roles.map((r) => {
      const prof = profiles?.find((p) => p.user_id === r.user_id);
      return {
        user_id: r.user_id,
        email: r.user_id,
        full_name: prof?.full_name || null,
        role: r.role,
      };
    });

    setAdmins(adminList);
    setFetching(false);
  };

  useEffect(() => { fetchAdmins(); }, []);
  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileForm.full_name || null,
        phone: profileForm.phone || null,
        date_of_birth: profileForm.date_of_birth || null,
      })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setEditingProfile(false);
      fetchProfile();
    }
  };

  const handleAddSuperAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      toast({ title: "Please fill email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
        options: {
          data: { full_name: newAdminName },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Failed to create user");

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
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="admins">Super Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold">My Profile</h2>
                {!editingProfile ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingProfile(false);
                      setProfileForm({
                        full_name: profile.full_name || "",
                        phone: profile.phone || "",
                        date_of_birth: profile.date_of_birth || "",
                      });
                    }}>
                      <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {profileLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : editingProfile ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user?.email || ""} disabled className="opacity-60" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={profileForm.date_of_birth} onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{profile.full_name || "—"}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{user?.email || "—"}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{profile.phone || "—"}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{profile.date_of_birth || "—"}</span>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

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
                        <p className="text-sm font-medium">{admin.full_name || "Unnamed Admin"}</p>
                        <p className="text-xs text-muted-foreground">{admin.full_name ? "Super Admin" : admin.user_id}</p>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
