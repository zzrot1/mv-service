import type { SortOrder } from "../utils/index.js";

export type PagedQuery = {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  [key: string]: unknown;
};

export type SearchablePagedQuery = PagedQuery & {
  search?: string;
  searchCriterion?: string;
};

export type NormalizedPagedQuery = {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  [key: string]: unknown;
};

export type NormalizedSearchablePagedQuery = NormalizedPagedQuery & {
  search?: string;
};

export type PagedResult<TEntity> = {
  data: TEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const toPositiveInteger = (
  value: unknown,
  fallback: number,
  max?: number,
): number => {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;

  return max ? Math.min(normalized, max) : normalized;
};

export const normalizePagedQuery = (
  query: PagedQuery,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): NormalizedPagedQuery => {
  const {
    page: _page,
    limit: _limit,
    skip: _skip,
    take: _take,
    ...extraQuery
  } = query;
  const page = toPositiveInteger(query.page, defaults.page ?? 1);
  const limit = toPositiveInteger(
    query.limit ?? query.take,
    defaults.limit ?? 10,
    defaults.maxLimit,
  );
  const skip = query.skip === undefined
    ? (page - 1) * limit
    : Math.max(0, Math.floor(Number(query.skip) || 0));

  return {
    ...extraQuery,
    page,
    limit,
    skip,
    take: limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };
};

export const normalizeSearchablePagedQuery = (
  query: SearchablePagedQuery,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): NormalizedSearchablePagedQuery => ({
  ...normalizePagedQuery(query, defaults),
  search: query.search ?? query.searchCriterion,
});
