import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '@/types/users';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import { autoLogTimerOnLogout } from '@/lib/utils/timer-logout';
import { NotificationsPanel } from './NotificationsPanel';

type NavItem = {
  name: string;
  href: string;
  roles?: UserRole[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/' },
      { name: 'Calendar', href: '/calendar', roles: ROLE_PERMISSIONS.CALENDAR },
    ],
  },
  {
    label: 'CRM',
    items: [
      { name: 'Customers', href: '/crm/customers', roles: ROLE_PERMISSIONS.CRM_CUSTOMERS },
      { name: 'Contacts', href: '/crm/contacts', roles: ROLE_PERMISSIONS.CRM_CONTACTS },
      { name: 'Leads', href: '/crm/leads', roles: ROLE_PERMISSIONS.CRM_LEADS },
      { name: 'Opportunities', href: '/crm/opportunities', roles: ROLE_PERMISSIONS.CRM_OPPORTUNITIES },
      { name: 'Campaigns', href: '/crm/campaigns', roles: ROLE_PERMISSIONS.CRM_CAMPAIGNS },
    ],
  },
  {
    label: 'Recruitment',
    items: [
      { name: 'Candidates', href: '/recruitment/candidates', roles: ROLE_PERMISSIONS.RECRUITMENT },
      { name: 'Positions', href: '/recruitment/positions', roles: ROLE_PERMISSIONS.RECRUITMENT },
    ],
  },
  {
    label: 'Employee',
    items: [
      { name: 'Employees', href: '/employees', roles: ROLE_PERMISSIONS.EMPLOYEE_DIRECTORY },
      { name: 'EOD Reports', href: '/employees/eod-reports', roles: ROLE_PERMISSIONS.EOD_REPORTS },
      { name: 'Leave Requests', href: '/employees/leave-requests', roles: ROLE_PERMISSIONS.LEAVE_REQUESTS },
      { name: 'Performance Reviews', href: '/employees/performance-reviews', roles: ROLE_PERMISSIONS.PERFORMANCE_REVIEWS },
      { name: 'Remote Work', href: '/employees/remote-work', roles: ROLE_PERMISSIONS.REMOTE_WORK },
    ],
  },
  {
    label: 'Finance',
    items: [{ name: 'Invoices', href: '/invoices', roles: ROLE_PERMISSIONS.INVOICES }],
  },
  {
    label: 'Operations',
    items: [{ name: 'Tasks', href: '/tasks', roles: ROLE_PERMISSIONS.TASKS }],
  },
  {
    label: 'Reports',
    items: [{ name: 'Feedback Reports', href: '/reports/feedback-reports', roles: ROLE_PERMISSIONS.FEEDBACK_REPORTS }],
  },
  {
    label: 'Documents',
    items: [{ name: 'Documents', href: '/documents', roles: ROLE_PERMISSIONS.DOCUMENTS }],
  },
  {
    label: 'Settings',
    items: [
      { name: 'User Management', href: '/settings', roles: ROLE_PERMISSIONS.USER_MANAGEMENT },
      { name: 'Company Policies', href: '/settings/company', roles: ROLE_PERMISSIONS.COMPANY_SETTINGS },
      { name: 'Notification Preferences', href: '/settings/notifications', roles: ROLE_PERMISSIONS.NOTIFICATION_SETTINGS },
      { name: 'Appearance', href: '/settings/appearance', roles: ROLE_PERMISSIONS.APPEARANCE_SETTINGS },
      { name: 'Integrations', href: '/settings/integrations', roles: ROLE_PERMISSIONS.INTEGRATIONS },
      { name: 'Holidays', href: '/settings/holidays', roles: ROLE_PERMISSIONS.HOLIDAYS_SETTINGS },
      { name: 'Activity Types', href: '/settings/activity-types', roles: ROLE_PERMISSIONS.ACTIVITY_TYPES },
      { name: 'Gemini Actions', href: '/settings/ai-actions', roles: ROLE_PERMISSIONS.AI_ACTIONS },
      { name: 'Templates', href: '/settings/templates', roles: ROLE_PERMISSIONS.TEMPLATES },
      { name: 'Email Template Config', href: '/settings/email-template-config', roles: ROLE_PERMISSIONS.TEMPLATES },
      { name: 'Template Variables', href: '/settings/template-variables', roles: ROLE_PERMISSIONS.TEMPLATES },
      { name: 'System Export / Import', href: '/settings/system-export', roles: ROLE_PERMISSIONS.SYSTEM_EXPORT },
    ],
  },
];

export default function DashboardLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const handleGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocusTarget = event.relatedTarget as Node | null;

    if (!nextFocusTarget || !event.currentTarget.contains(nextFocusTarget)) {
      setOpenGroup(null);
    }
  };

  const handleLogout = async () => {
    // Auto-log time if timer is running (must be called BEFORE clearAuth to have valid token)
    // Don't await - allow it to run but don't block logout if it fails
    // The function handles errors internally and always clears the timer
    try {
      await autoLogTimerOnLogout();
    } catch (error) {
      // Log but don't block logout
      console.error('[DashboardLayout] Error in auto-log during logout:', error);
    }
    
    clearAuth();
    navigate('/auth/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const baseNavLinkClass =
    'inline-flex h-16 items-center px-3 text-sm font-medium text-foreground transition hover:text-blue-600 dark:hover:text-blue-400';

  const navigationGroups = useMemo(() => {
    const userRole = user?.role;

    return NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles) {
          return true;
        }

        if (!userRole) {
          return false;
        }

        return item.roles.includes(userRole);
      }),
    })).filter((group) => group.items.length > 0);
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation */}
      <nav className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-blue-600">division5</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigationGroups.map((group) => {
                  const isOpen = openGroup === group.label;

                  if (group.items.length === 1) {
                    return (
                      <Link
                        key={group.label}
                        to={group.items[0].href}
                        className={baseNavLinkClass}
                      >
                        {group.label}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={group.label}
                      className="relative group"
                      onMouseEnter={() => setOpenGroup(group.label)}
                      onMouseLeave={() => setOpenGroup(null)}
                      onFocus={() => setOpenGroup(group.label)}
                      onBlur={handleGroupBlur}
                    >
                      <button
                        type="button"
                        className={`${baseNavLinkClass} focus:outline-none`}
                        onClick={() =>
                          setOpenGroup(isOpen ? null : group.label)
                        }
                      >
                        {group.label}
                        <svg
                          className="ml-1 h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      <div
                        className={`absolute left-0 top-full z-20 mt-0 w-48 rounded-md border border-border bg-card shadow-lg focus:outline-none ${
                          isOpen ? 'block' : 'hidden group-hover:block'
                        }`}
                      >
                        <div className="py-1" role="menu">
                          {group.items.map((item) => (
                            <Link
                              key={item.name}
                              to={item.href}
                              className="block px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-blue-600 dark:hover:text-blue-400"
                              role="menuitem"
                              onClick={() => setOpenGroup(null)}
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationsPanel />
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {(user?.firstName?.[0] ?? '').toUpperCase()}
                    {(user?.lastName?.[0] ?? '').toUpperCase()}
                  </span>
                  <span className="hidden text-left sm:flex sm:flex-col">
                    <span className="text-sm text-foreground">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{user?.role}</span>
                  </span>
                  <svg
                    className="h-4 w-4 text-muted-foreground"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div
                  className={`absolute right-0 z-30 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg ${
                    isUserMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                  } transition`}
                >
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="truncate text-xs">{user?.email}</p>
                  </div>
                  <div className="border-t border-border">
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

