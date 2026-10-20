import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, UserRole, TechnicianProfile, SupabaseConfig } from '../types';
import { store } from '../services/store';
import { SupabaseService } from '../services/supabaseService';
import { getSupabaseClient, getStoredSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole | null;
  technicianProfile: TechnicianProfile | null;
  login: (email: string, password?: string, role?: UserRole) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  registerCustomer: (params: { email: string; fullName: string; phone: string; password?: string }) => Promise<{
    success: boolean;
    error?: string;
    user?: User;
  }>;
  createTechnicianByManager: (params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
    specialty: string;
    additionalSkills?: string[];
    experienceYears?: number;
    licenseNumber?: string;
    hourlyRate?: number;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  provisionInitialManager: (params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  switchUser: (userId: string) => void;
  users: User[];
  refreshAuth: () => void;
  isSupabaseActive: boolean;
  supabaseConfig: SupabaseConfig;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => store.getUsers());
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => getStoredSupabaseConfig());

  const isSupabaseActive = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

  const refreshAuth = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        if (session?.user) {
          const profile = await SupabaseService.getProfile(session.user.id, session.user.email);
          if (profile) {
            setCurrentUser(profile);
            store.setCurrentUserId(profile.id);
          } else {
            // CRITICAL: NEVER default to customer!
            setCurrentUser(null);
            store.setCurrentUserId(null);
          }
        } else {
          setCurrentUser(null);
          store.setCurrentUserId(null);
        }

        // Fetch all users/profiles (customers, technicians, managers)
        const allUsers = await SupabaseService.fetchAllUsers();
        setUsers(allUsers);
      } catch (err) {
        console.error('Error refreshing auth from Supabase:', err);
      }
    } else {
      setCurrentUser(store.getCurrentUser());
      setUsers(store.getUsers());
    }
    setSupabaseConfig(getStoredSupabaseConfig());
  }, []);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    let isMounted = true;
    const client = getSupabaseClient();

    const initAuth = async () => {
      setAuthLoading(true);
      if (client) {
        try {
          const {
            data: { session },
          } = await client.auth.getSession();
          if (session?.user && isMounted) {
            const profile = await SupabaseService.getProfile(session.user.id, session.user.email);
            if (profile) {
              setCurrentUser(profile);
              store.setCurrentUserId(profile.id);
              const allUsers = await SupabaseService.fetchAllUsers();
              if (isMounted) setUsers(allUsers);
            } else {
              // Strictly never default to customer
              setCurrentUser(null);
              store.setCurrentUserId(null);
            }
          } else if (isMounted) {
            setCurrentUser(null);
            store.setCurrentUserId(null);
          }
        } catch (e) {
          console.error('Session init error:', e);
        }
      } else {
        if (isMounted) {
          setCurrentUser(store.getCurrentUser());
          setUsers(store.getUsers());
        }
      }
      if (isMounted) setAuthLoading(false);
    };

    initAuth();

    let authSubscription: any = null;
    if (client) {
      const { data } = client.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        // Wait for explicit signIn() to complete its role validation before setting currentUser
        if (SupabaseService.isSigningIn) return;

        if (session?.user) {
          const profile = await SupabaseService.getProfile(session.user.id, session.user.email);
          if (profile && isMounted) {
            setCurrentUser(profile);
            store.setCurrentUserId(profile.id);
            const allUsers = await SupabaseService.fetchAllUsers();
            if (isMounted) setUsers(allUsers);
          } else if (isMounted) {
            setCurrentUser(null);
            store.setCurrentUserId(null);
          }
        } else {
          setCurrentUser(null);
          store.setCurrentUserId(null);
        }
      });
      authSubscription = data.subscription;
    }

    const unsubStore = store.subscribe(() => {
      if (isMounted && !client) {
        setCurrentUser(store.getCurrentUser());
        setUsers(store.getUsers());
      }
    });

    return () => {
      isMounted = false;
      if (authSubscription) authSubscription.unsubscribe();
      unsubStore();
    };
  }, []);

  const role = currentUser ? currentUser.role : null;

  const [techProfileState, setTechProfileState] = useState<TechnicianProfile | null>(() => {
    if (currentUser?.role === 'technician') {
      return store.getTechnicianProfile(currentUser.id) || null;
    }
    return null;
  });

  useEffect(() => {
    let isMounted = true;
    if (currentUser?.role === 'technician') {
      SupabaseService.getTechnicianProfile(currentUser.id).then((profile) => {
        if (isMounted) setTechProfileState(profile);
      });
    } else {
      setTechProfileState(null);
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.role]);

  const technicianProfile = techProfileState;

  const login = useCallback(
    async (email: string, password = 'password123', requestedRole?: UserRole) => {
      const client = getSupabaseClient();
      if (client) {
        const res = await SupabaseService.signIn(email, password, requestedRole);
        if (res.success && res.user) {
          setCurrentUser(res.user);
          SupabaseService.fetchAllUsers().then(setUsers).catch(console.error);
        }
        return res;
      }

      // Local store engine
      const user = store.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'No account found with this email address.' };
      }

      if (requestedRole && user.role !== requestedRole) {
        return {
          success: false,
          error: `This account is registered as a ${user.role.toUpperCase()}, not a ${requestedRole.toUpperCase()}. Please sign in through the appropriate portal.`,
        };
      }

      store.setCurrentUserId(user.id);
      setCurrentUser(user);
      return { success: true, user };
    },
    []
  );

  const logout = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) {
      await SupabaseService.signOut();
    } else {
      store.setCurrentUserId(null);
    }
    setCurrentUser(null);
  }, []);

  const switchUser = useCallback((userId: string) => {
    const user = store.getUserById(userId);
    if (user) {
      store.setCurrentUserId(user.id);
      setCurrentUser(user);
    }
  }, []);

  // Customer signup creates strictly role = 'customer'
  const registerCustomer = useCallback(
    async (params: { email: string; fullName: string; phone: string; password?: string }) => {
      const client = getSupabaseClient();
      if (client) {
        const res = await SupabaseService.signUpCustomer(params);
        if (res.success && res.user) {
          setCurrentUser(res.user);
        }
        return res;
      }

      const res = store.registerCustomer(params);
      if (res.success && res.user) {
        store.setCurrentUserId(res.user.id);
        setCurrentUser(res.user);
      }
      return res;
    },
    []
  );

  // Manager creates Technician (Strictly role = 'technician')
  const createTechnicianByManager = useCallback(
    async (params: {
      email: string;
      fullName: string;
      phone: string;
      password?: string;
      specialty: string;
      additionalSkills?: string[];
      experienceYears?: number;
      licenseNumber?: string;
      hourlyRate?: number;
    }) => {
      const client = getSupabaseClient();
      if (client) {
        return SupabaseService.createTechnicianByManager(params);
      }
      return store.createTechnicianByManager(params);
    },
    []
  );

  const provisionInitialManager = useCallback(
    async (params: { email: string; fullName: string; phone: string; password?: string }) => {
      const res = store.provisionInitialManager(params);
      if (res.success && res.user) {
        store.setCurrentUserId(res.user.id);
        setCurrentUser(res.user);
      }
      return res;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        technicianProfile,
        login,
        logout,
        registerCustomer,
        createTechnicianByManager,
        provisionInitialManager,
        switchUser,
        users,
        refreshAuth,
        isSupabaseActive,
        supabaseConfig,
        authLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
