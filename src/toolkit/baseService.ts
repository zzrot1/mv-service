import type {
  NormalizedPagedQuery,
  NormalizedSearchablePagedQuery,
  PagedResult,
} from "./pagination.js";
import type { BaseCrudRepository } from "./baseRepository.js";

export type { EntityId } from "./baseRepository.js";
import type { EntityId } from "./baseRepository.js";

export interface BaseCrudService<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TId extends EntityId = number,
> {
  create(data: TCreateInput): Promise<TEntity>;
  getAll(): Promise<TEntity[]>;
  getAllPaged(query: NormalizedPagedQuery): Promise<PagedResult<TEntity>>;
  searchAllPaged(
    query: NormalizedSearchablePagedQuery,
  ): Promise<PagedResult<TEntity>>;
  getById(id: TId): Promise<TEntity | null>;
  update(id: TId, data: TUpdateInput): Promise<TEntity | null>;
  delete(id: TId): Promise<TEntity | null | void>;
}

export class BaseService<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TId extends EntityId = number,
> implements BaseCrudService<TEntity, TCreateInput, TUpdateInput, TId> {
  constructor(
    protected readonly repository: BaseCrudRepository<
      TEntity,
      TCreateInput,
      TUpdateInput,
      TId
    >,
  ) {}

  public create(data: TCreateInput): Promise<TEntity> {
    return this.repository.add(data);
  }

  public getAll(): Promise<TEntity[]> {
    return this.repository.getAll();
  }

  public getAllPaged(
    query: NormalizedPagedQuery,
  ): Promise<PagedResult<TEntity>> {
    return this.repository.getAllPaged(query);
  }

  public searchAllPaged(
    query: NormalizedSearchablePagedQuery,
  ): Promise<PagedResult<TEntity>> {
    return this.repository.searchAllPaged(query);
  }

  public getById(id: TId): Promise<TEntity | null> {
    return this.repository.getById(id);
  }

  public update(id: TId, data: TUpdateInput): Promise<TEntity | null> {
    return this.repository.update(id, data);
  }

  public delete(id: TId): Promise<TEntity | null> {
    return this.repository.delete(id);
  }
}
