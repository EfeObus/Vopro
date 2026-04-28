import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import {
  RootErrorBoundary,
  installGlobalRejectionHandler,
} from './components/RootErrorBoundary';
import { ToasterProvider } from './components/Toaster';
import { SentryErrorBoundary, initObservability } from './lib/observability';
import './styles/index.css';

initObservability();
installGlobalRejectionHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outer Sentry boundary captures + reports to telemetry; the inner
        RootErrorBoundary renders the user-facing recovery UI. */}
    <SentryErrorBoundary fallback={<div className="p-8">Telemetry boundary.</div>}>
      <RootErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <ToasterProvider>
              <App />
            </ToasterProvider>
          </AuthProvider>
        </BrowserRouter>
      </RootErrorBoundary>
    </SentryErrorBoundary>
  </React.StrictMode>,
);
