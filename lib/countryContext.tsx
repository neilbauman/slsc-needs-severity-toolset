'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from './supabaseClient';
import { useAuth } from '@/components/AuthProvider';

interface Country {
  id: string;
  iso_code: string;
  name: string;
  active: boolean;
}

interface UserCountry {
  country_id: string;
  role: 'admin' | 'user';
  country: Country;
}

interface CountryContextType {
  currentCountry: Country | null;
  setCurrentCountry: (country: Country | null) => void;
  userCountries: UserCountry[];
  availableCountries: Country[];
  loading: boolean;
  isSiteAdmin: boolean;
  refreshUserCountries: () => Promise<void>;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [currentCountry, setCurrentCountryState] = useState<Country | null>(null);
  const [userCountries, setUserCountries] = useState<UserCountry[]>([]);
  const [availableCountries, setAvailableCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  // Check if user is site admin (has admin role for any country)
  const isSiteAdmin = userCountries.some(uc => uc.role === 'admin');

  // Fetch user's countries
  const refreshUserCountries = useCallback(async () => {
    if (!user) {
      setUserCountries([]);
      setAvailableCountries([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch user's country assignments
      const { data: userCountryData, error: userCountryError } = await supabase
        .from('user_countries')
        .select(`
          country_id,
          role,
          country:countries(*)
        `)
        .eq('user_id', user.id);

      if (userCountryError) throw userCountryError;

      const formatted: UserCountry[] = (userCountryData || []).map((uc: any) => ({
        country_id: uc.country_id,
        role: uc.role,
        country: uc.country,
      }));

      setUserCountries(formatted);

      // If user is site admin, fetch all active countries
      // Otherwise, only show their assigned countries
      if (formatted.some(uc => uc.role === 'admin')) {
        const { data: allCountries, error: countriesError } = await supabase
          .from('countries')
          .select('*')
          .eq('active', true)
          .order('name');

        if (countriesError) throw countriesError;
        setAvailableCountries(allCountries || []);
      } else {
        setAvailableCountries(formatted.map(uc => uc.country));
      }
    } catch (error) {
      console.error('Error fetching user countries:', error);
      setUserCountries([]);
      setAvailableCountries([]);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Load user countries on mount and when user changes
  useEffect(() => {
    refreshUserCountries();
  }, [refreshUserCountries]);

  // Load current country from localStorage on mount
  useEffect(() => {
    if (!loading && availableCountries.length > 0 && !currentCountry) {
      const savedCountryId = localStorage.getItem('currentCountryId');
      if (savedCountryId) {
        const saved = availableCountries.find(c => c.id === savedCountryId);
        if (saved) {
          setCurrentCountryState(saved);
          return;
        }
      }
      // Default to first available country
      setCurrentCountryState(availableCountries[0]);
    }
  }, [loading, availableCountries, currentCountry]);

  // Save current country to localStorage when it changes
  const setCurrentCountry = useCallback((country: Country | null) => {
    setCurrentCountryState(country);
    if (country) {
      localStorage.setItem('currentCountryId', country.id);
    } else {
      localStorage.removeItem('currentCountryId');
    }
  }, []);

  const value = {
    currentCountry,
    setCurrentCountry,
    userCountries,
    availableCountries,
    loading,
    isSiteAdmin,
    refreshUserCountries,
  };

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (context === undefined) {
    // Return safe defaults if used outside provider (e.g., on public pages)
    return {
      currentCountry: null,
      setCurrentCountry: () => {},
      userCountries: [],
      availableCountries: [],
      loading: false,
      isSiteAdmin: false,
      refreshUserCountries: async () => {},
    };
  }
  return context;
}
