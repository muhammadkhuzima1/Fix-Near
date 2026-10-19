import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Clock,
  CheckCircle2,
  Users,
  UserCheck,
  History,
  PlusCircle,
  Bell,
  LogOut,
  Globe,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';

interface AppSidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onViewPublicHome?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNotifications,
  unreadNotificationsCount,
  onViewPublicHome,
  mobileOpen,
  onCloseMobile,
}) => {
  const { currentUser, role, logout } = useAuth();

  const getNavLinks = () => {
    if (role === 'customer') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'requests', label: 'My Requests', icon: ClipboardList },
        { id: 'new_request', label: 'Request Service', icon: PlusCircle, isCta: true },
      ];
    }
    if (role === 'technician') {
      return [
        { id: 'dashboard', label: 'Work Dashboard', icon: LayoutDashboard },
        { id: 'assigned_jobs', label: 'Assigned Jobs', icon: Clock },
        { id: 'active_jobs', label: 'Active Jobs', icon: Wrench },
        { id: 'history', label: 'Job History', icon: CheckCircle2 },
      ];
    }
    if (role === 'manager') {
      return [
        { id: 'dashboard', label: 'Overview & KPIs', icon: LayoutDashboard },
        { id: 'requests', label: 'Dispatches', icon: ClipboardList },
        { id: 'users', label: 'Users & Roles', icon: Users },
        { id: 'technicians', label: 'Technicians', icon: Wrench },
        { id: 'customers', label: 'Customers', icon: UserCheck },
        { id: 'audit', label: 'Audit Trail', icon: History },
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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#122E22] text-[#FDFBF7] border-r border-[#1B4332] select-none">
      {/* Brand & Header */}
      <div className="p-5 sm:p-6 border-b border-[#1B4332] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] text-[#122E22] flex items-center justify-center font-serif font-bold text-lg shadow-xs">
            F
          </div>
          <div>
            <div className="font-serif font-bold text-xl tracking-tight text-[#FAF8F5]">
              FixNear
            </div>
            <div className="text-[10px] font-sans uppercase tracking-widest text-[#A3C9B6]">
              Operations Portal
            </div>
          </div>
        </div>

        {/* Close button on mobile */}
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-[#A3C9B6] hover:text-white hover:bg-[#1B4332] lg:hidden cursor-pointer"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User Identity Pill */}
      <div className="px-5 py-4 border-b border-[#1B4332]/70 bg-[#0E251B]/40">
        <div className="text-xs text-[#A3C9B6] uppercase tracking-wider font-semibold">
          Signed In As
        </div>
        <div className="text-sm font-semibold text-[#FAF8F5] truncate mt-0.5">
          {currentUser?.fullName || 'User'}
        </div>
        <div className="text-xs text-[#C2DDD0] flex items-center gap-1.5 mt-1">
          {role === 'manager' && <ShieldCheck className="w-3.5 h-3.5 text-[#52B788]" />}
          {role === 'technician' && <Wrench className="w-3.5 h-3.5 text-[#E7C169]" />}
          {role === 'customer' && <UserIcon className="w-3.5 h-3.5 text-[#74C69D]" />}
          <span className="truncate">{getRoleLabel()}</span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-[#8FB9A3] uppercase tracking-wider">
          Menu
        </div>
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentTab === link.id;

          if (link.isCta) {
            return (
              <button
                key={link.id}
                onClick={() => {
                  onSelectTab(link.id);
                  onCloseMobile();
                }}
                className="w-full mt-3 px-3.5 py-2.5 bg-[#FAF8F5] hover:bg-white text-[#122E22] rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all shadow-xs cursor-pointer group"
              >
                <Icon className="w-4 h-4 text-[#122E22] group-hover:scale-105 transition-transform" />
                <span className="truncate">{link.label}</span>
              </button>
            );
          }

          return (
            <button
              key={link.id}
              onClick={() => {
                onSelectTab(link.id);
                onCloseMobile();
              }}
              className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-3 transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#1D4A37] text-white font-semibold shadow-xs'
                  : 'text-[#C2DDD0] hover:text-white hover:bg-[#183D2D]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#52B788]' : 'text-[#8FB9A3]'}`} />
              <span className="truncate">{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Utility Controls */}
      <div className="p-3 border-t border-[#1B4332] space-y-1 bg-[#0E251B]/30">
        {onViewPublicHome && (
          <button
            onClick={() => {
              onViewPublicHome();
              onCloseMobile();
            }}
            className="w-full px-3.5 py-2 rounded-lg text-xs font-medium text-[#C2DDD0] hover:text-white hover:bg-[#183D2D] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-[#8FB9A3]" />
            <span className="truncate">Public Homepage</span>
          </button>
        )}

        <button
          onClick={() => {
            onOpenNotifications();
            onCloseMobile();
          }}
          className="w-full px-3.5 py-2 rounded-lg text-xs font-medium text-[#C2DDD0] hover:text-white hover:bg-[#183D2D] flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Bell className="w-4 h-4 text-[#8FB9A3]" />
            <span className="truncate">Notifications</span>
          </div>
          {unreadNotificationsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#E63946] text-white rounded-full">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            onCloseMobile();
            logout();
          }}
          className="w-full px-3.5 py-2 rounded-lg text-xs font-medium text-[#FFB4A2] hover:text-white hover:bg-[#5C1D24]/40 flex items-center gap-2.5 transition-colors cursor-pointer mt-1"
        >
          <LogOut className="w-4 h-4 text-[#E57373]" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer Pane */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex-1 z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
