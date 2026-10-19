import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { X, Wrench, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

interface ManagerCreateTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SPECIALTIES = [
  'Plumbing',
  'Electrical',
  'HVAC & Climate Control',
  'Appliance Diagnostics',
  'Carpentry & Framing',
  'General Maintenance & Repairs',
];

export const ManagerCreateTechnicianModal: React.FC<ManagerCreateTechnicianModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createTechnicianByManager, currentUser } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('tech1234');
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [additionalSkills, setAdditionalSkills] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(2000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentUser?.role !== 'manager') {
      setError('Unauthorized. Only managers can provision technician accounts.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !specialty.trim()) {
      setError('Please fill in all required technician account fields.');
      return;
    }

    setLoading(true);

    try {
      const skillsList = additionalSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // CRITICAL: Strictly creates role = 'technician'
      const res = await createTechnicianByManager({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password || 'tech1234',
        specialty: specialty.trim(),
        additionalSkills: skillsList,
        experienceYears: Number(experienceYears) || 0,
        licenseNumber: licenseNumber.trim() || undefined,
        hourlyRate: Number(hourlyRate) || 0,
      });

      if (res.success && res.user) {
        if (res.user.role !== 'technician') {
          setError('CRITICAL: Created user does not have technician role.');
          setLoading(false);
          return;
        }

        showToast(
          `Technician ${res.user.fullName} successfully provisioned with role: TECHNICIAN.`,
          'success'
        );
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to create technician account.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating technician');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-screen px-2 sm:px-4 text-center flex items-center justify-center py-4">
        <div className="relative bg-white text-left rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">Manager Authorization · Staff Provisioning</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 truncate">
                Create New Technician Account
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Explicitly provisions an authorized field technician (<span className="font-mono text-slate-800">role = 'technician'</span>).
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-3.5 sm:space-y-4">
            {/* Role Guarantee Banner */}
            <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs gap-2">
              <span className="text-slate-600">Assigned System Role:</span>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                role: 'technician' (Strict)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Carlos Mendez"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Technician Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@fixnear.internal"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-0199"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Temporary Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="tech1234"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 font-mono min-w-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Specialty *
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                >
                  {SPECIALTIES.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  License / Trade ID
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="LIC-PLM-8842"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 font-mono min-w-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 font-mono min-w-0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hourly Rate (PKR/hour)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-semibold select-none">
                    PKR
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    placeholder="e.g. 2,000"
                    className="w-full pl-12 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 font-mono min-w-0"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Technician rate in Pakistani Rupees (PKR) per hour
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Additional Skills (Comma-separated)
              </label>
              <input
                type="text"
                value={additionalSkills}
                onChange={(e) => setAdditionalSkills(e.target.value)}
                placeholder="Water heaters, PEX repiping, Soldering"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating Technician...' : 'Create Technician Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
