// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Persistent table headers for list pages that scroll with the window.
//
// A `position: sticky` thead anchors to its nearest scroll container. The
// usual table card is `overflow-x-auto`, which makes the card that
// container — and the card never scrolls vertically, so the header never
// sticks. From xl up (1280px: the card is ~975px wide with the sidebar
// open, enough for every list that uses this) the card gives up its
// horizontal scroll and the thead sticks to the window, just under the
// AppShell top bar (theme spacing `app-header`). Below xl the card keeps
// its horizontal scroll and the header scrolls away as before.
//
// Usage:
//   <div className={`bg-white rounded-lg border shadow-sm ${STICKY_TABLE_CARD}`}>
//     <table>
//       <thead className={`bg-gray-50 ${STICKY_THEAD}`}>
//
// The thead needs an opaque background (rows pass beneath it) and gets its
// own bottom border here because a `divide-y` line lives on tbody's top
// edge and scrolls away with the rows.
//
// Not for tables that must scroll horizontally on desktop (wide entry
// grids) or that freeze a column with `sticky left-0`: those need the card
// to stay the scroll container, i.e. a bounded `max-h-… overflow-auto`
// card with a plain `sticky top-0` thead (see BatchEntryPage).

export const STICKY_TABLE_CARD = 'overflow-x-auto xl:overflow-visible';

export const STICKY_THEAD = 'border-b border-gray-200 xl:sticky xl:top-app-header xl:z-10';
