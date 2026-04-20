// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Build-plan Phase 6 — visual gallery for <SplitRowV2>. Re-exports
// the CSF3 stories from SplitRowV2.stories.tsx so the same source of
// truth renders both here (as a `/__dev/split-row-v2` route) and in
// whatever story runner is later installed (Storybook / Ladle).
//
// Gated in App.tsx to dev builds so the route never ships to prod.

import { Gallery } from '../../components/forms/SplitRowV2/SplitRowV2.stories';

export function SplitRowV2GalleryPage() {
  return <Gallery />;
}
