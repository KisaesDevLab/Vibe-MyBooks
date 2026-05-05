// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Bulk-import HTTP endpoints. Mounted at /api/v1/imports under
// authenticate + requireSuperAdmin + companyContext. Multer's memory
// storage is sufficient — uploads are bounded at 10 MB and parsed
// inline; we never persist the raw file bytes (just sha256 + parsed
// canonical rows in the import_sessions row).

import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { companyContext } from '../middleware/company.js';
import {
  importUploadOptionsSchema,
  importKindSchema,
  sourceSystemSchema,
  importCommitSchema,
  importListQuerySchema,
  type ImportUploadOptions,
} from '@kis-books/shared';
import { AppError } from '../utils/errors.js';
import * as importsService from '../services/imports/imports.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const allowedExt =
      ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.tsv');
    if (allowedExt) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.originalname}. Accepted: .csv, .xlsx, .xls, .tsv`));
    }
  },
});

export const importsRouter = Router();
importsRouter.use(authenticate);
importsRouter.use(requireSuperAdmin);
importsRouter.use(companyContext);

// ── POST /imports/upload ──────────────────────────────────────────
//
// Multipart form-data: `file` plus scalar fields `kind`,
// `sourceSystem`, optional `options` (JSON string). Returns the new
// session row, a small preview of canonical rows, and any validation
// errors discovered at parse time.
importsRouter.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) throw AppError.badRequest('No file uploaded.', 'IMPORT_NO_FILE');

  const kind = importKindSchema.parse(req.body['kind']);
  const sourceSystem = sourceSystemSchema.parse(req.body['sourceSystem']);

  // `options` arrives as a JSON-encoded string when sent via form-data.
  // Allow it to be absent or empty.
  let options: ImportUploadOptions = {};
  if (req.body['options']) {
    const raw = typeof req.body['options'] === 'string' ? req.body['options'] : '{}';
    try {
      options = importUploadOptionsSchema.parse(JSON.parse(raw));
    } catch (e) {
      throw AppError.badRequest(
        `options field is not valid JSON or fails schema: ${e instanceof Error ? e.message : String(e)}`,
        'IMPORT_BAD_OPTIONS',
      );
    }
  }

  const out = await importsService.createSession({
    tenantId: req.tenantId,
    companyId: req.companyId,
    userId: req.userId,
    file: { originalname: req.file.originalname, buffer: req.file.buffer },
    kind,
    sourceSystem,
    options,
  });
  res.status(201).json(out);
});

// ── GET /imports/:id ──────────────────────────────────────────────
importsRouter.get('/:id', async (req, res) => {
  const id = req.params['id'];
  if (!id) throw AppError.badRequest('Missing session id.');
  const out = await importsService.getSession(req.tenantId, req.companyId, id);
  if (!out) throw AppError.notFound('Import session not found.');
  res.json(out);
});

// ── POST /imports/:id/commit ──────────────────────────────────────
importsRouter.post('/:id/commit', async (req, res) => {
  const id = req.params['id'];
  if (!id) throw AppError.badRequest('Missing session id.');
  const parsed = importCommitSchema.parse(req.body ?? {});
  const out = await importsService.commitSession(
    req.tenantId,
    req.companyId,
    req.userId,
    id,
    parsed,
  );
  res.json(out);
});

// ── DELETE /imports/:id ───────────────────────────────────────────
importsRouter.delete('/:id', async (req, res) => {
  const id = req.params['id'];
  if (!id) throw AppError.badRequest('Missing session id.');
  const ok = await importsService.deleteSession(req.tenantId, req.companyId, id);
  if (!ok) throw AppError.notFound('Import session not found.');
  res.status(204).end();
});

// ── GET /imports ──────────────────────────────────────────────────
importsRouter.get('/', async (req, res) => {
  const filters = importListQuerySchema.parse(req.query);
  const out = await importsService.listSessions(req.tenantId, req.companyId, filters);
  res.json(out);
});
