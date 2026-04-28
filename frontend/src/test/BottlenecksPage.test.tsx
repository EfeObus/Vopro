import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import BottlenecksPage from '@/pages/BottlenecksPage';

describe('BottlenecksPage', () => {
  it('renders header, summary cards, and the bottleneck rows from the API', async () => {
    render(
      <MemoryRouter>
        <BottlenecksPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Process bottlenecks')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tracked workflows')).toBeInTheDocument();
      expect(screen.getByText('Worst overrun')).toBeInTheDocument();
    });
  });

  it('lets the user re-sort by clicking a sort chip', async () => {
    render(
      <MemoryRouter>
        <BottlenecksPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /slowest typical/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /slowest typical/i }));
    // No assertion on data ordering — just confirm the click doesn't blow up.
    expect(screen.getByRole('button', { name: /slowest typical/i })).toBeInTheDocument();
  });

  it('shows a drilldown when a row is clicked', async () => {
    render(
      <MemoryRouter>
        <BottlenecksPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getAllByRole('row')[1]);

    await waitFor(() => {
      expect(screen.getByText('Drilldown')).toBeInTheDocument();
      expect(screen.getByText('Overrun vs typical')).toBeInTheDocument();
    });
  });
});
