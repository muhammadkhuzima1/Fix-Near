import React, { useState, useEffect } from 'react';
import { User, TechnicianProfile, ServiceRequest, ServiceCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import { EmptyState } from '../common/EmptyState';
import { ManagerEditRoleModal } from './ManagerEditRoleModal';
import { ManagerRemoveTechnicianModal } from './ManagerRemoveTechnicianModal';
import { ManagerRemoveTechnicianRoleModal } from './ManagerRemoveTechnicianRoleModal';
import {
  Wrench,
  Plus,
  Star,
  Phone,
  Mail,
  Award,
  ArrowRightLeft,
  UserX,
  UserMinus,
  Edit3,
  Check,
  X,
  Clock,
  DollarSign,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  formatHourlyPrice,
  formatHourlyRate,
  WORKING_HOURS_DISPLAY,
  DEFAULT_CATEGORY_RATES,
} from '../../utils/currency';

interface ManagerTechniciansListProps {
  technicians: User[];
  requests: ServiceRequest[];
  technicianProfiles?: TechnicianProfile[];
  onOpenCreateTech: () => void;
  onRefresh: () => void | Promise<void>;
}

const SERVICE_CATEGORY_LABELS: { id: ServiceCategory; label: string }[] = [
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'hvac', label: 'AC & HVAC' },
  { id: 'appliance', label: 'Appliance Repair' },
];

