import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/residents" element={<PlaceholderPage title="Residents" description="Manage all residents, owners, and tenants across your society." />} />
          <Route path="/visitors" element={<PlaceholderPage title="Visitor Management" description="Generate visitor passes, approve entries, and track visits." />} />
          <Route path="/security" element={<PlaceholderPage title="Security Staff" description="Manage security guards and gate access controls." />} />
          <Route path="/vehicles" element={<PlaceholderPage title="Vehicle Registry" description="Register vehicles, assign parking slots, and manage passes." />} />
          <Route path="/helpers" element={<PlaceholderPage title="Domestic Helpers" description="Track domestic helpers, assign units, and manage schedules." />} />
          <Route path="/notices" element={<PlaceholderPage title="Notice Board" description="Post and manage society notices and announcements." />} />
          <Route path="/complaints" element={<PlaceholderPage title="Complaints" description="File, track, and resolve resident complaints." />} />
          <Route path="/voting" element={<PlaceholderPage title="Digital Voting" description="Create polls, conduct votes, and view results." />} />
          <Route path="/meetings" element={<PlaceholderPage title="Meetings & AGM" description="Schedule meetings, share agendas, and record minutes." />} />
          <Route path="/resolutions" element={<PlaceholderPage title="Resolutions" description="Record and manage society resolutions and decisions." />} />
          <Route path="/digital-ids" element={<PlaceholderPage title="Digital IDs" description="Generate QR-based digital ID cards for residents and staff." />} />
          <Route path="/emergency" element={<PlaceholderPage title="Emergency Alerts" description="Send and manage emergency alerts across the society." />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" description="Configure society settings, roles, and preferences." />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
