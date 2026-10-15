// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

export interface Item {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  unitPrice: string | null;
  incomeAccountId: string;
  isTaxable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemInput {
  name: string;
  description?: string | null;
  unitPrice?: string | null;
  incomeAccountId: string;
  isTaxable?: boolean;
}

export interface UpdateItemInput {
  name?: string;
  description?: string | null;
  unitPrice?: string | null;
  incomeAccountId?: string;
  isTaxable?: boolean;
  isActive?: boolean;
}

export type LineEntryMode = 'category' | 'item';

export type ItemSortKey = 'name' | 'price' | 'taxable' | 'status';

export interface ItemFilters {
  isActive?: boolean;
  isTaxable?: boolean;
  search?: string;
  sortBy?: ItemSortKey;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
