import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import { ParticipantRoute } from "@/components/ParticipantRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";

const AppLayout = lazy(async () => ({
  default: (await import("@/components/layout/AppLayout")).AppLayout,
}));
const ParticipantLayout = lazy(async () => ({
  default: (await import("@/components/participant/ParticipantLayout")).ParticipantLayout,
}));
const SuperAdminLayout = lazy(async () => ({
  default: (await import("@/components/layout/SuperAdminLayout")).SuperAdminLayout,
}));

const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Surveys = lazy(() => import("./pages/Surveys"));
const SurveyDetail = lazy(() => import("./pages/SurveyDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Sessions = lazy(() => import("./pages/Sessions"));
const SessionDetail = lazy(() => import("./pages/SessionDetail"));
const Studio = lazy(() => import("./pages/Studio"));
const Insights = lazy(() => import("./pages/Insights"));
const Panel = lazy(() => import("./pages/Panel"));
const Participants = lazy(() => import("./pages/Participants"));
const Settings = lazy(() => import("./pages/Settings"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const SurveyRespond = lazy(() => import("./pages/SurveyRespond"));
const SharedSnapshot = lazy(() => import("./pages/SharedSnapshot"));
const Landing = lazy(() => import("./pages/Landing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SegmentLibrary = lazy(() => import("./pages/SegmentLibrary"));
const SimulationStudio = lazy(() => import("./pages/SimulationStudio"));
const FocusGroupStudio = lazy(() => import("./pages/FocusGroupStudio"));
const ABTestStudio = lazy(() => import("./pages/ABTestStudio"));
const MarketSimStudio = lazy(() => import("./pages/MarketSimStudio"));
const PolicySimStudio = lazy(() => import("./pages/PolicySimStudio"));
const CustomTwinBuilder = lazy(() => import("./pages/CustomTwinBuilder"));
const TrustCenter = lazy(() => import("./pages/TrustCenter"));
const SegmentMarketplace = lazy(() => import("./pages/SegmentMarketplace"));
const ValidationStudies = lazy(() => import("./pages/ValidationStudies"));
const Methodology = lazy(() => import("./pages/Methodology"));
const Requirements = lazy(() => import("./pages/Requirements"));
const RequirementDetail = lazy(() => import("./pages/RequirementDetail"));
const Incentives = lazy(() => import("./pages/Incentives"));
const IncentiveDetail = lazy(() => import("./pages/IncentiveDetail"));
const SimulationComparison = lazy(() => import("./pages/SimulationComparison"));
const PublicDemo = lazy(() => import("./pages/PublicDemo"));

const ParticipantLogin = lazy(() => import("./pages/participant/ParticipantLogin"));
const ParticipantSignup = lazy(() => import("./pages/participant/ParticipantSignup"));
const ParticipantDashboard = lazy(() => import("./pages/participant/ParticipantDashboard"));
const ParticipantProfile = lazy(() => import("./pages/participant/ParticipantProfile"));
const StudyFeed = lazy(() => import("./pages/participant/StudyFeed"));
const StudyDetail = lazy(() => import("./pages/participant/StudyDetail"));
const MyStudies = lazy(() => import("./pages/participant/MyStudies"));
const Earnings = lazy(() => import("./pages/participant/Earnings"));
const Impact = lazy(() => import("./pages/participant/Impact"));
const Referrals = lazy(() => import("./pages/participant/Referrals"));
const MyTwin = lazy(() => import("./pages/participant/MyTwin"));

const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminTenantDetail = lazy(() => import("./pages/admin/AdminTenantDetail"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminParticipants = lazy(() => import("./pages/admin/AdminParticipants"));
const AdminStudies = lazy(() => import("./pages/admin/AdminStudies"));
const AdminAIUsage = lazy(() => import("./pages/admin/AdminAIUsage"));
const AdminFinancials = lazy(() => import("./pages/admin/AdminFinancials"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminSystem = lazy(() => import("./pages/admin/AdminSystem"));

const queryClient = new QueryClient();

function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
      <div className="text-sm text-muted-foreground">Loading workspace...</div>
    </div>
  );
}

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
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/s/:surveyId" element={<SurveyRespond />} />
                    <Route path="/shared/:token" element={<SharedSnapshot />} />
                    <Route path="/demo" element={<PublicDemo />} />

                    <Route path="/participate/login" element={<ParticipantLogin />} />
                    <Route path="/participate/signup" element={<ParticipantSignup />} />

                    <Route element={<ParticipantRoute />}>
                      <Route element={<ParticipantLayout />}>
                        <Route path="/participate/dashboard" element={<ParticipantDashboard />} />
                        <Route path="/participate/studies" element={<StudyFeed />} />
                        <Route path="/participate/studies/:id" element={<StudyDetail />} />
                        <Route path="/participate/my-studies" element={<MyStudies />} />
                        <Route path="/participate/earnings" element={<Earnings />} />
                        <Route path="/participate/impact" element={<Impact />} />
                        <Route path="/participate/referrals" element={<Referrals />} />
                        <Route path="/participate/my-twin" element={<MyTwin />} />
                        <Route path="/participate/profile" element={<ParticipantProfile />} />
                      </Route>
                    </Route>

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
                        <Route path="/panel" element={<Panel />} />
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

                    <Route path="/" element={<Landing />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
