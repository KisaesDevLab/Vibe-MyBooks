// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/**
 * Color accessibility utilities for WCAG 2.1 compliance.
 *
 * Provides helpers to ensure text/background color pairs meet
 * minimum contrast ratios (4.5:1 for AA normal text).
 */

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace('#', '');
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Darken a color until it meets WCAG AA contrast (4.5:1) against white.
 * Used for tag text colors where the raw palette color is too light.
 */
export function darkenForText(hex: string, background = '#FFFFFF', targetRatio = 4.5): string {
  if (contrastRatio(hex, background) >= targetRatio) return hex;

  const [r, g, b] = hexToRgb(hex);
  // Progressively darken by reducing RGB values
  for (let factor = 0.9; factor >= 0.2; factor -= 0.05) {
    const darkened = rgbToHex(r * factor, g * factor, b * factor);
    if (contrastRatio(darkened, background) >= targetRatio) {
      return darkened;
    }
  }

  // Fallback: very dark version
  return rgbToHex(r * 0.2, g * 0.2, b * 0.2);
}
