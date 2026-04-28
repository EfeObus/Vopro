import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SettingsPage from '@/pages/SettingsPage';
import { AuthProvider } from '@/auth/AuthContext';

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('renders the existing privacy/capture sections', () => {
    renderPage();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Capture')).toBeInTheDocument();
    expect(screen.getByText('On-device masking')).toBeInTheDocument();
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.getByText('Danger zone')).toBeInTheDocument();
  });

  it('renders the GDPR data export and account deletion controls', () => {
    renderPage();
    expect(screen.getByText('Your data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download my data/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('updates the retention label when the slider moves', () => {
    renderPage();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: 60 } });
    expect(screen.getByText('60 days')).toBeInTheDocument();
  });
});
