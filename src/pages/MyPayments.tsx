import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IndianRupee,
  QrCode,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Landmark,
  Copy,
  Info,
  Home,
  FileText,
  Printer,
  Download,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { getSocietyId } from "@/lib/society";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import RentReceiptTemplate from "@/components/payments/RentReceiptTemplate";

interface PaymentCategory {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  amount_min: number | null;
  amount_max: number | null;
  is_fixed_amount: boolean;
  due_day: number | null;
  frequency: string;
  upi_id: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  is_active: boolean;
}

interface OwnerConfig {
  id: string;
  owner_user_id: string;
  unit_id: string;
  upi_id: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
  rent_amount: number | null;
}

interface PaymentRecord {
  id: string;
  payment_type: string;
  amount: number;
  transaction_ref: string | null;
  notes: string | null;
  status: string;
  declared_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
  period_label: string | null;
  category_id: string | null;
  payer_user_id: string;
  owner_config_id: string | null;
}

interface ResidentInfo {
  resident_type: string;
  unit_id: string | null;
  full_name: string;
}

interface RentReceipt {
  id: string;
  payment_record_id: string;
  owner_name: string;
  tenant_name: string;
  amount: number;
  period_label: string | null;
  payment_date: string;
  receipt_number: string;
  issued_at: string;
  notes: string | null;
}

