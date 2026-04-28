import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AcceptInvitationPage from '@/pages/AcceptInvitationPage';
import { AuthProvider } from '@/auth/AuthContext';

function renderAt(path: string, element: React.ReactElement, routePattern: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePattern} element={element} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  it('renders the email form and a back-to-sign-in link', () => {
    renderAt('/forgot', <ForgotPasswordPage />, '/forgot');
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
  });

  it('shows the success state after submitting an email (mock mode)', async () => {
    renderAt('/forgot', <ForgotPasswordPage />, '/forgot');
    fireEvent.change(screen.getByPlaceholderText(/you@example/i), {
      target: { value: 'me@vopro.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/me@vopro.local/)).toBeInTheDocument();
      expect(screen.getByText(/reset link is on its way/i)).toBeInTheDocument();
    });
  });
});

describe('ResetPasswordPage', () => {
  it('renders the new-password form when given a token in the URL', () => {
    renderAt('/reset/abc123', <ResetPasswordPage />, '/reset/:token');
    expect(screen.getByText('Choose a new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('rejects passwords shorter than 12 characters with an inline error', async () => {
    renderAt('/reset/abc123', <ResetPasswordPage />, '/reset/:token');

    const passwordInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    // Two password inputs (new + confirm). Both <12 chars triggers the length check first.
    fireEvent.change(passwordInputs[0], { target: { value: 'short' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'short' } });
    // Bypass HTML5 minLength so we can assert on the inline error path.
    passwordInputs.forEach((el) => el.removeAttribute('minLength'));

    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 12/i);
    });
  });
});

describe('AcceptInvitationPage', () => {
  it('shows a friendly error when the invitation token is missing', async () => {
    // Route pattern doesn't include :token, so useParams() returns undefined.
    renderAt('/invite', <AcceptInvitationPage />, '/invite');
    await waitFor(() => {
      expect(screen.getByText(/invitation unavailable/i)).toBeInTheDocument();
    });
  });

  it('renders the accept form when a token resolves to a preview (mock)', async () => {
    renderAt('/invite/test-token', <AcceptInvitationPage />, '/invite/:token');
    await waitFor(() => {
      expect(screen.getByText(/join /i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /accept and continue/i })).toBeInTheDocument();
  });
});
