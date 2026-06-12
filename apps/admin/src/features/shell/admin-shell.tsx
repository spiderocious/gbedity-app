import { Logo } from '@gbedity/ui';
import { BarChart3, BookA, FileText, History, LayoutGrid, LogOut, Scale } from '@icons';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';

import { SessionState, useAdminSession } from '../../shared/api/admin-api.ts';
import { authStore } from '../../shared/services/auth-store.ts';
import { ROUTES } from '../../shared/constants/routes.ts';

// Admin app shell: persistent sidebar nav + routed outlet. Guards: on load it re-hydrates the
// session from the stored refresh token (so a reload/deep-link doesn't log the admin out);
// only redirects to /login once that attempt settles as anonymous.
const NAV = [
  { to: ROUTES.METRICS, label: 'Metrics', icon: BarChart3, end: true },
  { to: ROUTES.CONTENT, label: 'Content', icon: FileText, end: false },
  { to: ROUTES.CATALOGUE, label: 'Catalogue', icon: LayoutGrid, end: false },
  { to: ROUTES.WORD_BANK, label: 'Word bank', icon: BookA, end: false },
  { to: ROUTES.HISTORY, label: 'History', icon: History, end: false },
  { to: ROUTES.RUBRIC, label: 'Rubric', icon: Scale, end: false },
] as const;

export function AdminShell() {
  const navigate = useNavigate();
  const session = useAdminSession();

  if (session === SessionState.CHECKING) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      </div>
    );
  }
  if (session === SessionState.ANON) return <Navigate to={ROUTES.LOGIN} replace />;

  function signOut() {
    authStore.clear();
    navigate(ROUTES.LOGIN);
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 flex-shrink-0 flex-col gap-1 border-r border-ink-5 bg-surface px-4 py-6">
        <Link to={ROUTES.METRICS} className="mb-6 flex items-center gap-2 px-2">
          <Logo size="sm" />
          <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Admin</span>
        </Link>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-card px-3 py-[10px] font-sans text-[14px] font-bold ${
                  isActive ? 'bg-action-soft text-action-deep' : 'text-ink-3 hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="mt-auto flex items-center gap-3 rounded-card px-3 py-[10px] font-sans text-[14px] font-bold text-ink-3 hover:bg-canvas hover:text-ink"
        >
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
