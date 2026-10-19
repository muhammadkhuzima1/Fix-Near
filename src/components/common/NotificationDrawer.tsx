import React from 'react';
import { NotificationItem } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import { Bell, CheckCheck, X, AlertCircle, Calendar, Wrench, Info } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onSelectRequest?: (requestId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onSelectRequest,
}) => {
  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    const currentUserId = store.getCurrentUserId();
    if (currentUserId) {
      await SupabaseService.markAllNotificationsRead(currentUserId);
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    await SupabaseService.markNotificationRead(n.id);
    if (n.requestId && onSelectRequest) {
      onSelectRequest(n.requestId);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <Wrench className="w-4 h-4 text-indigo-600" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'status_change':
        return <Calendar className="w-4 h-4 text-sky-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-[calc(100vw-1rem)] sm:max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 truncate">Notifications</h2>
              <span className="text-xs font-mono text-slate-400 shrink-0">({notifications.length})</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {notifications.some((n) => !n.isRead) && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden min-[380px]:inline">Mark read</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 sm:p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !n.isRead ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div className="mt-0.5 p-1.5 sm:p-2 rounded-md bg-slate-100 shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                      {n.message}
                    </p>
                    <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
