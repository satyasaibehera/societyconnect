import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import Settings from "./pages/Settings";
import Approvals from "./pages/Approvals";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/residents" element={<ProtectedRoute><PlaceholderPage title="Residents" description="Manage all residents, owners, and tenants across your society." /></ProtectedRoute>} />
            <Route path="/visitors" element={<ProtectedRoute><PlaceholderPage title="Visitor Management" description="Generate visitor passes, approve entries, and track visits." /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><PlaceholderPage title="Security Staff" description="Manage security guards and gate access controls." /></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute><PlaceholderPage title="Vehicle Registry" description="Register vehicles, assign parking slots, and manage passes." /></ProtectedRoute>} />
            <Route path="/helpers" element={<ProtectedRoute><PlaceholderPage title="Domestic Helpers" description="Track domestic helpers, assign units, and manage schedules." /></ProtectedRoute>} />
            <Route path="/notices" element={<ProtectedRoute><PlaceholderPage title="Notice Board" description="Post and manage society notices and announcements." /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute><PlaceholderPage title="Complaints" description="File, track, and resolve resident complaints." /></ProtectedRoute>} />
            <Route path="/voting" element={<ProtectedRoute><PlaceholderPage title="Digital Voting" description="Create polls, conduct votes, and view results." /></ProtectedRoute>} />
            <Route path="/meetings" element={<ProtectedRoute><PlaceholderPage title="Meetings & AGM" description="Schedule meetings, share agendas, and record minutes." /></ProtectedRoute>} />
            <Route path="/resolutions" element={<ProtectedRoute><PlaceholderPage title="Resolutions" description="Record and manage society resolutions and decisions." /></ProtectedRoute>} />
            <Route path="/digital-ids" element={<ProtectedRoute><PlaceholderPage title="Digital IDs" description="Generate QR-based digital ID cards for residents and staff." /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute><PlaceholderPage title="Emergency Alerts" description="Send and manage emergency alerts across the society." /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