export default function MyPayments() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [ownerConfig, setOwnerConfig] = useState<OwnerConfig | null>(null);
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rentReceipts, setRentReceipts] = useState<RentReceipt[]>([]);
  const [ownerRentRecords, setOwnerRentRecords] = useState<PaymentRecord[]>([]);

  // Pay dialog
  const [payCategory, setPayCategory] = useState<PaymentCategory | null>(null);
  const [payRent, setPayRent] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const [paying, setPaying] = useState(false);

  // QR dialog
  const [showQr, setShowQr] = useState<{ upiId: string; name: string; amount: number } | null>(null);

  // Owner rent config dialog
  const [showRentConfig, setShowRentConfig] = useState(false);
  const [rentForm, setRentForm] = useState({ upi_id: "", account_holder_name: "", bank_name: "", rent_amount: "" });
  const [savingRent, setSavingRent] = useState(false);

  // Receipt dialogs
  const [issueReceiptRecord, setIssueReceiptRecord] = useState<PaymentRecord | null>(null);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [issuingReceipt, setIssuingReceipt] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<RentReceipt | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Tenant names for owner view
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  // Unit info for receipts
  const [unitLabel, setUnitLabel] = useState("");
  const [buildingName, setBuildingName] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const societyId = await getSocietyId();
    if (!societyId) return;

    const { data: resData } = await tenantDb.from("residents")
      .select("resident_type, unit_id, full_name")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    setResidentInfo(resData as ResidentInfo | null);

    const [catRes, recRes] = await Promise.all([
      tenantDb.from("payment_categories")
        .select("*")
        .eq("society_id", societyId)
        .eq("is_active", true)
        .order("name"),
      tenantDb.from("payment_records")
        .select("*")
        .eq("payer_user_id", user.id)
        .order("declared_at", { ascending: false })
        .limit(50),
    ]);

    setCategories((catRes.data as PaymentCategory[]) || []);
    setRecords((recRes.data as PaymentRecord[]) || []);

    // Fetch unit/building info
    if (resData?.unit_id) {
      const { data: unitData } = await tenantDb.from("units")
        .select("unit_number, building_id")
        .eq("id", resData.unit_id)
        .maybeSingle();
      if (unitData) {
        setUnitLabel(unitData.unit_number);
        const { data: bData } = await tenantDb.from("buildings")
          .select("name")
          .eq("id", unitData.building_id)
          .maybeSingle();
        setBuildingName(bData?.name || "");
      }
    }

    if (resData?.unit_id && resData.resident_type === "tenant") {
      const { data } = await tenantDb.from("owner_payment_config")
        .select("*")
        .eq("unit_id", resData.unit_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setOwnerConfig((data as OwnerConfig) || null);

      // Fetch receipts for tenant
      const { data: receipts } = await tenantDb.from("rent_receipts")
        .select("*")
        .eq("tenant_user_id", user.id)
        .order("issued_at", { ascending: false });
      setRentReceipts((receipts as RentReceipt[]) || []);
    }

    if (resData?.unit_id && resData.resident_type === "owner") {
      const { data } = await tenantDb.from("owner_payment_config")
        .select("*")
        .eq("owner_user_id", user.id)
        .eq("unit_id", resData.unit_id)
        .limit(1)
        .maybeSingle();
      setOwnerConfig((data as OwnerConfig) || null);

      // Fetch rent payment records for owner's unit (via owner_config_id)
      if (data) {
        const { data: rentRecs } = await tenantDb.from("payment_records")
          .select("*")
          .eq("payment_type", "rent")
          .eq("owner_config_id", (data as OwnerConfig).id)
          .order("declared_at", { ascending: false })
          .limit(50);
        setOwnerRentRecords((rentRecs as PaymentRecord[]) || []);

        // Get tenant names
        if (rentRecs && rentRecs.length > 0) {
          const payerIds = [...new Set(rentRecs.map((r: PaymentRecord) => r.payer_user_id))];
          const { data: profiles } = await tenantDb.from("profiles")
            .select("user_id, full_name")
            .in("user_id", payerIds);
          const nameMap: Record<string, string> = {};
          (profiles || []).forEach((p: { user_id: string; full_name: string | null }) => {
            nameMap[p.user_id] = p.full_name || "Unknown";
          });
          setTenantNames(nameMap);
        }

        // Fetch receipts issued by owner
        const { data: receipts } = await tenantDb.from("rent_receipts")
          .select("*")
          .eq("owner_user_id", user.id)
          .order("issued_at", { ascending: false });
        setRentReceipts((receipts as RentReceipt[]) || []);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const isOwner = residentInfo?.resident_type === "owner";
  const isTenant = residentInfo?.resident_type === "tenant";

  const generateUpiUrl = (upiId: string, name: string, amount: number) =>
    `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;

  const openPayDialog = (cat: PaymentCategory) => {
    setPayCategory(cat);
    setPayRent(false);
    setPayAmount(cat.is_fixed_amount && cat.amount ? cat.amount.toString() : "");
    setPayRef("");
    setPayNotes("");
    setPayPeriod(format(new Date(), "MMMM yyyy"));
    setPaying(false);
  };

  const openRentPayDialog = () => {
    setPayCategory(null);
    setPayRent(true);
    setPayAmount(ownerConfig?.rent_amount?.toString() || "");
    setPayRef("");
    setPayNotes("");
    setPayPeriod(format(new Date(), "MMMM yyyy"));
    setPaying(false);
  };

  const handlePay = async () => {
    if (!user || !payAmount) return;
    setPaying(true);
    const societyId = await getSocietyId();
    if (!societyId) { setPaying(false); return; }

    const { error } = await tenantDb.from("payment_records").insert({
      society_id: societyId,
      payer_user_id: user.id,
      payment_type: payRent ? "rent" : "society",
      category_id: payCategory?.id || null,
      owner_config_id: payRent ? ownerConfig?.id || null : null,
      amount: parseFloat(payAmount),
      transaction_ref: payRef.trim() || null,
      notes: payNotes.trim() || null,
      period_label: payPeriod.trim() || null,
      status: "declared",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment Declared", description: "Your payment has been recorded and is pending verification." });
      setPayCategory(null);
      setPayRent(false);
      fetchData();
    }
    setPaying(false);
  };

  const handleSaveRentConfig = async () => {
    if (!user || !residentInfo?.unit_id) return;
    setSavingRent(true);
    const payload = {
      owner_user_id: user.id,
      unit_id: residentInfo.unit_id,
      upi_id: rentForm.upi_id.trim() || null,
      account_holder_name: rentForm.account_holder_name.trim() || null,
      bank_name: rentForm.bank_name.trim() || null,
      rent_amount: rentForm.rent_amount ? parseFloat(rentForm.rent_amount) : null,
    };
    let error;
    if (ownerConfig) {
      ({ error } = await tenantDb.from("owner_payment_config").update(payload).eq("id", ownerConfig.id));
    } else {
      ({ error } = await tenantDb.from("owner_payment_config").insert(payload));
    }
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rent Config Saved" });
      setShowRentConfig(false);
      fetchData();
    }
    setSavingRent(false);
  };

  const openRentConfig = () => {
    setRentForm({
      upi_id: ownerConfig?.upi_id || "",
      account_holder_name: ownerConfig?.account_holder_name || "",
      bank_name: ownerConfig?.bank_name || "",
      rent_amount: ownerConfig?.rent_amount?.toString() || "",
    });
    setShowRentConfig(true);
  };

  const handleVerifyRent = async (recordId: string, approve: boolean) => {
    const update = {
      status: approve ? "verified" : "rejected",
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
      ...(approve ? {} : { rejection_reason: "Payment not confirmed by owner" }),
    };

    const { error } = await tenantDb.from("payment_records").update(update).eq("id", recordId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approve ? "Payment Verified" : "Payment Rejected" });
      fetchData();
    }
  };

  const handleIssueReceipt = async () => {
    if (!user || !issueReceiptRecord || !residentInfo?.unit_id) return;
    setIssuingReceipt(true);

    const tenantName = tenantNames[issueReceiptRecord.payer_user_id] || "Tenant";
    const ownerName = residentInfo.full_name || "Owner";
    const receiptNumber = `RR-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await tenantDb.from("rent_receipts").insert({
      payment_record_id: issueReceiptRecord.id,
      owner_user_id: user.id,
      tenant_user_id: issueReceiptRecord.payer_user_id,
      owner_name: ownerName,
      tenant_name: tenantName,
      unit_id: residentInfo.unit_id,
      amount: issueReceiptRecord.amount,
      period_label: issueReceiptRecord.period_label,
      payment_date: issueReceiptRecord.declared_at.split("T")[0],
      receipt_number: receiptNumber,
      notes: receiptNotes.trim() || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Receipt Issued", description: "The tenant can now view and download this receipt." });
      setIssueReceiptRecord(null);
      setReceiptNotes("");
      fetchData();
    }
    setIssuingReceipt(false);
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Rent Receipt</title>
          <style>
            body { margin: 0; font-family: Georgia, 'Times New Roman', serif; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  const societyRecords = records.filter((r) => r.payment_type === "society");
  const rentRecords = records.filter((r) => r.payment_type === "rent");

  const statusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const receiptIssuedForRecord = (recordId: string) =>
    rentReceipts.some((r) => r.payment_record_id === recordId);

  const pendingCount = records.filter((r) => r.status === "declared").length;
  const totalPaid = records.filter((r) => r.status === "verified").reduce((s, r) => s + r.amount, 0);

  return (
    <DashboardLayout title="My Payments">
      <div className="space-y-6 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Available Categories</p>
            <p className="text-2xl font-bold mt-1">{categories.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Pending Verification</p>
            <p className="text-2xl font-bold mt-1 text-amber-500">{pendingCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Verified</p>
            <p className="text-2xl font-bold mt-1 text-green-600">₹{totalPaid.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Payments</p>
            <p className="text-2xl font-bold mt-1">{records.length}</p>
          </Card>
        </div>

        <Tabs defaultValue="society">
          <TabsList>
            <TabsTrigger value="society">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Society Payments
            </TabsTrigger>
            <TabsTrigger value="rent">
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Rent
            </TabsTrigger>
            {(rentReceipts.length > 0 || isOwner) && (
              <TabsTrigger value="receipts">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Receipts
              </TabsTrigger>
            )}
            <TabsTrigger value="history">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Society Payments Tab */}
          <TabsContent value="society" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Society Charges</h2>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Pay society charges by scanning the UPI QR code or using bank details. After payment, declare it here with your transaction reference.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {categories.length === 0 ? (
              <Card className="p-8 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No payment categories have been set up by the society admin yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {categories.map((cat) => (
                  <Card key={cat.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-primary" />
                        {cat.name}
                      </CardTitle>
                      {cat.description && <CardDescription>{cat.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary">
                          {cat.is_fixed_amount
                            ? `₹${cat.amount?.toLocaleString()}`
                            : `₹${cat.amount_min?.toLocaleString() || "0"} – ₹${cat.amount_max?.toLocaleString() || "∞"}`}
                        </Badge>
                        <Badge variant="outline" className="capitalize">{cat.frequency}</Badge>
                        {cat.due_day && <Badge variant="outline">Due: {cat.due_day}th</Badge>}
                      </div>
                      <div className="flex gap-2">
                        {cat.upi_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setShowQr({
                                upiId: cat.upi_id!,
                                name: cat.account_holder_name || cat.name,
                                amount: cat.amount || 0,
                              })
                            }
                          >
                            <QrCode className="h-3.5 w-3.5 mr-1" />
                            Show QR
                          </Button>
                        )}
                        <Button size="sm" onClick={() => openPayDialog(cat)}>
                          I Have Paid
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Rent Tab */}
          <TabsContent value="rent" className="space-y-4 mt-4">
            {isOwner && (
              <>
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Rent Collection Setup</CardTitle>
                    <CardDescription>Configure your UPI/bank details so your tenant can pay rent.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ownerConfig?.upi_id ? (
                      <div className="space-y-2">
                        <p className="text-sm">
                          UPI: <span className="font-medium">{ownerConfig.upi_id}</span>
                          {ownerConfig.rent_amount && ` • ₹${ownerConfig.rent_amount.toLocaleString()}/month`}
                        </p>
                        <Button size="sm" variant="outline" onClick={openRentConfig}>
                          Edit Configuration
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={openRentConfig}>
                        Set Up Rent Payment
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Owner: Tenant rent payments to verify */}
                {ownerRentRecords.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Tenant Rent Payments</CardTitle>
                      <CardDescription>Verify payments and issue rent receipts.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Ref</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ownerRentRecords.map((rec) => (
                            <TableRow key={rec.id}>
                              <TableCell className="font-medium">{tenantNames[rec.payer_user_id] || "—"}</TableCell>
                              <TableCell>{rec.period_label || "—"}</TableCell>
                              <TableCell>₹{rec.amount.toLocaleString()}</TableCell>
                              <TableCell className="text-xs">{rec.transaction_ref || "—"}</TableCell>
                              <TableCell className="text-xs">{format(new Date(rec.declared_at), "MMM d, yyyy")}</TableCell>
                              <TableCell>{statusBadge(rec.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {rec.status === "declared" && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleVerifyRent(rec.id, true)}>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Verify
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleVerifyRent(rec.id, false)}>
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  {rec.status === "verified" && !receiptIssuedForRecord(rec.id) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => { setIssueReceiptRecord(rec); setReceiptNotes(""); }}
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      Issue Receipt
                                    </Button>
                                  )}
                                  {receiptIssuedForRecord(rec.id) && (
                                    <Badge variant="secondary" className="text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Receipt Issued
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {isTenant && (
              <>
                {ownerConfig?.upi_id ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Home className="h-4 w-4 text-primary" />
                        Rent Payment
                      </CardTitle>
                      <CardDescription>
                        Pay rent to your house owner via UPI
                        {ownerConfig.rent_amount && ` • ₹${ownerConfig.rent_amount.toLocaleString()}/month`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setShowQr({
                              upiId: ownerConfig.upi_id!,
                              name: ownerConfig.account_holder_name || "Owner",
                              amount: ownerConfig.rent_amount || 0,
                            })
                          }
                        >
                          <QrCode className="h-3.5 w-3.5 mr-1" />
                          Show QR
                        </Button>
                        <Button size="sm" onClick={openRentPayDialog}>
                          I Have Paid Rent
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="p-8 text-center">
                    <Landmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Your house owner hasn't set up rent payment details yet.</p>
                  </Card>
                )}
              </>
            )}

            {!isOwner && !isTenant && (
              <Card className="p-8 text-center">
                <Info className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Rent payments are available for tenants and owners only.</p>
              </Card>
            )}

            {/* Tenant: Rent Payment History */}
            {isTenant && rentRecords.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Rent Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentRecords.map((r) => {
                        const receipt = rentReceipts.find((rc) => rc.payment_record_id === r.id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{r.period_label || "—"}</TableCell>
                            <TableCell>₹{r.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{r.transaction_ref || "—"}</TableCell>
                            <TableCell className="text-xs">{format(new Date(r.declared_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell>
                              {receipt ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => setViewReceipt(receipt)}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Receipts Tab */}
          <TabsContent value="receipts" className="space-y-4 mt-4">
            <h2 className="text-lg font-semibold">
              {isOwner ? "Issued Rent Receipts" : "My Rent Receipts"}
            </h2>

            {rentReceipts.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {isOwner ? "No receipts issued yet. Verify a rent payment first, then issue a receipt." : "No rent receipts available yet."}
                </p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {rentReceipts.map((rc) => (
                  <Card key={rc.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {rc.receipt_number} — ₹{rc.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isOwner ? `To: ${rc.tenant_name}` : `From: ${rc.owner_name}`}
                          {rc.period_label && ` • ${rc.period_label}`}
                          {` • ${format(new Date(rc.issued_at), "MMM d, yyyy")}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewReceipt(rc)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <h2 className="text-lg font-semibold">All Payment History</h2>
            {records.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No payments made yet.</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Transaction Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{r.payment_type}</Badge>
                        </TableCell>
                        <TableCell>₹{r.amount.toLocaleString()}</TableCell>
                        <TableCell>{r.period_label || "—"}</TableCell>
                        <TableCell className="text-xs">{r.transaction_ref || "—"}</TableCell>
                        <TableCell className="text-xs">{format(new Date(r.declared_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {statusBadge(r.status)}
                          {r.rejection_reason && (
                            <p className="text-xs text-destructive mt-0.5">{r.rejection_reason}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={!!showQr} onOpenChange={(v) => { if (!v) setShowQr(null); }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Scan to Pay</DialogTitle>
            <DialogDescription>Scan this QR code with any UPI app to make the payment.</DialogDescription>
          </DialogHeader>
          {showQr && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                <QRCodeSVG
                  value={generateUpiUrl(showQr.upiId, showQr.name, showQr.amount)}
                  size={220}
                  level="M"
                />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{showQr.name}</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-muted-foreground">UPI: {showQr.upiId}</span>
                  <button onClick={() => copyToClipboard(showQr.upiId)} className="text-primary hover:text-primary/80">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                {showQr.amount > 0 && (
                  <p className="font-semibold text-lg">₹{showQr.amount.toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Declaration Dialog */}
      <Dialog open={!!payCategory || payRent} onOpenChange={(v) => { if (!v) { setPayCategory(null); setPayRent(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Declare Payment</DialogTitle>
            <DialogDescription>
              Enter your payment details. This will be verified by {payRent ? "your house owner" : "the society admin"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount paid" />
            </div>
            <div className="space-y-2">
              <Label>Payment Period</Label>
              <Input value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} placeholder="e.g., March 2026" />
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference / UTR</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g., UTR number or transaction ID" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} placeholder="Any additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayCategory(null); setPayRent(false); }}>Cancel</Button>
            <Button onClick={handlePay} disabled={paying || !payAmount}>
              {paying ? "Submitting..." : "Declare Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Rent Config Dialog */}
      <Dialog open={showRentConfig} onOpenChange={setShowRentConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rent Payment Setup</DialogTitle>
            <DialogDescription>Configure your UPI details so your tenant can scan and pay rent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>UPI ID *</Label>
              <Input value={rentForm.upi_id} onChange={(e) => setRentForm({ ...rentForm, upi_id: e.target.value })} placeholder="e.g., yourname@upi" />
            </div>
            <div className="space-y-2">
              <Label>Account Holder Name</Label>
              <Input value={rentForm.account_holder_name} onChange={(e) => setRentForm({ ...rentForm, account_holder_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={rentForm.bank_name} onChange={(e) => setRentForm({ ...rentForm, bank_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Rent Amount (₹)</Label>
              <Input type="number" value={rentForm.rent_amount} onChange={(e) => setRentForm({ ...rentForm, rent_amount: e.target.value })} placeholder="e.g., 15000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRentConfig(false)}>Cancel</Button>
            <Button onClick={handleSaveRentConfig} disabled={savingRent || !rentForm.upi_id.trim()}>
              {savingRent ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Receipt Dialog (Owner) */}
      <Dialog open={!!issueReceiptRecord} onOpenChange={(v) => { if (!v) setIssueReceiptRecord(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Rent Receipt</DialogTitle>
            <DialogDescription>
              Issue a formal rent receipt to {issueReceiptRecord ? tenantNames[issueReceiptRecord.payer_user_id] || "the tenant" : "the tenant"}.
            </DialogDescription>
          </DialogHeader>
          {issueReceiptRecord && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">₹{issueReceiptRecord.amount.toLocaleString()}</span></p>
                <p><span className="text-muted-foreground">Period:</span> {issueReceiptRecord.period_label || "—"}</p>
                <p><span className="text-muted-foreground">Payment Date:</span> {format(new Date(issueReceiptRecord.declared_at), "dd MMM yyyy")}</p>
                <p><span className="text-muted-foreground">Tenant:</span> {tenantNames[issueReceiptRecord.payer_user_id] || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g., Rent for March 2026"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueReceiptRecord(null)}>Cancel</Button>
            <Button onClick={handleIssueReceipt} disabled={issuingReceipt}>
              {issuingReceipt ? "Issuing..." : "Issue Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewReceipt} onOpenChange={(v) => { if (!v) setViewReceipt(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rent Receipt
            </DialogTitle>
          </DialogHeader>
          {viewReceipt && (
            <>
              <RentReceiptTemplate
                ref={receiptRef}
                receipt={{
                  ...viewReceipt,
                  unit_label: unitLabel,
                  building_name: buildingName,
                }}
              />
              <div className="flex justify-center gap-3 mt-4">
                <Button variant="outline" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handlePrintReceipt}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
