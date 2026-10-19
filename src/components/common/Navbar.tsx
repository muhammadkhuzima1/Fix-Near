import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Menu, X, LogOut, ShieldCheck, Wrench, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onViewPublicHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNotifications,
  unreadNotificationsCount,
  onViewPublicHome,
}) => {
  const { currentUser, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define nav links strictly per role
  const getNavLinks = () => {
    if (role === 'customer') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'requests', label: 'My Requests' },
        { id: 'new_request', label: '+ Request Service' },
      ];
    }
    if (role === 'technician') {
      return [
        { id: 'dashboard', label: 'Work Dashboard' },
        { id: 'assigned_jobs', label: 'Assigned Jobs' },
        { id: 'active_jobs', label: 'Active Jobs' },
        { id: 'history', label: 'Job History' },
      ];
    }
    if (role === 'manager') {
      return [
        { id: 'dashboard', label: 'Overview & KPIs' },
        { id: 'requests', label: 'Dispatches' },
        { id: 'users', label: 'Users & Roles' },
        { id: 'technicians', label: 'Technicians' },
        { id: 'customers', label: 'Customers' },
        { id: 'audit', label: 'Audit Trail' },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  const getRoleLabel = () => {
    if (role === 'manager') return 'Operations Manager';
    if (role === 'technician') return 'Field Technician';
    if (role === 'customer') return 'Customer Account';
    return '';
  };

  const getRoleIcon = () => {
    if (role === 'manager') return <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    if (role === 'technician') return <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    return <UserIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 w-full max-w-full overflow-x-hidden box-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5 focus:outline-none shrink-0 cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block shrink-0"></span>
              <span>FixNear</span>
            </button>

            {/* Quiet role indicator without garish pills */}
            {currentUser && (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 font-medium pl-2 border-l border-slate-200 truncate">
                {getRoleIcon()}
                <span className="truncate">{getRoleLabel()}</span>
              </span>
            )}
          </div>

          {/* Zone 2: Clean text navigation links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              const isHighlight = link.id === 'new_request';
              return (
                <button
                  key={link.id}
                  onClick={() => onSelectTab(link.id)}
                  className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    isHighlight
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary actions & account */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {onViewPublicHome && (
              <button
                onClick={onViewPublicHome}
                className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                title="View FixNear Public Landing Page"
              >
                <span>Public Site</span>
              </button>
            )}

            {/* Notifications button */}
            <button
              onClick={onOpenNotifications}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* User profile / Logout */}
            <div className="flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block max-w-[140px] truncate">
                <div className="text-xs font-semibold text-slate-900 leading-tight truncate">
                  {currentUser?.fullName}
                </div>
                <div className="text-[11px] text-slate-400 font-mono leading-tight truncate">
                  {currentUser?.email}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  onSelectTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  currentTab === link.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </button>
            ))}
            {onViewPublicHome && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onViewPublicHome();
                }}
                className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                View Public Landing Page
              </button>
            )}
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-md flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
