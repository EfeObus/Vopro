import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('exposes Export, Publish, Archive, and Edit actions for a draft SOP', async () => {
    // Pick a draft SOP so all three lifecycle buttons render.
    const draft = MOCK_SOPS.find((s) => s.status === 'draft')!;
    renderAt(`/sops/${draft.id}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: draft.title })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /export as markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export as pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('toggles into an inline edit panel when Edit is clicked', async () => {
    const sop = MOCK_SOPS[0];
    renderAt(`/sops/${sop.id}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: sop.title })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // The inline edit panel labels its inputs as Title and Description.
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('lets the user reorder, edit, add, and delete steps in edit mode', async () => {
    const sop = MOCK_SOPS[0];
    renderAt(`/sops/${sop.id}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: sop.title })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Step controls are labelled by aria-label so they're discoverable in tests.
    expect(screen.getAllByLabelText(/step \d+ title/i).length).toBe(sop.steps.length);

    // Edit step 1 title.
    const firstTitle = screen.getByLabelText(/step 1 title/i);
    fireEvent.change(firstTitle, { target: { value: 'Renamed first step' } });
    expect((firstTitle as HTMLInputElement).value).toBe('Renamed first step');

    // Add a new step.
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getAllByLabelText(/step \d+ title/i).length).toBe(sop.steps.length + 1);

    // Move step 2 up.
    const moveUpButtons = screen.getAllByLabelText(/move step \d+ up/i);
    fireEvent.click(moveUpButtons[1]);

    // Delete the new last step.
    const deleteButtons = screen.getAllByLabelText(/delete step/i);
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    expect(screen.getAllByLabelText(/step \d+ title/i).length).toBe(sop.steps.length);
  });
});
