import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SopDetailPage from '@/pages/SopDetailPage';
import { MOCK_SOPS } from '@/data/mock';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sops/:id" element={<SopDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SopDetailPage', () => {
  it('renders the SOP title, decision steps, and version history', async () => {
    const sop = MOCK_SOPS[1]; // AP invoice review — has a decision
    renderAt(`/sops/${sop.id}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: sop.title })).toBeInTheDocument();
    });

    expect(screen.getAllByText('Decision').length).toBeGreaterThan(0);
    expect(screen.getByText('Is invoice ≥ $25,000?')).toBeInTheDocument();
    expect(screen.getByText('→ Yes')).toBeInTheDocument();
    expect(screen.getByText('→ No')).toBeInTheDocument();

    expect(screen.getByText('Version history')).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    renderAt('/sops/sop-not-found-id');
    expect(screen.getByText('Loading SOP…')).toBeInTheDocument();
  });
});
