'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@clerk/nextjs';
import { useApi } from '@/lib/api/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  credits: number;
  role: 'owner' | 'member';
  memberCount: number;
  createdAt: string;
}

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  refreshCurrentOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

export function useOrganizationSafe() {
  return useContext(OrganizationContext);
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { call } = useApi();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      const data = await call<{ organizations: Organization[] }>('/v1/organizations');
      setOrganizations(data.organizations);
      return data.organizations;
    } catch (err) {
      console.error('Error fetching organizations:', err);
      throw err;
    }
  }, [call]);

  const fetchCurrentOrganization = useCallback(async () => {
    try {
      const data = await call<{ organization: Organization }>('/v1/organizations/current');
      setCurrentOrganization(data.organization);
      return data.organization;
    } catch (err) {
      console.error('Error fetching current organization:', err);
      throw err;
    }
  }, [call]);

  const refreshOrganizations = useCallback(async () => {
    try {
      await fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh organizations');
    }
  }, [fetchOrganizations]);

  const refreshCurrentOrganization = useCallback(async () => {
    try {
      await fetchCurrentOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh current organization');
    }
  }, [fetchCurrentOrganization]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      try {
        await call(`/v1/organizations/${organizationId}/switch`, { method: 'POST' });

        // Update current organization from list
        const org = organizations.find((o) => o.id === organizationId);
        if (org) {
          setCurrentOrganization(org);
        } else {
          // Refetch if not in list
          await fetchCurrentOrganization();
        }
      } catch (err) {
        console.error('Error switching organization:', err);
        throw err;
      }
    },
    [call, fetchCurrentOrganization, organizations]
  );

  // Initial load
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchOrganizations(), fetchCurrentOrganization()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [isLoaded, isSignedIn, fetchOrganizations, fetchCurrentOrganization]);

  const value: OrganizationContextValue = {
    organizations,
    currentOrganization,
    isLoading,
    error,
    switchOrganization,
    refreshOrganizations,
    refreshCurrentOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
