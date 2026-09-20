import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, catchAsync } from "../utils/index.js";
import type { BaseCrudService, EntityId } from "./baseService.js";
import {
  normalizePagedQuery,
  normalizeSearchablePagedQuery,
  type PagedQuery,
  type SearchablePagedQuery,
} from "./pagination.js";

type BaseControllerOptions<TId extends EntityId> = {
  idParam?: string;
  parseId?: (value: string) => TId;
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
};

export class BaseController<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TId extends EntityId = number,
> {
  private readonly idParam: string;
  private readonly parseEntityId: (value: string) => TId;
  private readonly defaultPage?: number;
  private readonly defaultLimit?: number;
  private readonly maxLimit?: number;

  constructor(
    protected readonly service: BaseCrudService<
      TEntity,
      TCreateInput,
      TUpdateInput,
      TId
    >,
    options: BaseControllerOptions<TId> = {},
  ) {
    this.idParam = options.idParam ?? "id";
    this.parseEntityId =
      options.parseId ?? ((value: string) => Number(value) as TId);
    this.defaultPage = options.defaultPage;
    this.defaultLimit = options.defaultLimit;
    this.maxLimit = options.maxLimit;
  }

  public create = catchAsync(async (req: Request, res: Response) => {
    const entity = await this.service.create(req.body as TCreateInput);

    res.status(StatusCodes.CREATED).send(entity);
  });

  public getAll = catchAsync(async (_req: Request, res: Response) => {
    const entities = await this.service.getAll();

    res.send(entities);
  });

  public getAllPaged = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.getAllPaged(
      normalizePagedQuery(req.query as PagedQuery, {
        page: this.defaultPage,
        limit: this.defaultLimit,
        maxLimit: this.maxLimit,
      }),
    );

    res.send(result);
  });

  public searchAllPaged = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.searchAllPaged(
      normalizeSearchablePagedQuery(req.query as SearchablePagedQuery, {
        page: this.defaultPage,
        limit: this.defaultLimit,
        maxLimit: this.maxLimit,
      }),
    );

    res.send(result);
  });

  public getById = catchAsync(async (req: Request, res: Response) => {
    const entity = await this.service.getById(this.getId(req));

    if (!entity) {
      res.status(StatusCodes.NOT_FOUND).send();
      return;
    }

    res.send(entity);
  });

  public update = catchAsync(async (req: Request, res: Response) => {
    const entity = await this.service.update(
      this.getId(req),
      req.body as TUpdateInput,
    );

    if (!entity) {
      res.status(StatusCodes.NOT_FOUND).send();
      return;
    }

    res.send(entity);
  });

  public delete = catchAsync(async (req: Request, res: Response) => {
    const entity = await this.service.delete(this.getId(req));

    if (entity === null) {
      res.status(StatusCodes.NOT_FOUND).send();
      return;
    }

    if (entity === undefined) {
      res.status(StatusCodes.NO_CONTENT).send();
      return;
    }

    res.send(entity);
  });

  protected getId(req: Request): TId {
    const rawId = req.params[this.idParam];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Missing route parameter: ${this.idParam}`,
      );
    }

    return this.parseEntityId(id);
  }
}
