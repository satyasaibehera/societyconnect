import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, ShieldCheck } from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { APP_ROLE } from "@/types/auth";
import {
  ACCESS_CONTROL_ROLE,
  ACCESS_CONTROL_ROLE_COLUMNS,
} from "@/types/accessControl";

const MODULE_GROUPS = [
  {
    label: "Management",
    modules: [
      { key: "dashboard", label: "Dashboard" },
      { key: "approvals", label: "Approvals" },
      { key: "residents", label: "Residents" },
      { key: "visitors", label: "Visitors" },
      { key: "security", label: "Security Staff" },
      { key: "vehicles", label: "Vehicles" },
      { key: "helpers", label: "Helpers" },
      { key: "payments", label: "Payments" },
      { key: "office-bearers", label: "Office Bearers" },
    ],
  },
  {
    label: "Resident",
    modules: [
      { key: "my-family", label: "My Family" },
      { key: "my-visitors", label: "My Visitors" },
      { key: "my-helpers", label: "My Helpers" },
      { key: "my-vehicles", label: "My Vehicles" },
      { key: "my-tenants", label: "My Tenants" },
      { key: "my-payments", label: "My Payments" },
      { key: "my-gate-passes", label: "My Approvals" },
    ],
  },
  {
    label: "Community",
    modules: [
      { key: "notices", label: "Notices" },
      { key: "complaints", label: "Complaints" },
      { key: "voting", label: "Voting" },
      { key: "meetings", label: "Meetings" },
      { key: "resolutions", label: "Resolutions" },
    ],
  },
  {
    label: "System",
    modules: [
      { key: "digital-ids", label: "Digital IDs" },
      { key: "vehicle-passes", label: "Vehicle Passes" },
      { key: "emergency", label: "Emergency" },
      { key: "settings", label: "Settings" },
    ],
  },
];

type PermissionMap = Record<string, Record<string, boolean>>;

const AccessControl = () => {
  const { user } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [saved, setSaved] = useState<PermissionMap>({});
  const [draft, setDraft] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await tenantDb.from("access_controls")
      .select("module_key, role_key, is_enabled");

    if (error || !data) {
      setLoading(false);
      return;
    }

    const map: PermissionMap = {};
    data.forEach((row) => {
      const mod = row.module_key as string;
      const role = row.role_key as string;
      if (!map[mod]) map[mod] = {};
      map[mod][role] = row.is_enabled as boolean;
    });

    setSaved(JSON.parse(JSON.stringify(map)));
    setDraft(JSON.parse(JSON.stringify(map)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [saved, draft]);

  const togglePermission = (moduleKey: string, roleKey: string) => {
    // Super admin permissions are always on and cannot be toggled
    if (roleKey === ACCESS_CONTROL_ROLE.SUPER_ADMIN) return;

    setDraft((prev) => {
      const next = { ...prev };
      if (!next[moduleKey]) next[moduleKey] = {};
      next[moduleKey] = { ...next[moduleKey], [roleKey]: !next[moduleKey][roleKey] };
      return next;
    });
  };

  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(saved)));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Build upsert array from draft
    const rows: { module_key: string; role_key: string; is_enabled: boolean; updated_by: string }[] = [];
    for (const [moduleKey, roles] of Object.entries(draft)) {
      for (const [roleKey, enabled] of Object.entries(roles)) {
        rows.push({
          module_key: moduleKey,
          role_key: roleKey,
          is_enabled: enabled,
          updated_by: user.id,
        });
      }
    }

    const { error } = await tenantDb.from("access_controls")
      .upsert(rows as any, { onConflict: "module_key,role_key" });

    setSaving(false);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Access controls saved successfully" });
      setSaved(JSON.parse(JSON.stringify(draft)));
    }
  };

  if (!roleLoading && !hasRole(APP_ROLE.SUPER_ADMIN)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout title="Access Control">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-display font-bold">Access Control Matrix</h1>
            <p className="text-sm text-muted-foreground">
              Control which modules each role can access across the application.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading permissions...
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-semibold min-w-[200px] sticky left-0 bg-muted/50 z-10">
                      Module
                    </th>
                    {ACCESS_CONTROL_ROLE_COLUMNS.map((role) => (
                      <th key={role.key} className="p-3 text-center font-semibold min-w-[110px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs">{role.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULE_GROUPS.map((group) => (
                    <>
                      <tr key={group.label}>
                        <td
                          colSpan={ACCESS_CONTROL_ROLE_COLUMNS.length + 1}
                          className="px-3 py-2 bg-primary/5 font-semibold text-xs uppercase tracking-wider text-primary"
                        >
                          {group.label}
                        </td>
                      </tr>
                      {group.modules.map((mod) => (
                        <tr key={mod.key} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium sticky left-0 bg-background z-10">
                            {mod.label}
                          </td>
                          {ACCESS_CONTROL_ROLE_COLUMNS.map((role) => {
                            const enabled = draft[mod.key]?.[role.key] ?? false;
                            const isSuperAdmin = role.key === ACCESS_CONTROL_ROLE.SUPER_ADMIN;
                            return (
                              <td key={role.key} className="p-3 text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={isSuperAdmin ? true : enabled}
                                    disabled={isSuperAdmin}
                                    onCheckedChange={() => togglePermission(mod.key, role.key)}
                                    className={isSuperAdmin ? "opacity-50 cursor-not-allowed" : ""}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save / Discard bar */}
            <div className="flex items-center justify-between border-t p-4 bg-muted/30">
              <div>
                {hasChanges && (
                  <Badge variant="secondary" className="text-xs">
                    Unsaved changes
                  </Badge>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={!hasChanges || saving}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="gradient-primary text-primary-foreground"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AccessControl;
