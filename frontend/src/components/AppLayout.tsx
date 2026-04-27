import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Plug,
  Settings,
  Sparkles,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Overview', icon: Activity, end: true },
  { to: '/sops', label: 'SOPs', icon: BookOpen },
  { to: '/workflows', label: 'Detected workflows', icon: Sparkles },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-ink-50">
      <aside className="w-64 shrink-0 border-r border-ink-100 bg-white flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-ink-100">
          <Logo />
          <div>
            <div className="font-semibold text-ink-900 leading-tight">Vopro</div>
            <div className="text-xs text-ink-400">Auto SOP Generator</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <CaptureStatusCard />
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div className="size-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 grid place-items-center shadow-soft">
      <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8 L12 18 L19 6" />
      </svg>
    </div>
  );
}

function CaptureStatusCard() {
  return (
    <div className="m-3 p-3 rounded-lg border border-ink-100 bg-ink-50">
      <div className="flex items-center gap-2 mb-1">
        <CircleDot className="size-3.5 text-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-ink-700">Capture active</span>
      </div>
      <div className="text-xs text-ink-500">
        Agent · this device · 4 apps opted in
      </div>
      <button className="btn-outline mt-2 w-full justify-center text-xs">Pause capture</button>
    </div>
  );
}
