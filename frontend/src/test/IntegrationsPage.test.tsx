import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IntegrationsPage from '@/pages/IntegrationsPage';

describe('IntegrationsPage', () => {
  it('renders the page header and the integration cards from the API', async () => {
    render(<IntegrationsPage />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    });
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
    // Connected providers from MOCK_INTEGRATIONS render a Connected button.
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);
  });

  it('shows a Connect button for OAuth providers that are disconnected', async () => {
    render(<IntegrationsPage />);
    // Microsoft 365 is disconnected in the mock data and supports OAuth.
    await waitFor(() => {
      const connectBtn = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.toLowerCase().includes('connect'));
      expect(connectBtn).toBeDefined();
    });
  });
});
