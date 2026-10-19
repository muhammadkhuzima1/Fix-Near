import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { store } from './services/store';
import { SupabaseService } from './services/supabaseService';
import { getSupabaseClient } from './lib/supabaseClient';
import { ServiceRequest, User, NotificationItem, TechnicianProfile, UserRole } from './types';

// Common layout components
import { AppSidebar } from './components/layout/AppSidebar';
import { AppTopBar } from './components/layout/AppTopBar';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { AuthView } from './components/auth/AuthView';
import { PublicHomepage } from './components/home/PublicHomepage';

// Customer components
import { CustomerDashboard } from './components/customer/CustomerDashboard';
import { CustomerRequestList } from './components/customer/CustomerRequestList';
import { CustomerRequestDetail } from './components/customer/CustomerRequestDetail';
import { CreateRequestModal } from './components/customer/CreateRequestModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Technician components
import { TechnicianDashboard } from './components/technician/TechnicianDashboard';
import { TechnicianJobsList } from './components/technician/TechnicianJobsList';
import { TechnicianJobDetailModal } from './components/technician/TechnicianJobDetailModal';

// Manager components
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerRequestsList } from './components/manager/ManagerRequestsList';
import { ManagerRequestDetailModal } from './components/manager/ManagerRequestDetailModal';
import { ManagerTechniciansList } from './components/manager/ManagerTechniciansList';
import { ManagerCustomersList } from './components/manager/ManagerCustomersList';
import { ManagerAuditLogs } from './components/manager/ManagerAuditLogs';
import { ManagerCreateTechnicianModal } from './components/manager/ManagerCreateTechnicianModal';
import { ManagerUsersList } from './components/manager/ManagerUsersList';

