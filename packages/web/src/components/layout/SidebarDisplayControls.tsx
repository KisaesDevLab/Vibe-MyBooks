// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useTheme } from '../../providers/ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '@kis-books/shared';

const themeIcons: Record<ThemeMode, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const themeLabels: Record<ThemeMode, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system theme',
  system: 'Switch to light mode',
};

const themeCycle: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export function SidebarDisplayControls() {
  const { theme, fontScaleLevel, setTheme, increaseFontSize, decreaseFontSize, setFontScale } = useTheme();

  const ThemeIcon = themeIcons[theme];

  return (
    <div className="px-3 py-3" style={{ borderTop: '1px solid #374151' }}>
      <div className="flex items-center justify-between">
        {/* Font size controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={decreaseFontSize}
            disabled={fontScaleLevel <= 1}
            title="Decrease text size"
            className="px-2 py-1 text-xs font-bold rounded transition-colors disabled:cursor-not-allowed"
            style={{ color: fontScaleLevel <= 1 ? '#4B5563' : '#D1D5DB' }}
            onMouseEnter={(e) => { if (fontScaleLevel > 1) e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = fontScaleLevel <= 1 ? '#4B5563' : '#D1D5DB'; }}
          >
            A-
          </button>
          {fontScaleLevel !== 3 && (
            <button
              onClick={() => setFontScale(3)}
              title="Reset text size"
              className="px-2 py-1 text-xs font-bold rounded transition-colors"
              style={{ color: '#D1D5DB' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; }}
            >
              A
            </button>
          )}
          <button
            onClick={increaseFontSize}
            disabled={fontScaleLevel >= 7}
            title="Increase text size"
            className="px-2 py-1 text-xs font-bold rounded transition-colors disabled:cursor-not-allowed"
            style={{ color: fontScaleLevel >= 7 ? '#4B5563' : '#D1D5DB' }}
            onMouseEnter={(e) => { if (fontScaleLevel < 7) e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = fontScaleLevel >= 7 ? '#4B5563' : '#D1D5DB'; }}
          >
            A+
          </button>
        </div>

        {/* Scale dots */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((level) => (
            <span
              key={level}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: level === fontScaleLevel ? '#FFFFFF' : '#4B5563' }}
            />
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(themeCycle[theme])}
          title={themeLabels[theme]}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: '#D1D5DB' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.backgroundColor = '#1F2937'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.backgroundColor = ''; }}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
