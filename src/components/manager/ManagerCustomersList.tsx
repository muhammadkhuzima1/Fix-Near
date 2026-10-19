import React, { useState } from 'react';
import { User, ServiceRequest } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { ManagerEditRoleModal } from './ManagerEditRoleModal';
import { Users, Search, Phone, Mail, Calendar, ArrowRight, Wrench, ArrowRightLeft } from 'lucide-react';

interface ManagerCustomersListProps {
  customers: User[];
  requests: ServiceRequest[];
  onSelectCustomerRequests?: (customerId: string) => void;
  onRefresh?: () => void;
}

export const ManagerCustomersList: React.FC<ManagerCustomersListProps> = ({
  customers,
  requests,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustomerForRoleEdit, setSelectedCustomerForRoleEdit] = useState<User | null>(null);

  const filteredCustomers = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Registered Customers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounts created via public customer signup (<span className="font-mono text-slate-800">role = 'customer'</span>)
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white"
          />
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No customers match your search' : 'No registered customers yet'}
          description={
            search
              ? 'Try modifying your search criteria.'
              : 'When customers sign up through the FixNear customer portal, their profiles and request history will appear here.'
          }
        />
      ) : (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {filteredCustomers.map((cust) => {
            const customerReqs = requests.filter((r) => r.customerId === cust.id);
            const activeReqs = customerReqs.filter((r) =>
              ['pending', 'approved', 'assigned', 'accepted', 'in_progress'].includes(r.status)
            );

            return (
              <div
                key={cust.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {cust.fullName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {cust.fullName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap font-mono">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{cust.email}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{cust.phone}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-slate-400 text-[11px] font-sans">Lifetime Requests</div>
                    <div className="font-bold text-slate-800">
                      {customerReqs.length} total ({activeReqs.length} active)
                    </div>
                  </div>

                  <div className="text-left sm:text-right hidden sm:block">
                    <div className="text-slate-400 text-[11px] font-sans">Joined</div>
                    <div className="text-slate-600">
                      {new Date(cust.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedCustomerForRoleEdit(cust)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Change role for ${cust.fullName}`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Role</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Change Modal */}
      <ManagerEditRoleModal
        user={selectedCustomerForRoleEdit}
        isOpen={Boolean(selectedCustomerForRoleEdit)}
        onClose={() => setSelectedCustomerForRoleEdit(null)}
        onRefresh={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