function MainApp() {
  const { currentUser, role, isSupabaseActive, authLoading } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [publicView, setPublicView] = useState<'home' | 'auth' | 'app'>('home');
  const [authPortal, setAuthPortal] = useState<UserRole>('customer');
  const [authCustomerMode, setAuthCustomerMode] = useState<'signin' | 'signup'>('signin');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [technicianProfiles, setTechnicianProfiles] = useState<TechnicianProfile[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isCreateTechOpen, setIsCreateTechOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const getPageTitle = () => {
    if (role === 'customer') {
      if (currentTab === 'requests') return 'My Service Requests';
      return 'Customer Operations Portal';
    }
    if (role === 'technician') {
      if (currentTab === 'assigned_jobs') return 'Jobs Awaiting Acceptance';
      if (currentTab === 'active_jobs') return 'Active Dispatches';
      if (currentTab === 'history') return 'Completed Service History';
      return 'Technician Work Console';
    }
    if (role === 'manager') {
      if (currentTab === 'requests') return 'Service Dispatches';
      if (currentTab === 'users') return 'Users & Access Control';
      if (currentTab === 'technicians') return 'Field Technicians Directory';
      if (currentTab === 'customers') return 'Customer Accounts Directory';
      if (currentTab === 'audit') return 'System Audit Trail';
      return 'Central Operations Overview';
    }
    return 'FixNear';
  };

  // Switch to app view whenever a user signs in
  useEffect(() => {
    if (currentUser) {
      setPublicView('app');
    }
  }, [currentUser]);

  // Sync with store and Supabase
  const refreshData = useCallback(async () => {
    if (isSupabaseActive) {
      try {
        const [fetchedRequests, allUsers, techProfs] = await Promise.all([
          SupabaseService.fetchServiceRequests(),
          SupabaseService.fetchAllUsers(),
          SupabaseService.fetchTechnicianProfiles(),
        ]);
        setRequests(fetchedRequests);
        setUsers(allUsers);
        setTechnicianProfiles(techProfs);

        if (currentUser) {
          const notes = await SupabaseService.fetchNotifications(currentUser.id);
          setNotifications(notes);
        }
      } catch (e) {
        console.error('Error fetching Supabase data:', e);
      }
    } else {
      setRequests(store.getRequests());
      setUsers(store.getUsers());
      setTechnicianProfiles(store.getTechnicianProfiles());
      if (currentUser) {
        setNotifications(store.getNotifications(currentUser.id));
      }
    }
  }, [isSupabaseActive, currentUser?.id]);

  useEffect(() => {
    refreshData();
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return unsubscribe;
  }, [refreshData]);

  // Realtime subscription for Supabase
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseActive) return;

    const channel = client
      .channel('fixnear-live-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        refreshData();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isSupabaseActive, refreshData]);

  // Keep selectedRequest fresh if updated in list
  useEffect(() => {
    if (selectedRequest) {
      const updated = requests.find((r) => r.id === selectedRequest.id);
      if (updated) setSelectedRequest(updated);
    }
  }, [requests, selectedRequest?.id]);

  // Reset tab when role changes
  useEffect(() => {
    setCurrentTab('dashboard');
    setSelectedRequest(null);
  }, [role]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-medium tracking-wide">Initializing FixNear Portal...</div>
        </div>
      </div>
    );
  }

  // Unauthenticated view
  if (!currentUser) {
    if (publicView === 'auth') {
      return (
        <AuthView
          initialPortal={authPortal}
          initialCustomerMode={authCustomerMode}
          onBackToHome={() => setPublicView('home')}
        />
      );
    }
    return (
      <PublicHomepage
        onNavigateToAuth={(portal = 'customer', mode = 'signin') => {
          setAuthPortal(portal);
          setAuthCustomerMode(mode);
          setPublicView('auth');
        }}
      />
    );
  }

  // If authenticated user chose to view the public homepage
  if (publicView === 'home') {
    return (
      <PublicHomepage
        onNavigateToAuth={(_portal, _mode) => {
          setPublicView('app');
        }}
        onGoToDashboard={() => setPublicView('app')}
        onRequestService={() => {
          setPublicView('app');
          if (role === 'customer') {
            setIsNewRequestOpen(true);
          }
        }}
      />
    );
  }

  // Filter requests according to role
  const roleRequests = requests.filter((r) => {
    if (role === 'customer') {
      return r.customerId === currentUser.id;
    }
    if (role === 'technician') {
      return r.assignedTechnicianId === currentUser.id;
    }
    if (role === 'manager') {
      return true; // manager sees all
    }
    return false;
  });

  const technicians = users.filter((u) => u.role === 'technician');
  const customers = users.filter((u) => u.role === 'customer');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSelectRequestById = (requestId: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      setSelectedRequest(req);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F2421] selection:bg-[#143628] selection:text-white flex flex-col font-sans w-full max-w-full overflow-x-hidden box-border">
      {/* Deep Forest-Green Sidebar (Desktop persistent + Mobile slide-out drawer) */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'new_request') {
            setIsNewRequestOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        onViewPublicHome={() => setPublicView('home')}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadNotificationsCount={unreadCount}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Workspace (shifted for sidebar on lg+) */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <AppTopBar
          pageTitle={getPageTitle()}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadNotificationsCount={unreadCount}
          onViewPublicHome={() => setPublicView('home')}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 box-border">
        {/* ========================================================= */}
        {/* CUSTOMER PORTAL */}
        {/* ========================================================= */}
        {role === 'customer' && (
          <div className="space-y-4">
            {currentTab === 'dashboard' && (
              <CustomerDashboard
                requests={roleRequests}
                onOpenNewRequest={() => setIsNewRequestOpen(true)}
                onSelectRequest={(req) => setSelectedRequest(req)}
                onViewAllRequests={() => setCurrentTab('requests')}
              />
            )}

            {currentTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">My Service Requests</h1>
                  <button
                    onClick={() => setIsNewRequestOpen(true)}
                    className="px-3 sm:px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    + Request Service
                  </button>
                </div>
                <CustomerRequestList
                  requests={roleRequests}
                  onSelectRequest={(req) => setSelectedRequest(req)}
                  onOpenNewRequest={() => setIsNewRequestOpen(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TECHNICIAN PORTAL */}
        {/* ========================================================= */}
        {role === 'technician' && (
          <div className="space-y-4">
            {currentTab === 'dashboard' && (
              <TechnicianDashboard
                requests={roleRequests}
                onSelectRequest={(req) => setSelectedRequest(req)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onRefresh={refreshData}
              />
            )}

            {currentTab === 'assigned_jobs' && (
              <div className="space-y-4">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">Jobs Awaiting Acceptance</h1>
                <TechnicianJobsList
                  requests={roleRequests}
                  defaultFilter="assigned"
                  onSelectRequest={(req) => setSelectedRequest(req)}
                />
              </div>
            )}

            {currentTab === 'active_jobs' && (
              <div className="space-y-4">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">Active Dispatches</h1>
                <TechnicianJobsList
                  requests={roleRequests}
                  defaultFilter="active"
                  onSelectRequest={(req) => setSelectedRequest(req)}
                />
              </div>
            )}

            {currentTab === 'history' && (
              <div className="space-y-4">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">Completed Service History</h1>
                <TechnicianJobsList
                  requests={roleRequests}
                  defaultFilter="completed"
                  onSelectRequest={(req) => setSelectedRequest(req)}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* OPERATIONS MANAGER PORTAL */}
        {/* ========================================================= */}
        {role === 'manager' && (
          <div className="space-y-4">
            {currentTab === 'dashboard' && (
              <ManagerDashboard
                requests={requests}
                technicians={technicians}
                customers={customers}
                technicianProfiles={technicianProfiles}
                onSelectRequest={(req) => setSelectedRequest(req)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onOpenCreateTech={() => setIsCreateTechOpen(true)}
              />
            )}

            {currentTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">Service Dispatches</h1>
                </div>
                <ManagerRequestsList
                  requests={requests}
                  onSelectRequest={(req) => setSelectedRequest(req)}
                  onQuickApprove={async (req) => {
                    await SupabaseService.approveServiceRequest(req.id, currentUser);
                    showToast(`Approved ${req.ticketNumber}. AI evaluating technicians...`, 'success');
                    await SupabaseService.autoAssignPendingRequests();
                    refreshData();
                  }}
                />
              </div>
            )}

            {currentTab === 'users' && (
              <div className="space-y-4">
                <ManagerUsersList
                  users={users}
                  requests={requests}
                  technicianProfiles={technicianProfiles}
                  onRefresh={refreshData}
                />
              </div>
            )}

            {currentTab === 'technicians' && (
              <div className="space-y-4">
                <ManagerTechniciansList
                  technicians={technicians}
                  requests={requests}
                  technicianProfiles={technicianProfiles}
                  onOpenCreateTech={() => setIsCreateTechOpen(true)}
                  onRefresh={refreshData}
                />
              </div>
            )}

            {currentTab === 'customers' && (
              <div className="space-y-4">
                <ManagerCustomersList
                  customers={customers}
                  requests={requests}
                  onRefresh={refreshData}
                />
              </div>
            )}

            {currentTab === 'audit' && (
              <div className="space-y-4">
                <ManagerAuditLogs />
              </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* Role-Specific Request Detail Modals */}
      {selectedRequest && role === 'customer' && (
        <CustomerRequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRefresh={refreshData}
        />
      )}

      {selectedRequest && role === 'technician' && (
        <TechnicianJobDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRefresh={refreshData}
        />
      )}

      {selectedRequest && role === 'manager' && (
        <ManagerRequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRefresh={refreshData}
        />
      )}

      {/* New Request Modal for Customer */}
      {isNewRequestOpen && (
        <CreateRequestModal
          isOpen={isNewRequestOpen}
          onClose={() => setIsNewRequestOpen(false)}
          onSuccess={(reqId) => {
            refreshData();
            const created = requests.find((r) => r.id === reqId);
            if (created) setSelectedRequest(created);
          }}
        />
      )}

      {/* Create Technician Modal for Manager */}
      {isCreateTechOpen && (
        <ManagerCreateTechnicianModal
          isOpen={isCreateTechOpen}
          onClose={() => setIsCreateTechOpen(false)}
          onSuccess={refreshData}
        />
      )}

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onSelectRequest={handleSelectRequestById}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
