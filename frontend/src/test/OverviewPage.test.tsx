import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import OverviewPage from '@/pages/OverviewPage';

describe('OverviewPage', () => {
  it('renders the page header, stat cards, and bottlenecks table', async () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Published SOPs')).toBeInTheDocument();
    expect(screen.getByText('Newly detected')).toBeInTheDocument();
    expect(screen.getByText('Process bottlenecks')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
  });
});
