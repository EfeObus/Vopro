import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SopListPage from '@/pages/SopListPage';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <SopListPage />
    </MemoryRouter>,
  );
}

describe('SopListPage', () => {
  it('renders the page header and seeded SOPs', async () => {
    renderWithRouter();
    expect(screen.getByText('SOP Library')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText('Onboard a new enterprise customer in Salesforce'),
      ).toBeInTheDocument();
    });
  });

  it('filters by status when a tab is clicked', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Bi-weekly payroll close in Gusto')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Drafts' }));

    await waitFor(() => {
      expect(screen.getByText('Bi-weekly payroll close in Gusto')).toBeInTheDocument();
      expect(screen.queryByText('Tier-1 support ticket triage in Zendesk')).not.toBeInTheDocument();
    });
  });

  it('filters by search query', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Tier-1 support ticket triage in Zendesk')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'payroll' },
    });

    await waitFor(() => {
      expect(screen.getByText('Bi-weekly payroll close in Gusto')).toBeInTheDocument();
      expect(screen.queryByText('Tier-1 support ticket triage in Zendesk')).not.toBeInTheDocument();
    });
  });
});
