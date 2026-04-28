import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/auth/ProtectedRoute';

// Code-split each page so the initial bundle ships only the shell + login.
// Recharts and the heavier page modules are then fetched on demand the first
// time the user navigates to them.
const OverviewPage = lazy(() => import('@/pages/OverviewPage'));
const SopListPage = lazy(() => import('@/pages/SopListPage'));
const SopDetailPage = lazy(() => import('@/pages/SopDetailPage'));
const DetectedWorkflowsPage = lazy(() => import('@/pages/DetectedWorkflowsPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const BottlenecksPage = lazy(() => import('@/pages/BottlenecksPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const OrganizationPage = lazy(() => import('@/pages/OrganizationPage'));

function PageFallback() {
  return (
    <div className="min-h-[40vh] grid place-items-center text-ink-400 text-sm">Loading…</div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/reset/:token" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="sops" element={<SopListPage />} />
          <Route path="sops/:id" element={<SopDetailPage />} />
          <Route path="workflows" element={<DetectedWorkflowsPage />} />
          <Route path="bottlenecks" element={<BottlenecksPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
