import React, { useState } from 'react';
import { User, UserRole, ServiceRequest, TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../common/EmptyState';
import { ManagerEditRoleModal } from './ManagerEditRoleModal';
import { ManagerRemoveTechnicianModal } from './ManagerRemoveTechnicianModal';
import { ManagerRemoveTechnicianRoleModal } from './ManagerRemoveTechnicianRoleModal';
import {
  Users,
  Search,
  ShieldCheck,
  Wrench,
  User as UserIcon,
  Phone,
  Mail,
  Calendar,
  Filter,
  ArrowRightLeft,
  CheckCircle2,
  Sparkles,
  UserX,
  UserMinus,
} from 'lucide-react';
import { formatHourlyPrice } from '../../utils/currency';

interface ManagerUsersListProps {
  users: User[];
  requests: ServiceRequest[];
  technicianProfiles?: TechnicianProfile[];
  onRefresh: () => void;
}

export const ManagerUsersList: React.FC<ManagerUsersListProps> = ({
  users,
  requests,
  technicianProfiles,
  onRefresh,
}) => {
  const { currentUser, isSupabaseActive } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [selectedUserForRoleEdit, setSelectedUserForRoleEdit] = useState<User | null>(null);
  const [selectedTechForRoleRemoval, setSelectedTechForRoleRemoval] = useState<User | null>(null);
  const [selectedTechForRemoval, setSelectedTechForRemoval] = useState<User | null>(null);

  // Compute counts
  const totalCount = users.length;
  const customerCount = users.filter((u) => u.role === 'customer').length;
  const techCount = users.filter((u) => u.role === 'technician').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Manager</span>
          </span>
        );
      case 'technician':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
            <span>Technician</span>
          </span>
        );
      case 'customer':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            <UserIcon className="w-3.5 h-3.5 text-sky-600" />
            <span>Customer</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600">
                Identity & Access Management
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5 truncate">
              User Directory & Role Administration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              View all user profiles and edit roles between Customer, Field Technician, and Operations Manager.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white transition-all min-w-0"
            />
          </div>
        </div>

        {/* Quick KPI Stat Chips & Filter Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-[#143628] text-[#FDFBF7] font-semibold shadow-xs'
                  : 'bg-[#F5F2EB] text-[#526056] hover:bg-[#EAE4D9] hover:text-[#143628]'
              }`}
            >
              All Users ({totalCount})
            </button>
            <button
              onClick={() => setRoleFilter('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                roleFilter === 'customer'
                  ? 'bg-[#143628] text-[#FDFBF7] font-semibold shadow-xs'
                  : 'bg-[#F5F2EB] text-[#526056] hover:bg-[#EAE4D9] hover:text-[#143628]'
              }`}
            >
              Customers ({customerCount})
            </button>
            <button
              onClick={() => setRoleFilter('technician')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                roleFilter === 'technician'
                  ? 'bg-[#143628] text-[#FDFBF7] font-semibold shadow-xs'
                  : 'bg-[#F5F2EB] text-[#526056] hover:bg-[#EAE4D9] hover:text-[#143628]'
              }`}
            >
              Technicians ({techCount})
            </button>
            <button
              onClick={() => setRoleFilter('manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                roleFilter === 'manager'
                  ? 'bg-[#143628] text-[#FDFBF7] font-semibold shadow-xs'
                  : 'bg-[#F5F2EB] text-[#526056] hover:bg-[#EAE4D9] hover:text-[#143628]'
              }`}
            >
              Managers ({managerCount})
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Showing {filteredUsers.length} of {totalCount} profiles
          </div>
        </div>
      </div>

      {/* Users List Container */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No users match your search' : 'No user profiles found'}
          description={
            search
              ? 'Try modifying your search query or clear the filter.'
              : 'Registered profiles from Supabase will appear here.'
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredUsers.map((user) => {
            const isSelf = currentUser?.id === user.id;

            // Extra role details
            const userCustomerReqs = requests.filter((r) => r.customerId === user.id);
            const userTechReqs = requests.filter(
              (r) =>
                r.assignedTechnicianId === user.id &&
                ['assigned', 'accepted', 'in_progress'].includes(r.status)
            );
            const techProfile = technicianProfiles?.find((tp) => tp.userId === user.id);

            return (
              <div
                key={user.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                {/* Left: User Identity */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 uppercase shadow-2xs ${
                      user.role === 'manager'
                        ? 'bg-indigo-900 text-white ring-2 ring-indigo-500/20'
                        : user.role === 'technician'
                        ? 'bg-amber-600 text-white ring-2 ring-amber-500/20'
                        : 'bg-slate-800 text-white ring-2 ring-slate-400/20'
                    }`}
                  >
                    {user.fullName.charAt(0) || 'U'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {user.fullName}
                      </h3>
                      {isSelf && (
                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                          You
                        </span>
                      )}
                      <div className="md:hidden">{getRoleBadge(user.role)}</div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                      <span className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </span>
                      {user.phone && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{user.phone}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-slate-400 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>

                    {/* Role specific metadata */}
                    <div className="mt-1 text-xs text-slate-600">
                      {user.role === 'customer' && (
                        <span>
                          <span className="font-semibold text-slate-800">{userCustomerReqs.length}</span> lifetime service requests
                        </span>
                      )}
                      {user.role === 'technician' && (
                        <span>
                          Specialty:{' '}
                          <span className="font-semibold text-slate-800">
                            {techProfile?.specialty || 'General Field Tech'}
                          </span>{' '}
                          · Rate:{' '}
                          <span className="font-semibold text-emerald-700 font-mono">
                            {formatHourlyPrice(techProfile?.hourlyRate, 2000)}
                          </span>{' '}
                          · <span className="font-semibold text-amber-700">{userTechReqs.length} active jobs</span>
                        </span>
                      )}
                      {user.role === 'manager' && (
                        <span className="text-indigo-600 font-medium">
                          Operations Administrator · Dispatch & Role Authority
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Role Status & Manager Change/Remove Buttons */}
                <div className="flex items-center gap-2 sm:gap-3 self-end md:self-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                  <div className="hidden md:block">{getRoleBadge(user.role)}</div>

                  <div className="flex items-center gap-2 ml-auto md:ml-0 flex-wrap">
                    {user.role === 'technician' && (
                      <button
                        onClick={() => setSelectedTechForRoleRemoval(user)}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-amber-200 hover:border-transparent"
                        title={`Remove technician role for ${user.fullName} and demote to customer`}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Remove Role</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedUserForRoleEdit(user)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title={`Change role for ${user.fullName}`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Edit Role</span>
                    </button>

                    {user.role === 'technician' && (
                      <button
                        onClick={() => setSelectedTechForRemoval(user)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-rose-200 hover:border-transparent"
                        title={`Remove technician ${user.fullName} from platform completely`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dedicated Remove Technician Role Confirmation Modal */}
      <ManagerRemoveTechnicianRoleModal
        technician={selectedTechForRoleRemoval}
        isOpen={Boolean(selectedTechForRoleRemoval)}
        onClose={() => setSelectedTechForRoleRemoval(null)}
        onRefresh={onRefresh}
        requests={requests}
      />

      {/* Role Edit Modal */}
      <ManagerEditRoleModal
        user={selectedUserForRoleEdit}
        isOpen={Boolean(selectedUserForRoleEdit)}
        onClose={() => setSelectedUserForRoleEdit(null)}
        onRefresh={onRefresh}
      />

      {/* Remove Technician Confirmation Modal */}
      <ManagerRemoveTechnicianModal
        technician={selectedTechForRemoval}
        isOpen={Boolean(selectedTechForRemoval)}
        onClose={() => setSelectedTechForRemoval(null)}
        onRefresh={onRefresh}
        requests={requests}
        technicianProfiles={technicianProfiles}
      />
    </div>
  );
};
