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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    },
    [getToken]
  );

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/v1/organizations');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      const data = await response.json();
      setOrganizations(data.organizations);
      return data.organizations as Organization[];
    } catch (err) {
      console.error('Error fetching organizations:', err);
      throw err;
    }
  }, [fetchWithAuth]);

  const fetchCurrentOrganization = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/v1/organizations/current');
      if (!response.ok) {
        throw new Error('Failed to fetch current organization');
      }
      const data = await response.json();
      setCurrentOrganization(data.organization);
      return data.organization as Organization;
    } catch (err) {
      console.error('Error fetching current organization:', err);
      throw err;
    }
  }, [fetchWithAuth]);

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
        const response = await fetchWithAuth(
          `/api/v1/organizations/${organizationId}/switch`,
          { method: 'POST' }
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to switch organization');
        }

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
    [fetchWithAuth, fetchCurrentOrganization, organizations]
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
