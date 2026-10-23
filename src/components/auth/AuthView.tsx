import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import {
  ShieldCheck,
  Wrench,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface AuthViewProps {
  initialPortal?: UserRole;
  initialCustomerMode?: 'signin' | 'signup';
  onBackToHome?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialPortal = 'customer',
  initialCustomerMode = 'signin',
  onBackToHome,
}) => {
  const { login, registerCustomer } = useAuth();
  const { showToast } = useToast();

  const [activePortal, setActivePortal] = useState<UserRole>(initialPortal);
  const [customerMode, setCustomerMode] = useState<'signin' | 'signup'>(
    initialCustomerMode === 'signup' ? 'signup' : 'signin'
  );

  // Sync state if initial props change
  React.useEffect(() => {
    setActivePortal(initialPortal);
  }, [initialPortal]);

  React.useEffect(() => {
    setCustomerMode(initialCustomerMode === 'signup' ? 'signup' : 'signin');
  }, [initialCustomerMode]);

  // Customer Form state
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custFullName, setCustFullName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Technician Form state
  const [techEmail, setTechEmail] = useState('');
  const [techPassword, setTechPassword] = useState('');

  // Manager Form state
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (customerMode === 'signup') {
        if (!custFullName.trim() || !custEmail.trim() || !custPhone.trim() || !custPassword.trim()) {
          setErrorMessage('Fill in all required fields.');
          setLoading(false);
          return;
        }

        const res = await registerCustomer({
          email: custEmail.trim(),
          fullName: custFullName.trim(),
          phone: custPhone.trim(),
          password: custPassword.trim(),
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Could not create account.');
          setLoading(false);
          return;
        }

        showToast('Account created.', 'success');
      } else {
        if (!custEmail.trim() || !custPassword.trim()) {
          setErrorMessage('Enter email and password.');
          setLoading(false);
          return;
        }

        const res = await login(custEmail.trim(), custPassword.trim(), 'customer');
        if (!res.success) {
          setErrorMessage(res.error || 'Invalid email or password.');
          setLoading(false);
          return;
        }

        showToast('Signed in.', 'success');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleTechnicianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (!techEmail.trim() || !techPassword.trim()) {
        setErrorMessage('Enter email and password.');
        setLoading(false);
        return;
      }

      const res = await login(techEmail.trim(), techPassword.trim(), 'technician');
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid technician credentials.');
        setLoading(false);
        return;
      }

      showToast('Signed in.', 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (!mgrEmail.trim() || !mgrPassword.trim()) {
        setErrorMessage('Enter email and password.');
        setLoading(false);
        return;
      }

      const res = await login(mgrEmail.trim(), mgrPassword.trim(), 'manager');
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid manager credentials.');
        setLoading(false);
        return;
      }

      showToast('Signed in.', 'success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F2421] flex flex-col justify-between px-4 sm:px-6 py-6 w-full max-w-full overflow-x-hidden font-sans">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between py-2 gap-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 cursor-pointer focus:outline-none group text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-[#143628] text-[#FDFBF7] flex items-center justify-center font-serif font-bold text-base">
            F
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-[#143628]">
            FixNear
          </span>
        </button>

        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="text-xs font-medium text-[#4A554E] hover:text-[#143628] px-3 py-1.5 rounded-lg hover:bg-[#EFEAE1] border border-[#DDD5C7] cursor-pointer"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Main Auth Card */}
      <div className="max-w-md mx-auto w-full my-6">
        <div className="bg-white border border-[#E8E2D8] rounded-2xl shadow-sm p-5 sm:p-7 w-full">
          {/* Role selector tabs */}
          <div className="grid grid-cols-3 p-1 bg-[#F5F2EB] rounded-xl border border-[#E2DBD0] mb-5 gap-1">
            <button
              onClick={() => {
                setActivePortal('customer');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activePortal === 'customer'
                  ? 'bg-[#143628] text-[#FDFBF7] shadow-xs font-semibold'
                  : 'text-[#526056] hover:text-[#143628]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Customer</span>
            </button>

            <button
              onClick={() => {
                setActivePortal('technician');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activePortal === 'technician'
                  ? 'bg-[#143628] text-[#FDFBF7] shadow-xs font-semibold'
                  : 'text-[#526056] hover:text-[#143628]'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>Technician</span>
            </button>

            <button
              onClick={() => {
                setActivePortal('manager');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activePortal === 'manager'
                  ? 'bg-[#143628] text-[#FDFBF7] shadow-xs font-semibold'
                  : 'text-[#526056] hover:text-[#143628]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Manager</span>
            </button>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 break-words">{errorMessage}</div>
            </div>
          )}

          {/* 1. CUSTOMER PORTAL TAB */}
          {activePortal === 'customer' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#F0EBE3]">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#143628]">
                  {customerMode === 'signup' ? 'Create Account' : 'Customer Sign In'}
                </h2>

                <div className="flex items-center gap-1 bg-[#F5F2EB] p-1 rounded-lg border border-[#E2DBD0]">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('signin');
                      setErrorMessage(null);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium cursor-pointer ${
                      customerMode === 'signin'
                        ? 'bg-[#143628] text-[#FDFBF7] font-semibold'
                        : 'text-[#526056] hover:text-[#143628]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('signup');
                      setErrorMessage(null);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium cursor-pointer ${
                      customerMode === 'signup'
                        ? 'bg-[#143628] text-[#FDFBF7] font-semibold'
                        : 'text-[#526056] hover:text-[#143628]'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-3">
                {customerMode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[#2C3830] mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={custFullName}
                        onChange={(e) => setCustFullName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#2C3830] mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] font-medium text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>
                    {loading
                      ? 'Please wait...'
                      : customerMode === 'signup'
                      ? 'Sign Up'
                      : 'Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* 2. TECHNICIAN PORTAL TAB */}
          {activePortal === 'technician' && (
            <div className="space-y-4">
              <div className="pb-2.5 border-b border-[#F0EBE3]">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#143628]">
                  Technician Sign In
                </h2>
              </div>

              <form onSubmit={handleTechnicianSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={techEmail}
                    onChange={(e) => setTechEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={techPassword}
                    onChange={(e) => setTechPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] font-medium text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* 3. MANAGER PORTAL TAB */}
          {activePortal === 'manager' && (
            <div className="space-y-4">
              <div className="pb-2.5 border-b border-[#F0EBE3]">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#143628]">
                  Manager Sign In
                </h2>
              </div>

              <form onSubmit={handleManagerSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={mgrEmail}
                    onChange={(e) => setMgrEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2C3830] mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={mgrPassword}
                    onChange={(e) => setMgrPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg text-[#1F2421] focus:outline-none focus:border-[#143628]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] font-medium text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-[#69776E] py-2">
        FixNear
      </div>
    </div>
  );
};
