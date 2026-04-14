import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Surveys from "./pages/Surveys";
import SurveyDetail from "./pages/SurveyDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import Studio from "./pages/Studio";
import Insights from "./pages/Insights";
import Participants from "./pages/Participants";
import Settings from "./pages/Settings";
import AuthCallback from "./pages/AuthCallback";
import SurveyRespond from "./pages/SurveyRespond";
import SharedSnapshot from "./pages/SharedSnapshot";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import SegmentLibrary from "./pages/SegmentLibrary";
import SimulationStudio from "./pages/SimulationStudio";
import FocusGroupStudio from "./pages/FocusGroupStudio";
import ABTestStudio from "./pages/ABTestStudio";
import MarketSimStudio from "./pages/MarketSimStudio";
import PolicySimStudio from "./pages/PolicySimStudio";
import CustomTwinBuilder from "./pages/CustomTwinBuilder";
import TrustCenter from "./pages/TrustCenter";
import SegmentMarketplace from "./pages/SegmentMarketplace";
import ValidationStudies from "./pages/ValidationStudies";
import Methodology from "./pages/Methodology";
import Requirements from "./pages/Requirements";
import RequirementDetail from "./pages/RequirementDetail";
import Incentives from "./pages/Incentives";
import IncentiveDetail from "./pages/IncentiveDetail";
import SimulationComparison from "./pages/SimulationComparison";
import PublicDemo from "./pages/PublicDemo";
import { ParticipantRoute } from "@/components/ParticipantRoute";
import { ParticipantLayout } from "@/components/participant/ParticipantLayout";
import ParticipantLogin from "./pages/participant/ParticipantLogin";
import ParticipantSignup from "./pages/participant/ParticipantSignup";
import ParticipantDashboard from "./pages/participant/ParticipantDashboard";
import ParticipantProfile from "./pages/participant/ParticipantProfile";
import StudyFeed from "./pages/participant/StudyFeed";
import Earnings from "./pages/participant/Earnings";
import Impact from "./pages/participant/Impact";
import Referrals from "./pages/participant/Referrals";
import MyTwin from "./pages/participant/MyTwin";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminTenantDetail from "./pages/admin/AdminTenantDetail";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminParticipants from "./pages/admin/AdminParticipants";
import AdminStudies from "./pages/admin/AdminStudies";
import AdminAIUsage from "./pages/admin/AdminAIUsage";
import AdminFinancials from "./pages/admin/AdminFinancials";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSystem from "./pages/admin/AdminSystem";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <I18nProvider>
      <AuthProvider>
        <WorkspaceProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/s/:surveyId" element={<SurveyRespond />} />
              <Route path="/shared/:token" element={<SharedSnapshot />} />
              <Route path="/demo" element={<PublicDemo />} />

              {/* Participant portal — public auth */}
              <Route path="/participate/login" element={<ParticipantLogin />} />
              <Route path="/participate/signup" element={<ParticipantSignup />} />

              {/* Participant portal — protected */}
              <Route element={<ParticipantRoute />}>
                <Route element={<ParticipantLayout />}>
                  <Route path="/participate/dashboard" element={<ParticipantDashboard />} />
                  <Route path="/participate/studies" element={<StudyFeed />} />
                  <Route path="/participate/earnings" element={<Earnings />} />
                  <Route path="/participate/impact" element={<Impact />} />
                  <Route path="/participate/referrals" element={<Referrals />} />
                  <Route path="/participate/my-twin" element={<MyTwin />} />
                  <Route path="/participate/profile" element={<ParticipantProfile />} />
                </Route>
              </Route>

              {/* Super Admin routes */}
              <Route element={<SuperAdminRoute />}>
                <Route element={<SuperAdminLayout />}>
                  <Route path="/admin" element={<AdminOverview />} />
                  <Route path="/admin/tenants" element={<AdminTenants />} />
                  <Route path="/admin/tenants/:id" element={<AdminTenantDetail />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/participants" element={<AdminParticipants />} />
                  <Route path="/admin/studies" element={<AdminStudies />} />
                  <Route path="/admin/ai-usage" element={<AdminAIUsage />} />
                  <Route path="/admin/financials" element={<AdminFinancials />} />
                  <Route path="/admin/audit" element={<AdminAudit />} />
                  <Route path="/admin/system" element={<AdminSystem />} />
                </Route>
              </Route>

              {/* Protected app routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<ErrorBoundary><AppLayout /></ErrorBoundary>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/surveys" element={<Surveys />} />
                  <Route path="/surveys/:id" element={<SurveyDetail />} />
                  <Route path="/sessions" element={<Sessions />} />
                  <Route path="/sessions/:id" element={<SessionDetail />} />
                  <Route path="/studio/:id" element={<Studio />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/participants" element={<Participants />} />
                  <Route path="/segments" element={<SegmentLibrary />} />
                  <Route path="/simulate" element={<SimulationStudio />} />
                  <Route path="/simulate/:id" element={<SimulationStudio />} />
                  <Route path="/focus-group" element={<FocusGroupStudio />} />
                  <Route path="/ab-test" element={<ABTestStudio />} />
                  <Route path="/market-sim" element={<MarketSimStudio />} />
                  <Route path="/policy-sim" element={<PolicySimStudio />} />
                  <Route path="/twin-builder" element={<CustomTwinBuilder />} />
                  <Route path="/marketplace" element={<SegmentMarketplace />} />
                  <Route path="/trust-center" element={<TrustCenter />} />
                  <Route path="/validation" element={<ValidationStudies />} />
                  <Route path="/methodology" element={<Methodology />} />
                  <Route path="/requirements" element={<Requirements />} />
                  <Route path="/requirements/:id" element={<RequirementDetail />} />
                  <Route path="/incentives" element={<Incentives />} />
                  <Route path="/incentives/:id" element={<IncentiveDetail />} />
                  <Route path="/simulations/compare" element={<SimulationComparison />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Landing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
