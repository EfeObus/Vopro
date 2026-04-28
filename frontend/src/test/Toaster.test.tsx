import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ToasterProvider, useToaster } from '@/components/Toaster';
import { ApiError } from '@/lib/api';

function Pusher({ onReady }: { onReady: (api: ReturnType<typeof useToaster>) => void }): null {
  const api = useToaster();
  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe('Toaster', () => {
  it('renders pushed toasts and dismisses them', () => {
    let captured!: ReturnType<typeof useToaster>;
    render(
      <ToasterProvider>
        <Pusher onReady={(api) => (captured = api)} />
      </ToasterProvider>,
    );

    act(() => {
      captured.push({ tone: 'info', title: 'Hello' });
    });
    expect(screen.getByText('Hello')).toBeInTheDocument();

    const toastId = captured.toasts[0].id;
    act(() => {
      captured.dismiss(toastId);
    });
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('formats ApiError into a friendly title with request id', () => {
    let captured!: ReturnType<typeof useToaster>;
    render(
      <ToasterProvider>
        <Pusher onReady={(api) => (captured = api)} />
      </ToasterProvider>,
    );

    act(() => {
      captured.pushError(
        new ApiError({
          status: 500,
          code: 'internal_error',
          message: 'boom',
          requestId: 'req_xyz',
        }),
      );
    });

    expect(screen.getByText(/server error/i)).toBeInTheDocument();
    expect(screen.getByText(/req_xyz/)).toBeInTheDocument();
  });
});
