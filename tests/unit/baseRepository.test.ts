import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BaseRepository,
  type DrizzleModelDelegate,
} from "../../src/toolkit/baseRepository.js";

type Item = {
  id: number;
  name: string;
  deletedAt: Date | null;
};

type Where = Record<string, unknown>;

/**
 * Delegate in memorie cu semantica Prisma-like: egalitate pe campuri
 * (null potriveste null/undefined), `AND`, `OR` si `{ contains, mode }`.
 * Expune si `delete`, ca sa putem verifica ca nu e apelat niciodata.
 */
function createInMemoryDelegate(seed: Item[]) {
  const rows = seed.map((r) => ({ ...r }));

  const matches = (row: Record<string, unknown>, where: Where = {}): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === "OR") {
        return (cond as Where[]).some((w) => matches(row, w));
      }
      if (key === "AND") {
        return (cond as Where[]).every((w) => matches(row, w));
      }
      const value = row[key];
      if (cond === null) return value === null || value === undefined;
      if (typeof cond === "object" && cond !== null && "contains" in cond) {
        const { contains, mode } = cond as { contains: string; mode?: string };
        if (typeof value !== "string") return false;
        return mode === "insensitive"
          ? value.toLowerCase().includes(contains.toLowerCase())
          : value.includes(contains);
      }
      if (cond instanceof Date && value instanceof Date) {
        return cond.getTime() === value.getTime();
      }
      return value === cond;
    });

  const sort = (list: Item[], orderBy?: Record<string, "asc" | "desc">) => {
    if (!orderBy) return list;
    const [[field, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => {
      const av = (a as Record<string, unknown>)[field] as number | string;
      const bv = (b as Record<string, unknown>)[field] as number | string;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const delegate = {
    findMany: vi.fn(async (args: { where?: Where; skip?: number; take?: number; orderBy?: Record<string, "asc" | "desc"> } = {}) => {
      const filtered = sort(
        rows.filter((r) => matches(r, args.where)),
        args.orderBy,
      );
      const start = args.skip ?? 0;
      const end = args.take === undefined ? undefined : start + args.take;
      return filtered.slice(start, end).map((r) => ({ ...r }));
    }),
    count: vi.fn(async (args: { where?: Where } = {}) =>
      rows.filter((r) => matches(r, args.where)).length,
    ),
    findUnique: vi.fn(async (args: { where: Where }) => {
      const row = rows.find((r) => matches(r, args.where));
      return row ? { ...row } : null;
    }),
    create: vi.fn(async (args: { data: Partial<Item> }) => {
      const row = { id: rows.length + 1, deletedAt: null, name: "", ...args.data };
      rows.push(row);
      return { ...row };
    }),
    update: vi.fn(async (args: { where: Where; data: Partial<Item> }) => {
      const row = rows.find((r) => matches(r, args.where));
      if (!row) throw new Error("Record to update not found");
      Object.assign(row, args.data);
      return { ...row };
    }),
    delete: vi.fn(async (args: { where: Where }) => {
      const idx = rows.findIndex((r) => matches(r, args.where));
      const [row] = rows.splice(idx, 1);
      return row;
    }),
  };

  return {
    delegate,
    rows,
    model: delegate as unknown as DrizzleModelDelegate<Item, Partial<Item>, Partial<Item>>,
  };
}

const seed = (): Item[] => [
  { id: 1, name: "Alpha", deletedAt: null },
  { id: 2, name: "Beta", deletedAt: null },
  { id: 3, name: "Gamma", deletedAt: null },
  { id: 4, name: "alphabet", deletedAt: new Date("2025-01-01T00:00:00Z") },
];

describe("BaseRepository soft delete", () => {
  let store: ReturnType<typeof createInMemoryDelegate>;
  let repo: BaseRepository<Item>;

  beforeEach(() => {
    store = createInMemoryDelegate(seed());
    repo = new BaseRepository<Item>(store.model, {
      defaultOrderBy: { id: "asc" },
      searchFields: ["name"],
    });
  });

  describe("delete", () => {
    it("keeps the row and stamps deletedAt instead of removing it", async () => {
      const before = Date.now();
      await repo.delete(1);
      const after = Date.now();

      const row = store.rows.find((r) => r.id === 1);
      expect(row).toBeDefined();
      expect(row!.deletedAt).toBeInstanceOf(Date);
      expect(row!.deletedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(row!.deletedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it("never issues a hard delete against the model", async () => {
      await repo.delete(1);
      expect(store.delegate.delete).not.toHaveBeenCalled();
    });

    it("returns the deleted entity", async () => {
      const result = await repo.delete(2);
      expect(result).toMatchObject({ id: 2, name: "Beta" });
      expect(result!.deletedAt).toBeInstanceOf(Date);
    });

    it("returns null for an id that does not exist", async () => {
      await expect(repo.delete(999)).resolves.toBeNull();
      expect(store.delegate.update).not.toHaveBeenCalled();
    });

    it("returns null for an already deleted entity and keeps the original timestamp", async () => {
      const original = store.rows.find((r) => r.id === 4)!.deletedAt!.getTime();

      await expect(repo.delete(4)).resolves.toBeNull();
      expect(store.rows.find((r) => r.id === 4)!.deletedAt!.getTime()).toBe(original);
    });

    it("is idempotent when called twice in a row", async () => {
      const first = await repo.delete(1);
      const stamp = store.rows.find((r) => r.id === 1)!.deletedAt!.getTime();
      const second = await repo.delete(1);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(store.rows.find((r) => r.id === 1)!.deletedAt!.getTime()).toBe(stamp);
    });

    it("does not touch other rows", async () => {
      await repo.delete(1);
      expect(store.rows.find((r) => r.id === 2)!.deletedAt).toBeNull();
      expect(store.rows.find((r) => r.id === 3)!.deletedAt).toBeNull();
    });
  });

  describe("reads exclude deleted rows", () => {
    it("getById returns null for a deleted entity", async () => {
      await expect(repo.getById(4)).resolves.toBeNull();
    });

    it("getById returns an entity deleted during the test as null", async () => {
      await repo.delete(2);
      await expect(repo.getById(2)).resolves.toBeNull();
    });

    it("getById still returns active entities", async () => {
      await expect(repo.getById(1)).resolves.toMatchObject({ id: 1 });
    });

    it("getAll omits deleted entities", async () => {
      await repo.delete(3);
      const all = await repo.getAll();
      expect(all.map((i) => i.id)).toEqual([1, 2]);
    });

    it("find omits deleted entities that match the filter", async () => {
      const found = await repo.find({ name: "alphabet" });
      expect(found).toEqual([]);
    });

    it("find with an empty filter returns only active entities", async () => {
      const found = await repo.find({});
      expect(found.map((i) => i.id).sort()).toEqual([1, 2, 3]);
    });

    it("find does not let the caller override the filter to see deleted rows", async () => {
      const found = await repo.find({ deletedAt: store.rows[3].deletedAt });
      expect(found).toEqual([]);
    });

    it("getAllPaged counts only active entities in total and totalPages", async () => {
      const page = await repo.getAllPaged({ page: 1, limit: 2, skip: 0, take: 2 });
      expect(page.total).toBe(3);
      expect(page.totalPages).toBe(2);
      expect(page.data.every((i) => i.deletedAt === null)).toBe(true);
    });

    it("getAllPaged last page does not contain deleted entities", async () => {
      const page = await repo.getAllPaged({ page: 2, limit: 2, skip: 2, take: 2 });
      expect(page.data.map((i) => i.id)).toEqual([3]);
    });

    it("getAllPaged returns an empty page when everything is deleted", async () => {
      await repo.delete(1);
      await repo.delete(2);
      await repo.delete(3);
      const page = await repo.getAllPaged({ page: 1, limit: 10, skip: 0, take: 10 });
      expect(page).toMatchObject({ data: [], total: 0, totalPages: 0 });
    });

    it("searchAllPaged does not return deleted matches", async () => {
      // "alpha" potriveste atat "Alpha" (activ) cat si "alphabet" (sters)
      const page = await repo.searchAllPaged({
        page: 1,
        limit: 10,
        skip: 0,
        take: 10,
        search: "alpha",
      });
      expect(page.data.map((i) => i.id)).toEqual([1]);
      expect(page.total).toBe(1);
    });

    it("searchAllPaged without a search term still excludes deleted rows", async () => {
      const page = await repo.searchAllPaged({ page: 1, limit: 10, skip: 0, take: 10 });
      expect(page.total).toBe(3);
    });
  });

  describe("writes on deleted rows", () => {
    it("update returns null for a deleted entity and leaves it unchanged", async () => {
      await expect(repo.update(4, { name: "revived" })).resolves.toBeNull();
      expect(store.rows.find((r) => r.id === 4)!.name).toBe("alphabet");
    });

    it("update cannot clear deletedAt to restore an entity", async () => {
      await expect(repo.update(4, { deletedAt: null })).resolves.toBeNull();
      expect(store.rows.find((r) => r.id === 4)!.deletedAt).not.toBeNull();
    });

    it("update still works for active entities", async () => {
      await expect(repo.update(1, { name: "Alpha 2" })).resolves.toMatchObject({
        id: 1,
        name: "Alpha 2",
      });
    });
  });

  describe("options", () => {
    type Doc = { uuid: string; title: string; removedOn: Date | null };

    it("respects a custom softDeleteField and idField", async () => {
      const rows: Doc[] = [
        { uuid: "a", title: "A", removedOn: null },
        { uuid: "b", title: "B", removedOn: null },
      ];
      const delegate = {
        findMany: vi.fn(async (args: { where?: Where } = {}) =>
          rows.filter((r) => Object.entries(args.where ?? {}).every(([k, v]) =>
            v === null ? r[k as keyof Doc] == null : r[k as keyof Doc] === v,
          )),
        ),
        count: vi.fn(async () => 0),
        findUnique: vi.fn(async (args: { where: Where }) =>
          rows.find((r) => r.uuid === args.where.uuid) ?? null,
        ),
        create: vi.fn(),
        update: vi.fn(async (args: { where: Where; data: Partial<Doc> }) => {
          const row = rows.find((r) => r.uuid === args.where.uuid)!;
          Object.assign(row, args.data);
          return row;
        }),
        delete: vi.fn(),
      };

      const docs = new BaseRepository<Doc, Partial<Doc>, Partial<Doc>, string>(
        delegate as unknown as DrizzleModelDelegate<Doc, Partial<Doc>, Partial<Doc>>,
        { idField: "uuid", softDeleteField: "removedOn" },
      );

      await docs.delete("a");

      expect(rows[0].removedOn).toBeInstanceOf(Date);
      expect(delegate.delete).not.toHaveBeenCalled();
      await expect(docs.getById("a")).resolves.toBeNull();
      expect((await docs.getAll()).map((d) => d.uuid)).toEqual(["b"]);
    });

    it("treats entities whose soft delete field is undefined as active", async () => {
      const loose = createInMemoryDelegate([
        { id: 1, name: "no column" } as unknown as Item,
      ]);
      const r = new BaseRepository<Item>(loose.model);
      await expect(r.getById(1)).resolves.toMatchObject({ id: 1 });
    });
  });
});
