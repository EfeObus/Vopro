import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { ApiError } from '@/lib/api';

function Boom({ message = 'kaboom' }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

function ApiBoom(): React.ReactElement {
  throw new ApiError({
    status: 500,
    code: 'internal_error',
    message: 'Server tripped',
    requestId: 'req_abc123',
  });
}

describe('RootErrorBoundary', () => {
  // Suppress noisy React error logs from the boundary catching test errors.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <RootErrorBoundary>
        <div>safe content</div>
      </RootErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders the fallback when a child throws', () => {
    render(
      <RootErrorBoundary>
        <Boom message="render boom" />
      </RootErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/render boom/i)).toBeInTheDocument();
  });

  it('surfaces ApiError code and request id', () => {
    render(
      <RootErrorBoundary>
        <ApiBoom />
      </RootErrorBoundary>,
    );
    expect(screen.getByText(/internal_error/i)).toBeInTheDocument();
    expect(screen.getByText(/req_abc123/)).toBeInTheDocument();
  });

  it('reset clears the error and re-renders children', () => {
    let shouldThrow = true;
    function Toggle(): React.ReactElement {
      if (shouldThrow) throw new Error('initial');
      return <div>recovered</div>;
    }
    render(
      <RootErrorBoundary>
        <Toggle />
      </RootErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('calls onError when the boundary catches', () => {
    const onError = vi.fn();
    render(
      <RootErrorBoundary onError={onError}>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
  });
});
