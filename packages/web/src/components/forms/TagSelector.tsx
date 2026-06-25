// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTags, useCreateTag } from '../../api/hooks/useTags';
import { TAG_COLOR_PALETTE } from '@kis-books/shared';
import { darkenForText } from '../../utils/color-a11y';
import { X, Plus } from 'lucide-react';
import clsx from 'clsx';

interface TagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  compact?: boolean;
}

export function TagSelector({ value, onChange, label, compact }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Portal panel: rendered on document.body with fixed positioning so it is
  // never clipped by a modal/table overflow and always stacks on top.
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  const updatePanelPos = useCallback(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 4;
    const spaceBelow = window.innerHeight - r.bottom - GAP - 8;
    const spaceAbove = r.top - GAP - 8;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(208, openUp ? spaceAbove : spaceBelow));
    setPanelPos({ left: r.left, width: r.width, maxHeight, top: openUp ? r.top - GAP - maxHeight : r.bottom + GAP });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePanelPos();
    const onScroll = () => updatePanelPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, updatePanelPos]);

  const { data } = useTags({ isActive: true });
  const createTag = useCreateTag();
  const allTags = data?.tags || [];

  const filtered = search
    ? allTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : allTags;

  const selectedTags = allTags.filter((t) => value.includes(t.id));
  const noExactMatch = search && !allTags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  useEffect(() => { setHighlightIndex(0); }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrapper = dropdownRef.current?.contains(target) ?? false;
      const inPanel = panelRef.current?.contains(target) ?? false;
      if (!inWrapper && !inPanel) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const handleCreateInline = () => {
    if (!search.trim()) return;
    const color = TAG_COLOR_PALETTE[Math.floor(Math.random() * TAG_COLOR_PALETTE.length)]!;
    createTag.mutate({ name: search.trim(), color }, {
      onSuccess: (data) => {
        onChange([...value, data.tag.id]);
        setSearch('');
      },
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered[highlightIndex]) toggle(filtered[highlightIndex].id);
      else if (noExactMatch) handleCreateInline();
    }
    if (e.key === 'Escape') { setIsOpen(false); setSearch(''); }
    if (e.key === 'Backspace' && !search && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  // Compact mode: just show count badge
  if (compact && !isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600"
        title={selectedTags.map((t) => t.name).join(', ') || 'No tags'}
      >
        {value.length > 0 ? (
          <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">{value.length}</span>
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      {/* Selected tags + input */}
      <div
        className={clsx(
          'flex flex-wrap items-center gap-1 border rounded-lg px-2 py-1 min-h-[34px] cursor-text',
          isOpen ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-300',
        )}
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : '#f3f4f6',
              color: tag.color ? darkenForText(tag.color) : '#4b5563',
            }}
          >
            {tag.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(tag.id); }}
              className="hover:opacity-70"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? 'Add tags...' : ''}
          className="flex-1 min-w-[60px] text-xs outline-none border-none bg-transparent py-0.5"
        />
      </div>

      {/* Dropdown — portal + fixed positioning (never clipped by overflow). */}
      {isOpen && panelPos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[1000] bg-white rounded-lg border border-gray-200 shadow-lg overflow-auto"
          style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width, maxHeight: panelPos.maxHeight }}
        >
          {filtered.map((tag, idx) => {
            const isSelected = value.includes(tag.id);
            return (
              <div
                key={tag.id}
                onClick={() => toggle(tag.id)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={clsx(
                  'px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2',
                  idx === highlightIndex ? 'bg-primary-50' : 'hover:bg-gray-50',
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#d1d5db' }} />
                <span className={clsx('flex-1', isSelected && 'font-medium text-primary-700')}>{tag.name}</span>
                {isSelected && <span className="text-primary-600 text-[10px]">&#10003;</span>}
                {tag.usageCount > 0 && <span className="text-[10px] text-gray-400">{tag.usageCount}</span>}
              </div>
            );
          })}
          {filtered.length === 0 && !noExactMatch && (
            <div className="px-3 py-2 text-xs text-gray-400">No tags yet</div>
          )}
          {noExactMatch && (
            <div
              onClick={handleCreateInline}
              className="px-3 py-1.5 text-xs cursor-pointer text-primary-600 font-medium hover:bg-primary-50 border-t border-gray-100 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Create "{search}"
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
