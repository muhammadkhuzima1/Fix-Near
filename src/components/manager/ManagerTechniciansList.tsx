import React, { useState } from 'react';
import { User, TechnicianProfile, ServiceRequest } from '../../types';
import { store } from '../../services/store';
import { EmptyState } from '../common/EmptyState';
import { ManagerEditRoleModal } from './ManagerEditRoleModal';
import { ManagerRemoveTechnicianModal } from './ManagerRemoveTechnicianModal';
import { ManagerRemoveTechnicianRoleModal } from './ManagerRemoveTechnicianRoleModal';
import { Wrench, Plus, Star, Phone, Mail, Award, CheckCircle2, ShieldCheck, ArrowRightLeft, UserX, UserMinus } from 'lucide-react';
import { formatHourlyPrice } from '../../utils/currency';

interface ManagerTechniciansListProps {
  technicians: User[];
  requests: ServiceRequest[];
  technicianProfiles?: TechnicianProfile[];
  onOpenCreateTech: () => void;
  onRefresh: () => void;
}

export const ManagerTechniciansList: React.FC<ManagerTechniciansListProps> = ({
  technicians,
  requests,
  technicianProfiles,
  onOpenCreateTech,
  onRefresh,
}) => {
  const [selectedTechForRoleRemoval, setSelectedTechForRoleRemoval] = useState<User | null>(null);
  const [selectedTechForRoleEdit, setSelectedTechForRoleEdit] = useState<User | null>(null);
  const [selectedTechForRemoval, setSelectedTechForRemoval] = useState<User | null>(null);

  return (
    <div className="space-y-3 sm:space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">
            Field Technicians Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Authorized technician accounts (<span className="font-mono text-slate-800">role = 'technician'</span>)
          </p>
        </div>

        <button
          onClick={onOpenCreateTech}
          className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Technician</span>
        </button>
      </div>

      {technicians.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No technicians provisioned yet"
          description="Technician accounts must be created directly by Operations Management. Technicians cannot sign up publicly."
          actionLabel="+ Create First Technician"
          onAction={onOpenCreateTech}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {technicians.map((tech) => {
            const profile =
              technicianProfiles?.find((p) => p.id === tech.id) ||
              store.getTechnicianProfile(tech.id);
            const activeJobs = requests.filter(
              (r) =>
                r.assignedTechnicianId === tech.id &&
                ['assigned', 'accepted', 'in_progress'].includes(r.status)
            );

            return (
              <div
                key={tech.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-xs hover:border-slate-300 transition-colors min-w-0"
              >
                {/* Tech Top */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                      {tech.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{tech.fullName}</h3>
                      <div className="text-xs text-amber-700 font-medium truncate">
                        {profile?.specialty || 'General Field Tech'}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {profile?.status === 'available' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  ) : profile?.status === 'on_job' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      On Job
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Off Duty
                    </span>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 font-mono truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{tech.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{tech.email}</span>
                  </div>
                  {profile?.licenseNumber && (
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 truncate">
                      <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Lic: {profile.licenseNumber}</span>
                    </div>
                  )}
                </div>

                {/* Performance stats */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center font-mono">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-sans uppercase">Rating</div>
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-0.5 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      <span>{profile?.rating?.toFixed(1) ?? '5.0'}</span>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-sans uppercase">Done</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {profile?.completedJobsCount ?? 0}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-sans uppercase">Active</div>
                    <div className="text-xs font-bold text-indigo-700 mt-0.5">
                      {activeJobs.length}
                    </div>
                  </div>
                </div>

                {/* Role badge stamp, Remove Role, Edit Role, and Remove action */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2 font-mono flex-wrap gap-2">
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Rate: {formatHourlyPrice(profile?.hourlyRate, 2000)}
                  </span>
                  <div className="flex items-center gap-1.5 font-sans flex-wrap">
                    <button
                      onClick={() => setSelectedTechForRoleRemoval(tech)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-amber-200 hover:border-transparent"
                      title={`Remove technician role for ${tech.fullName} and demote to customer`}
                    >
                      <UserMinus className="w-3 h-3" />
                      <span>Remove Role</span>
                    </button>
                    <button
                      onClick={() => setSelectedTechForRoleEdit(tech)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title={`Change role for ${tech.fullName}`}
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Edit Role</span>
                    </button>
                    <button
                      onClick={() => setSelectedTechForRemoval(tech)}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-rose-200 hover:border-transparent"
                      title={`Remove ${tech.fullName} from platform completely`}
                    >
                      <UserX className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
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

      {/* Role Change Modal */}
      <ManagerEditRoleModal
        user={selectedTechForRoleEdit}
        isOpen={Boolean(selectedTechForRoleEdit)}
        onClose={() => setSelectedTechForRoleEdit(null)}
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
