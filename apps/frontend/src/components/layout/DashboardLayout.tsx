import { useMemo, useState } from 'react';
import type { FocusEvent } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '@/types/users';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ROLE_PERMISSIONS } from '@/constants/permissions';

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
    items: [{ name: 'Dashboard', href: '/' }],
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
    label: 'HR',
    items: [
      { name: 'Employees', href: '/employees', roles: ROLE_PERMISSIONS.EMPLOYEE_DIRECTORY },
      { name: 'EOD Reports', href: '/employees/eod-reports', roles: ROLE_PERMISSIONS.EOD_REPORTS },
      { name: 'Leave Requests', href: '/employees/leave-requests', roles: ROLE_PERMISSIONS.LEAVE_REQUESTS },
      { name: 'Performance Reviews', href: '/employees/performance-reviews', roles: ROLE_PERMISSIONS.PERFORMANCE_REVIEWS },
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
    label: 'Settings',
    items: [
      { name: 'User Management', href: '/settings', roles: ROLE_PERMISSIONS.USER_MANAGEMENT },
      { name: 'Company Policies', href: '/settings/company', roles: ROLE_PERMISSIONS.COMPANY_SETTINGS },
      { name: 'Notification Preferences', href: '/settings/notifications', roles: ROLE_PERMISSIONS.NOTIFICATION_SETTINGS },
      { name: 'Integrations', href: '/settings/integrations', roles: ROLE_PERMISSIONS.INTEGRATIONS },
      { name: 'Holidays', href: '/settings/holidays', roles: ROLE_PERMISSIONS.HOLIDAYS_SETTINGS },
    ],
  },
];

export default function DashboardLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocusTarget = event.relatedTarget as Node | null;

    if (!nextFocusTarget || !event.currentTarget.contains(nextFocusTarget)) {
      setOpenGroup(null);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/auth/login');
  };

  const baseNavLinkClass =
    'inline-flex h-16 items-center px-3 text-sm font-medium text-gray-900 hover:text-blue-600';

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
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-blue-600">D5</span>
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
                        className={`absolute left-0 top-full z-20 mt-0 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none ${
                          isOpen ? 'block' : 'hidden group-hover:block'
                        }`}
                      >
                        <div className="py-1" role="menu">
                          {group.items.map((item) => (
                            <Link
                              key={item.name}
                              to={item.href}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600"
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
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">
                {user?.firstName} {user?.lastName} ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-700 hover:text-blue-600"
              >
                Logout
              </button>
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

