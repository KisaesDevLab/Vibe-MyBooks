// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import clsx from 'clsx';

export interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  group?: string;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  onAddNew?: (searchText: string) => void;
  addNewLabel?: string;
  compact?: boolean;
}

export function SearchableDropdown({ value, onChange, options, placeholder = 'Search...', label, required, className, onAddNew, addNewLabel, compact }: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Derive display value from selected id
  const selectedOption = options.find((o) => o.id === value);
  const displayValue = isOpen ? search : (selectedOption?.label || '');

  // Filter options by search
  const query = search.toLowerCase();
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query)),
      )
    : options;

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputRef.current && !inputRef.current.parentElement?.contains(target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

  return (
    <div className={clsx('relative', className)}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        required={required && !value}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
          if (e.target.value === '') onChange('');
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch('');
        }}
        onKeyDown={handleKeyDown}
        className={clsx(
          'block w-full border focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500',
          compact
            ? 'rounded px-1.5 py-1 text-xs border-gray-300'
            : 'rounded-lg px-3 py-2 text-sm border-gray-300',
          value ? 'text-gray-900' : 'text-gray-500',
        )}
        autoComplete="off"
      />

      {/* Clear button */}
      {value && !isOpen && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          style={label ? { top: 'calc(50% + 10px)' } : undefined}
        >
          ✕
        </button>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div className={clsx('absolute z-50 mt-1 w-full bg-white border border-gray-200 shadow-lg overflow-auto', compact ? 'rounded max-h-48' : 'rounded-lg max-h-60')} ref={listRef}>
          {filtered.length === 0 && !onAddNew && (
            <div className={clsx('text-gray-400', compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm')}>No matches found</div>
          )}
          {filtered.map((option, idx) => (
            <div
              key={option.id}
              onClick={() => handleSelect(option.id)}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={clsx(
                'cursor-pointer flex items-center justify-between',
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
                idx === highlightIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50',
                option.id === value && 'font-medium',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.sublabel && (
                <span className={clsx('text-gray-400 ml-2 flex-shrink-0', compact ? 'text-[10px]' : 'text-xs')}>{option.sublabel}</span>
              )}
            </div>
          ))}
          {onAddNew && (
            <div
              onClick={() => { onAddNew(search); setIsOpen(false); setSearch(''); }}
              className={clsx(
                'cursor-pointer border-t border-gray-100 text-primary-600 font-medium hover:bg-primary-50 flex items-center gap-1.5',
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
              )}
            >
              <span className="leading-none">+</span>
              {addNewLabel || (search ? `Add "${search}"` : 'Add new...')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
