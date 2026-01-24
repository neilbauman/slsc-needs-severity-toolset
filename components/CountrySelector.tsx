'use client';

import { useState, useRef, useEffect } from 'react';
import { useCountry } from '@/lib/countryContext';
import { ChevronDown, Globe } from 'lucide-react';

export default function CountrySelector() {
  const { currentCountry, setCurrentCountry, availableCountries, loading, isSiteAdmin } = useCountry();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || availableCountries.length === 0) {
    return null;
  }

  const handleCountrySelect = (country: typeof currentCountry) => {
    setCurrentCountry(country);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 rounded-md transition-colors"
      >
        <Globe size={16} />
        <span>{currentCountry?.name || 'Select Country'}</span>
        <ChevronDown size={16} className={isOpen ? 'transform rotate-180' : ''} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-[100] border border-gray-200">
          <div className="py-1">
            {isSiteAdmin && (
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                Site Admin - All Countries
              </div>
            )}
            {availableCountries.map((country) => (
              <button
                key={country.id}
                onClick={() => handleCountrySelect(country)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                  currentCountry?.id === country.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{country.name}</span>
                  {currentCountry?.id === country.id && (
                    <span className="text-blue-600">✓</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{country.iso_code}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
