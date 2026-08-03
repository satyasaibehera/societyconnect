import { apiFetch } from "@/services/apiClient";

export type TenantDbError = { message: string; status?: number };

type Filter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; values: unknown[] }
  | { type: "gte"; column: string; value: unknown };

type OrderSpec = { column: string; ascending: boolean };

type QueryResult<T> = Promise<{ data: T; error: TenantDbError | null; count?: number | null }>;

class TenantQueryBuilder<T = Record<string, unknown>> {
  private table: string;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private orderSpec: OrderSpec | null = null;
  private limitN: number | null = null;
  private countOnly = false;
  private headOnly = false;
  private singleMode: "one" | "maybe" | null = null;
  private insertPayload: unknown = null;
  private updatePayload: Record<string, unknown> | null = null;
  private returning = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    if (this.mode === "insert" || this.mode === "update") {
      this.returning = true;
      this.columns = columns;
      return this;
    }

    this.mode = "select";
    this.columns = columns;
    if (options?.count === "exact") {
      this.countOnly = true;
      this.headOnly = options.head === true;
    }
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderSpec = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  insert(payload: unknown): this {
    this.mode = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.mode = "update";
    this.updatePayload = payload;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  single(): QueryResult<T> {
    this.singleMode = "one";
    return this.execute() as QueryResult<T>;
  }

  maybeSingle(): QueryResult<T | null> {
    this.singleMode = "maybe";
    return this.execute() as QueryResult<T | null>;
  }

  then<TResult1 = { data: T[] | T | null; error: TenantDbError | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | T | null; error: TenantDbError | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildQueryString(): string {
    const params = new URLSearchParams();

    if (this.mode === "select") {
      if (this.countOnly) {
        params.set("count", "true");
        if (this.columns !== "*") params.set("select", this.columns);
      } else if (this.columns !== "*") {
        params.set("select", this.columns);
      }

      for (const filter of this.filters) {
        if (filter.type === "eq") {
          params.set(`eq.${filter.column}`, String(filter.value));
        } else if (filter.type === "in") {
          params.set(`in.${filter.column}`, filter.values.map(String).join(","));
        } else if (filter.type === "gte") {
          params.set(`gte.${filter.column}`, String(filter.value));
        }
      }

      if (this.orderSpec) {
        params.set(
          "order",
          `${this.orderSpec.column}.${this.orderSpec.ascending ? "asc" : "desc"}`,
        );
      }

      if (this.limitN != null) {
        params.set("limit", String(this.limitN));
      }
    } else if (this.mode === "update" || this.mode === "delete") {
      for (const filter of this.filters) {
        if (filter.type === "eq") {
          params.set(`eq.${filter.column}`, String(filter.value));
        } else if (filter.type === "in") {
          params.set(`in.${filter.column}`, filter.values.map(String).join(","));
        }
      }
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async execute(): Promise<{
    data: T[] | T | null;
    error: TenantDbError | null;
    count?: number | null;
  }> {
    try {
      if (this.mode === "insert") {
        const qs = this.returning ? "" : "?returning=false";
        const result = await apiFetch<T | T[]>(`/api/data/${this.table}${qs}`, {
          method: "POST",
          body: JSON.stringify(this.insertPayload),
        });

        if (result.error) return { data: null, error: result.error };

        const row = Array.isArray(result.data) ? result.data[0] : result.data;
        return { data: (row ?? null) as T | null, error: null };
      }

      if (this.mode === "update") {
        const idFilter = this.filters.find((f) => f.type === "eq" && f.column === "id");

        if (idFilter && idFilter.type === "eq" && this.filters.length === 1) {
          const result = await apiFetch<T>(`/api/data/${this.table}/${idFilter.value}`, {
            method: "PATCH",
            body: JSON.stringify(this.updatePayload),
          });
          if (result.error) return { data: null, error: result.error };
          return { data: (result.data ?? null) as T | null, error: null };
        }

        const result = await apiFetch<null>(`/api/data/${this.table}${this.buildQueryString()}`, {
          method: "PATCH",
          body: JSON.stringify(this.updatePayload),
        });
        if (result.error) return { data: null, error: result.error };
        return { data: null, error: null };
      }

      if (this.mode === "delete") {
        const idFilter = this.filters.find((f) => f.type === "eq" && f.column === "id");

        if (idFilter && idFilter.type === "eq" && this.filters.length === 1) {
          const result = await apiFetch<null>(`/api/data/${this.table}/${idFilter.value}`, {
            method: "DELETE",
          });
          if (result.error) return { data: null, error: result.error };
          return { data: null, error: null };
        }

        const result = await apiFetch<null>(`/api/data/${this.table}${this.buildQueryString()}`, {
          method: "DELETE",
        });
        if (result.error) return { data: null, error: result.error };
        return { data: null, error: null };
      }

      // select
      if (this.countOnly) {
        const result = await apiFetch<null>(`/api/data/${this.table}${this.buildQueryString()}`);
        if (result.error) return { data: null, error: result.error, count: null };
        return { data: this.headOnly ? null : [], error: null, count: result.count ?? 0 };
      }

      const result = await apiFetch<T[]>(`/api/data/${this.table}${this.buildQueryString()}`);
      if (result.error) return { data: null, error: result.error };

      const rows = (result.data ?? []) as T[];

      if (this.singleMode === "one") {
        if (rows.length === 0) {
          return { data: null, error: { message: "Row not found" } };
        }
        return { data: rows[0], error: null };
      }

      if (this.singleMode === "maybe") {
        return { data: (rows[0] ?? null) as T | null, error: null };
      }

      return { data: rows, error: null };
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : "Query failed" },
      };
    }
  }
}

/** Supabase-compatible tenant data client backed by society-connect /api/data routes. */
export const tenantDb = {
  from<T = Record<string, unknown>>(table: string): TenantQueryBuilder<T> {
    return new TenantQueryBuilder<T>(table);
  },
};
