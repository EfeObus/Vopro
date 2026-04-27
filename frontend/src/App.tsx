import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import OverviewPage from '@/pages/OverviewPage';
import SopListPage from '@/pages/SopListPage';
import SopDetailPage from '@/pages/SopDetailPage';
import DetectedWorkflowsPage from '@/pages/DetectedWorkflowsPage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="sops" element={<SopListPage />} />
        <Route path="sops/:id" element={<SopDetailPage />} />
        <Route path="workflows" element={<DetectedWorkflowsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
