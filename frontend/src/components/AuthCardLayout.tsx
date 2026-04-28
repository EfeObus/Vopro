import type { ReactNode } from 'react';

interface AuthCardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthCardLayout({ title, subtitle, children, footer }: AuthCardLayoutProps) {
  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-ink-100 shadow-soft p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="size-9 rounded-lg bg-brand-600 grid place-items-center">
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8 L12 18 L19 6" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-ink-900 leading-tight">{title}</div>
            {subtitle && <div className="text-xs text-ink-400">{subtitle}</div>}
          </div>
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-xs text-ink-500">{footer}</div>}
      </div>
    </div>
  );
}
