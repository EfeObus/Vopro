import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import DetectedWorkflowsPage from '@/pages/DetectedWorkflowsPage';

describe('DetectedWorkflowsPage', () => {
  it('renders the page header and the seeded detected workflows', async () => {
    render(
      <MemoryRouter>
        <DetectedWorkflowsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Detected workflows')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/runs.*last seen/i).length).toBeGreaterThan(0);
    });
  });

  it('moves a row to dismissed when Dismiss is clicked', async () => {
    render(
      <MemoryRouter>
        <DetectedWorkflowsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /dismiss/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /dismiss/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Dismissed').length).toBeGreaterThan(0);
    });
  });

  it('marks a row as SOP generated when Generate SOP is clicked', async () => {
    render(
      <MemoryRouter>
        <DetectedWorkflowsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /generate sop/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /generate sop/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('SOP generated').length).toBeGreaterThan(0);
    });
  });
});
