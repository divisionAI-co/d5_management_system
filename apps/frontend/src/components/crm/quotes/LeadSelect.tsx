import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import { X, ChevronDown } from 'lucide-react';
import type { Lead } from '@/types/crm';

interface LeadSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function LeadSelect({ value, onChange, disabled, error, required }: LeadSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch leads with search
  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: ['leads', 'search', searchTerm],
    queryFn: () => leadsApi.list({ 
      search: searchTerm || undefined,
      page: 1,
      pageSize: 50,
    }),
    enabled: isOpen,
  });

  const leads = leadsResponse?.data ?? [];

  // Load selected lead when value changes
  useEffect(() => {
    if (value) {
      // Only fetch if we don't have the lead or if the value changed
      if (!selectedLead || selectedLead.id !== value) {
        leadsApi.getById(value)
          .then((lead) => {
            // Only update if the value hasn't changed while fetching
            setSelectedLead((prev) => {
              if (!prev || prev.id !== value) {
                return lead;
              }
              return prev;
            });
          })
          .catch(() => setSelectedLead(null));
      }
    } else {
      setSelectedLead(null);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (lead: Lead) => {
    setSelectedLead(lead);
    onChange(lead.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLead(null);
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const displayValue = useMemo(() => {
    if (selectedLead) {
      const contactName = selectedLead.contacts && selectedLead.contacts.length > 0
        ? `${selectedLead.contacts[0].firstName} ${selectedLead.contacts[0].lastName}`
        : '';
      return contactName 
        ? `${selectedLead.title} - ${contactName}`
        : selectedLead.title;
    }
    return '';
  }, [selectedLead]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setSearchTerm('');
            }
          }}
          disabled={disabled}
          placeholder={selectedLead ? displayValue : 'Search for a lead...'}
          className={`w-full rounded-lg border ${
            error ? 'border-red-500' : 'border-border'
          } bg-background px-3 py-2 pr-20 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="ml-2">Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchTerm ? `No leads found matching "${searchTerm}"` : 'No leads found'}
            </div>
          ) : (
            <ul className="py-1">
              {leads.map((lead) => {
                const contactName = lead.contacts && lead.contacts.length > 0
                  ? `${lead.contacts[0].firstName} ${lead.contacts[0].lastName}`
                  : '';
                const displayText = contactName 
                  ? `${lead.title} - ${contactName}`
                  : lead.title;
                
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(lead)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                        value === lead.id ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200' : 'text-foreground'
                      }`}
                    >
                      <div className="font-medium">{lead.title}</div>
                      {contactName && (
                        <div className="text-xs text-muted-foreground">{contactName}</div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

