import type {
  NormalizedPagedQuery,
  NormalizedSearchablePagedQuery,
  PagedResult,
} from "./pagination.js";

export type EntityId = number | string;

type OrderByInput = Record<string, "asc" | "desc">;
type WhereInput = Record<string, unknown>;

export type DrizzleModelDelegate<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TWhereInput extends WhereInput = WhereInput,
  TWhereUniqueInput extends WhereInput = WhereInput,
> = {
  findMany(args?: {
    where?: TWhereInput;
    skip?: number;
    take?: number;
    orderBy?: OrderByInput;
  }): Promise<TEntity[]>;
  count(args?: { where?: TWhereInput }): Promise<number>;
  findUnique(args: { where: TWhereUniqueInput }): Promise<TEntity | null>;
  create(args: { data: TCreateInput }): Promise<TEntity>;
  update(args: {
    where: TWhereUniqueInput;
    data: TUpdateInput;
  }): Promise<TEntity>;
  delete(args: { where: TWhereUniqueInput }): Promise<TEntity>;
};

export type BaseRepositoryOptions<TEntity, TId extends EntityId = number> = {
  idField?: keyof TEntity & string;
  defaultOrderBy?: OrderByInput;
  searchFields?: Array<keyof TEntity & string>;
  buildWhereUnique?: (id: TId) => WhereInput;
  buildSearchWhere?: (search: string) => WhereInput;
};

export interface BaseCrudRepository<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TId extends EntityId = number,
> {
  getAll(): Promise<TEntity[]>;
  getAllPaged(query: NormalizedPagedQuery): Promise<PagedResult<TEntity>>;
  searchAllPaged(
    query: NormalizedSearchablePagedQuery,
  ): Promise<PagedResult<TEntity>>;
  getById(id: TId): Promise<TEntity | null>;
  find(where: WhereInput): Promise<TEntity[]>;
  add(data: TCreateInput): Promise<TEntity>;
  update(id: TId, data: TUpdateInput): Promise<TEntity | null>;
  delete(id: TId): Promise<TEntity | null>;
}

export class BaseRepository<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TId extends EntityId = number,
  TWhereInput extends WhereInput = WhereInput,
  TWhereUniqueInput extends WhereInput = WhereInput,
> implements BaseCrudRepository<TEntity, TCreateInput, TUpdateInput, TId> {
  private readonly idField: string;
  private readonly defaultOrderBy?: OrderByInput;
  private readonly searchFields: string[];
  private readonly buildWhereUnique: (id: TId) => TWhereUniqueInput;
  private readonly buildSearchWhere?: (search: string) => TWhereInput;

  constructor(
    protected readonly model: DrizzleModelDelegate<
      TEntity,
      TCreateInput,
      TUpdateInput,
      TWhereInput,
      TWhereUniqueInput
    >,
    options: BaseRepositoryOptions<TEntity, TId> = {},
  ) {
    this.idField = options.idField ?? "id";
    this.defaultOrderBy = options.defaultOrderBy;
    this.searchFields = options.searchFields ?? [];
    this.buildWhereUnique =
      (options.buildWhereUnique as ((id: TId) => TWhereUniqueInput) | undefined) ??
      ((id: TId) => ({ [this.idField]: id }) as TWhereUniqueInput);
    this.buildSearchWhere = options.buildSearchWhere as
      | ((search: string) => TWhereInput)
      | undefined;
  }

  public getAll(): Promise<TEntity[]> {
    return this.model.findMany({ orderBy: this.defaultOrderBy });
  }

  public getAllPaged(
    query: NormalizedPagedQuery,
  ): Promise<PagedResult<TEntity>> {
    return this.findPaged({}, query);
  }

  public searchAllPaged(
    query: NormalizedSearchablePagedQuery,
  ): Promise<PagedResult<TEntity>> {
    return this.findPaged(this.createSearchWhere(query.search), query);
  }

  public getById(id: TId): Promise<TEntity | null> {
    return this.model.findUnique({ where: this.buildWhereUnique(id) });
  }

  public find(where: WhereInput): Promise<TEntity[]> {
    return this.model.findMany({ where: where as TWhereInput });
  }

  public add(data: TCreateInput): Promise<TEntity> {
    return this.model.create({ data });
  }

  public async update(id: TId, data: TUpdateInput): Promise<TEntity | null> {
    const existing = await this.getById(id);

    if (!existing) {
      return null;
    }

    return this.model.update({
      where: this.buildWhereUnique(id),
      data,
    });
  }

  public async delete(id: TId): Promise<TEntity | null> {
    const existing = await this.getById(id);

    if (!existing) {
      return null;
    }

    return this.model.delete({ where: this.buildWhereUnique(id) });
  }

  protected async findPaged(
    where: WhereInput,
    query: NormalizedPagedQuery,
  ): Promise<PagedResult<TEntity>> {
    const normalizedWhere = where as TWhereInput;
    const orderBy = query.sortBy
      ? { [query.sortBy]: query.sortOrder ?? "desc" }
      : this.defaultOrderBy;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: normalizedWhere,
        skip: query.skip,
        take: query.take,
        orderBy,
      }),
      this.model.count({ where: normalizedWhere }),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private createSearchWhere(search?: string): WhereInput {
    if (!search) {
      return {};
    }

    if (this.buildSearchWhere) {
      return this.buildSearchWhere(search);
    }

    if (this.searchFields.length === 0) {
      return {};
    }

    return {
      OR: this.searchFields.map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      })),
    };
  }
}
