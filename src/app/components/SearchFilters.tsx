// SearchFilters component provides UI controls for searching and filtering job listings.
// Includes search input, location filter, and job type dropdown, with handlers for each.
'use client';

import React from 'react';
import { Search, MapPin, Briefcase} from 'lucide-react';

// Props for SearchFilters: current filter values and change handlers
interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  locationFilter: string;
  onLocationChange: (location: string) => void;
  typeFilter: string;
  onTypeChange: (type: string) => void;
}

export function SearchFilters({
  searchQuery,
  onSearchChange,
  locationFilter,
  onLocationChange,
  typeFilter,
  onTypeChange,
}: SearchFiltersProps) {
  return (
    <div className="my-16">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search job titles, companies..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-adecco-red focus:border-adecco-red transition-colors"
          />
        </div>

        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Location"
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-adecco-red focus:border-adecco-red transition-colors"
          />
        </div>

        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <select
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-adecco-red focus:border-adecco-red transition-colors appearance-none"
          >
            <option value="">All Job Types</option>
            <option value="Full Time">Full Time</option>
            <option value="Part Time">Part Time</option>
            <option value="Contract">Contract</option>
            <option value="Freelance">Freelance</option>
            <option value="Internship">Internship</option>
          </select>
        </div>
      </div>
    </div>
  );
}