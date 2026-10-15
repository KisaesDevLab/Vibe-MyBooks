// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Editor-side re-exports of the shared engine + renderer, plus tiny helpers.

export {
  computeFsReport, fsPreviewDocument,
  type FsCheck, type FsFrontMatter, type FsLayout, type FsRenderedReport, type FsReportSettings, type FsStatementConfig, type FsStyle,
} from '@kis-books/shared';

// Cash-basis statements are cash by definition; GAAP / tax pick the book basis.
export const fsFrameworkNeedsBook = (framework: 'gaap' | 'cash' | 'tax'): boolean => framework !== 'cash';
