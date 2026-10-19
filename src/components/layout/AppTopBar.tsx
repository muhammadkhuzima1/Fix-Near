import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, Bell, Globe, LogOut } from 'lucide-react';

interface AppTopBarProps {
  onOpenMobileSidebar: () => void;
  pageTitle: string;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onViewPublicHome?: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({
  onOpenMobileSidebar,
  pageTitle,
  onOpenNotifications,
  unreadNotificationsCount,
  onViewPublicHome,
}) => {
  const { currentUser, role, logout } = useAuth();

  const getRoleLabel = () => {
    if (role === 'manager') return 'Operations Console';
    if (role === 'technician') return 'Field Dispatch';
    if (role === 'customer') return 'Customer Portal';
    return '';
  };

  return (
    <header className="sticky top-0 z-20 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D8] h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Hamburger (mobile) + Page Title (editorial serif) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-2 text-[#143628] hover:bg-[#EAE4D9] rounded-lg lg:hidden cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="font-serif text-lg sm:text-2xl font-bold text-[#143628] truncate">
            {pageTitle}
          </h1>
          <span className="hidden md:inline-block text-xs text-[#69776E] border-l border-[#D5CFC5] pl-2 font-sans">
            {getRoleLabel()}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onViewPublicHome && (
          <button
            onClick={onViewPublicHome}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#4A554E] hover:text-[#143628] px-3 py-1.5 rounded-lg hover:bg-[#EAE4D9] border border-[#DDD5C7] transition-colors cursor-pointer"
            title="View FixNear Public Landing Page"
          >
            <Globe className="w-3.5 h-3.5 text-[#143628]" />
            <span>Public Site</span>
          </button>
        )}

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="p-2 text-[#4A554E] hover:text-[#143628] hover:bg-[#EAE4D9] rounded-lg transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E63946] ring-2 ring-[#FAF8F5]" />
          )}
        </button>

        {/* User Mini Profile / Logout on mobile or desktop */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E8E2D8]">
          <div className="text-right hidden sm:block max-w-[130px] truncate">
            <div className="text-xs font-semibold text-[#143628] truncate">
              {currentUser?.fullName}
            </div>
            <div className="text-[10px] text-[#69776E] capitalize truncate font-mono">
              {role}
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 text-[#69776E] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
