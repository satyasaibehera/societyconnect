import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthRouteGuard } from "@/components/AuthRouteGuard";
import { ProtectedRoute, SessionRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import Settings from "./pages/Settings";
import Approvals from "./pages/Approvals";
import Residents from "./pages/Residents";
import Visitors from "./pages/Visitors";
import Security from "./pages/Security";
import Helpers from "./pages/Helpers";
import Vehicles from "./pages/Vehicles";
import Notices from "./pages/Notices";
import Complaints from "./pages/Complaints";
import Voting from "./pages/Voting";
import Meetings from "./pages/Meetings";
import Resolutions from "./pages/Resolutions";
import DigitalIds from "./pages/DigitalIds";
import OfficeBearers from "./pages/OfficeBearers";
import MyFamily from "./pages/MyFamily";
import MyVisitors from "./pages/MyVisitors";
import MyHelpers from "./pages/MyHelpers";
import MyVehicles from "./pages/MyVehicles";
import MyTenants from "./pages/MyTenants";
import RegisterResident from "./pages/RegisterResident";
import VehiclePasses from "./pages/VehiclePasses";
import MyGatePasses from "./pages/MyGatePasses";
import Payments from "./pages/Payments";
import MyPayments from "./pages/MyPayments";
import Emergency from "./pages/Emergency";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import AccessControl from "./pages/AccessControl";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AuthProvider>
          <AuthRouteGuard>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/awaiting-approval"
                element={
                  <SessionRoute>
                    <PendingApproval />
                  </SessionRoute>
                }
              />
              <Route path="/platform-admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/register-resident" element={<ProtectedRoute><RegisterResident /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
            <Route path="/residents" element={<ProtectedRoute><Residents /></ProtectedRoute>} />
            <Route path="/visitors" element={<ProtectedRoute><Visitors /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/helpers" element={<ProtectedRoute><Helpers /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
            <Route path="/voting" element={<ProtectedRoute><Voting /></ProtectedRoute>} />
            <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
            <Route path="/resolutions" element={<ProtectedRoute><Resolutions /></ProtectedRoute>} />
            <Route path="/digital-ids" element={<ProtectedRoute><DigitalIds /></ProtectedRoute>} />
            <Route path="/vehicle-passes" element={<ProtectedRoute><VehiclePasses /></ProtectedRoute>} />
            <Route path="/office-bearers" element={<ProtectedRoute><OfficeBearers /></ProtectedRoute>} />
            <Route path="/my-family" element={<ProtectedRoute><MyFamily /></ProtectedRoute>} />
            <Route path="/my-visitors" element={<ProtectedRoute><MyVisitors /></ProtectedRoute>} />
            <Route path="/my-helpers" element={<ProtectedRoute><MyHelpers /></ProtectedRoute>} />
            <Route path="/my-vehicles" element={<ProtectedRoute><MyVehicles /></ProtectedRoute>} />
            <Route path="/my-tenants" element={<ProtectedRoute><MyTenants /></ProtectedRoute>} />
            <Route path="/my-gate-passes" element={<ProtectedRoute><MyGatePasses /></ProtectedRoute>} />
            <Route path="/my-payments" element={<ProtectedRoute><MyPayments /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/access-control" element={<ProtectedRoute><AccessControl /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthRouteGuard>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