export const ManagerTechniciansList: React.FC<ManagerTechniciansListProps> = ({
  technicians,
  requests,
  technicianProfiles,
  onOpenCreateTech,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [selectedTechForRoleRemoval, setSelectedTechForRoleRemoval] = useState<User | null>(null);
  const [selectedTechForRoleEdit, setSelectedTechForRoleEdit] = useState<User | null>(null);
  const [selectedTechForRemoval, setSelectedTechForRemoval] = useState<User | null>(null);

  // Individual Technician Fee Editing State
  const [editingFeeTechId, setEditingFeeTechId] = useState<string | null>(null);
  const [feeInputValue, setFeeInputValue] = useState<string>('');
  const [feeError, setFeeError] = useState<string | null>(null);
  const [savingFeeTechId, setSavingFeeTechId] = useState<string | null>(null);

  // Service Category Price Management State
  const [categoryRates, setCategoryRates] = useState<Record<ServiceCategory, number>>(() =>
    store.getServiceCategoryRates()
  );
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryRateInput, setCategoryRateInput] = useState<string>('');
  const [categoryRateError, setCategoryRateError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<ServiceCategory | null>(null);

  useEffect(() => {
    SupabaseService.fetchServiceCategoryRates()
      .then((rates) => setCategoryRates(rates))
      .catch(() => {});
  }, [technicianProfiles]);

  const handleStartEditTechFee = (techId: string, currentRate?: number) => {
    setEditingFeeTechId(techId);
    setFeeInputValue(String(currentRate && currentRate > 0 ? currentRate : 2000));
    setFeeError(null);
  };

  const handleCancelEditTechFee = () => {
    setEditingFeeTechId(null);
    setFeeInputValue('');
    setFeeError(null);
  };

  const handleSaveTechFee = async (tech: User) => {
    if (!currentUser || currentUser.role !== 'manager') {
      setFeeError('Only authenticated Managers can edit technician fees.');
      return;
    }

    const parsed = Number(feeInputValue);
    if (!Number.isFinite(parsed) || parsed < 100 || parsed > 500000) {
      setFeeError('Enter a valid hourly fee between PKR 100 and PKR 500,000.');
      return;
    }

    setSavingFeeTechId(tech.id);
    setFeeError(null);

    try {
      const res = await SupabaseService.updateTechnicianFee(
        tech.id,
        { hourlyRate: Math.round(parsed) },
        currentUser
      );
      if (res.success) {
        showToast(
          `Updated ${tech.fullName}'s fee to ${formatHourlyRate(Math.round(parsed))}.`,
          'success'
        );
        setEditingFeeTechId(null);
        const updatedRates = await SupabaseService.fetchServiceCategoryRates();
        setCategoryRates(updatedRates);
        await onRefresh();
      } else {
        setFeeError(res.error || 'Failed to save technician fee to Supabase.');
      }
    } catch (err: any) {
      setFeeError(err.message || 'Unexpected error saving technician fee.');
    } finally {
      setSavingFeeTechId(null);
    }
  };

  const handleStartEditCategoryRate = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setCategoryRateInput(String(categoryRates[cat] || DEFAULT_CATEGORY_RATES[cat] || 2000));
    setCategoryRateError(null);
  };

  const handleSaveCategoryRate = async (cat: ServiceCategory, label: string) => {
    if (!currentUser || currentUser.role !== 'manager') {
      setCategoryRateError('Only authenticated Managers can update service prices.');
      return;
    }

    const parsed = Number(categoryRateInput);
    if (!Number.isFinite(parsed) || parsed < 100 || parsed > 500000) {
      setCategoryRateError('Enter a valid rate between PKR 100 and PKR 500,000.');
      return;
    }

    setSavingCategory(cat);
    setCategoryRateError(null);

    try {
      const res = await SupabaseService.updateServiceCategoryRates(
        { [cat]: Math.round(parsed) },
        currentUser,
        true
      );
      if (res.success) {
        if (res.rates) setCategoryRates(res.rates);
        showToast(
          `Updated ${label} standard rate to ${formatHourlyRate(Math.round(parsed))} and synced in Supabase.`,
          'success'
        );
        setEditingCategory(null);
        await onRefresh();
      } else {
        setCategoryRateError(res.error || 'Failed to update service category price.');
      }
    } catch (err: any) {
      setCategoryRateError(err.message || 'Failed to save service category price.');
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full overflow-x-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              Field Technicians & Fee Management
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#143628] bg-[#FAF8F5] px-2.5 py-0.5 rounded border border-[#E8E2D8]">
              <Clock className="w-3 h-3" />
              <span>{WORKING_HOURS_DISPLAY}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Manage authorized technician accounts, individual technician hourly fees, and standard service category prices (PKR)
          </p>
        </div>

        <button
          onClick={onOpenCreateTech}
          className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold bg-[#143628] hover:bg-[#1B4332] text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Technician</span>
        </button>
      </div>

      {/* Manager Service Category Prices & Standard Hourly Fees Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#143628] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#143628]" />
              <span>Standard Service Category Rates (PKR / Hour)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Updating a category rate syncs matching specialist technicians in Supabase and updates prices across the homepage and new service requests.
            </p>
          </div>
        </div>

        {categoryRateError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{categoryRateError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SERVICE_CATEGORY_LABELS.map(({ id, label }) => {
            const currentRate = categoryRates[id] || DEFAULT_CATEGORY_RATES[id] || 2000;
            const isEditing = editingCategory === id;
            const isSaving = savingCategory === id;

            return (
              <div
                key={id}
                className="p-3.5 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#143628]">{label}</span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStartEditCategoryRate(id)}
                      className="text-[11px] font-semibold text-[#143628] hover:bg-[#EAE4D9] px-2 py-0.5 rounded border border-[#D8CFBE] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Price</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-600">PKR</span>
                      <input
                        type="number"
                        min={100}
                        max={500000}
                        step={50}
                        value={categoryRateInput}
                        onChange={(e) => setCategoryRateInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#143628]"
                        placeholder="e.g. 2000"
                      />
                      <span className="text-[11px] text-slate-500">/hr</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryRateError(null);
                        }}
                        disabled={isSaving}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCategoryRate(id, label)}
                        disabled={isSaving}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#143628] hover:bg-[#1B4332] rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-mono font-bold text-[#143628]">
                    {formatHourlyRate(currentRate)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
              technicianProfiles?.find((p) => p.id === tech.id || p.userId === tech.id) ||
              store.getTechnicianProfile(tech.id);
            const activeJobs = requests.filter(
              (r) =>
                r.assignedTechnicianId === tech.id &&
                ['assigned', 'accepted', 'in_progress'].includes(r.status)
            );
            const isEditingThisTechFee = editingFeeTechId === tech.id;
            const isSavingThisTechFee = savingFeeTechId === tech.id;

            return (
              <div
                key={tech.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-xs hover:border-slate-300 transition-colors min-w-0 flex flex-col justify-between"
              >
                <div className="space-y-3 sm:space-y-4">
                  {/* Tech Top */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#143628] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
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

                  {/* Contact info & Working Hours */}
                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2 font-mono truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{tech.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{tech.email}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#143628] truncate">
                      <Clock className="w-3.5 h-3.5 text-[#143628] shrink-0" />
                      <span className="truncate">{WORKING_HOURS_DISPLAY}</span>
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

                  {/* Technician Fee Management Section */}
                  <div className="p-3 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Technician Hourly Fee
                        </div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-[#143628]">
                          {formatHourlyPrice(profile?.hourlyRate, 2000)}
                        </div>
                      </div>
                      {!isEditingThisTechFee && (
                        <button
                          type="button"
                          onClick={() => handleStartEditTechFee(tech.id, profile?.hourlyRate)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#143628] bg-white hover:bg-[#EAE4D9] border border-[#D8CFBE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Fee</span>
                        </button>
                      )}
                    </div>

                    {isEditingThisTechFee && (
                      <div className="pt-2 border-t border-[#E8E2D8] space-y-2">
                        {feeError && (
                          <div className="text-[11px] text-rose-600 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{feeError}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-600">PKR</span>
                          <input
                            type="number"
                            min={100}
                            max={500000}
                            step={50}
                            value={feeInputValue}
                            onChange={(e) => setFeeInputValue(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#143628]"
                            placeholder="Hourly fee in PKR"
                          />
                          <span className="text-xs text-slate-500 font-mono">/hr</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelEditTechFee}
                            disabled={isSavingThisTechFee}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveTechFee(tech)}
                            disabled={isSavingThisTechFee}
                            className="px-3 py-1 text-xs font-semibold text-white bg-[#143628] hover:bg-[#1B4332] rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            {isSavingThisTechFee ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Save Fee</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role actions */}
                <div className="flex items-center justify-end text-[11px] text-slate-500 border-t border-slate-100 pt-2.5 gap-1.5 flex-wrap">
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
