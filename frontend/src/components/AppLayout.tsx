import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Building2,
  Plug,
  Settings,
  Sparkles,
  LogOut,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/auth/AuthContext';
import CaptureStatusCard from '@/components/CaptureStatusCard';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Activity;
  end?: boolean;
};

const NAV_BASE: NavItem[] = [
  { to: '/', label: 'Overview', icon: Activity, end: true },
  { to: '/sops', label: 'SOPs', icon: BookOpen },
  { to: '/workflows', label: 'Detected workflows', icon: Sparkles },
  { to: '/bottlenecks', label: 'Bottlenecks', icon: Timer },
  { to: '/integrations', label: 'Integrations', icon: Plug },
];

const NAV_ADMIN: NavItem = { to: '/organization', label: 'Organization', icon: Building2 };
const NAV_SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: Settings };

export default function AppLayout() {
  const { user } = useAuth();
  const navItems = [
    ...NAV_BASE,
    ...(user?.role === 'admin' ? [NAV_ADMIN] : []),
    NAV_SETTINGS,
  ];

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
          {navItems.map((item) => (
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

        <UserCard />
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

function UserCard() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="m-3 p-3 rounded-lg border border-ink-100 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-900 truncate">{user.name}</div>
          <div className="text-xs text-ink-400 truncate">{user.email}</div>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          onClick={logout}
          className="ml-auto p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-50"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

