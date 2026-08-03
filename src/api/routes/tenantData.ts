import { Router } from "express";
import type { AuthedRequest } from "../middleware/requireAuth";
import {
  assertAllowedTable,
  quoteIdent,
  withTenantClient,
} from "../lib/tenantSql";

const router = Router();

type FilterOp = "eq" | "in" | "gte" | "lte";

type ParsedFilter = {
  column: string;
  op: FilterOp;
  value: unknown;
};

function parseFilters(query: Record<string, unknown>): ParsedFilter[] {
  const filters: ParsedFilter[] = [];

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    if (["select", "order", "limit", "count", "single"].includes(key)) continue;

    if (key.startsWith("eq.")) {
      filters.push({ column: key.slice(3), op: "eq", value: String(rawValue) });
      continue;
    }
    if (key.startsWith("in.")) {
      const list = String(rawValue)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      filters.push({ column: key.slice(3), op: "in", value: list });
      continue;
    }
    if (key.startsWith("gte.")) {
      filters.push({ column: key.slice(4), op: "gte", value: String(rawValue) });
      continue;
    }
    if (key.startsWith("lte.")) {
      filters.push({ column: key.slice(4), op: "lte", value: String(rawValue) });
      continue;
    }

    // Shorthand: ?status=pending → eq.status
    filters.push({ column: key, op: "eq", value: String(rawValue) });
  }

  return filters;
}

function buildWhere(filters: ParsedFilter[], params: unknown[]): string {
  const clauses: string[] = [];

  for (const filter of filters) {
    const col = quoteIdent(filter.column);
    if (filter.op === "eq") {
      params.push(filter.value);
      clauses.push(`${col} = $${params.length}`);
    } else if (filter.op === "gte") {
      params.push(filter.value);
      clauses.push(`${col} >= $${params.length}`);
    } else if (filter.op === "lte") {
      params.push(filter.value);
      clauses.push(`${col} <= $${params.length}`);
    } else if (filter.op === "in") {
      const values = filter.value as string[];
      if (values.length === 0) {
        clauses.push("FALSE");
      } else {
        const placeholders = values.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        clauses.push(`${col} IN (${placeholders.join(", ")})`);
      }
    }
  }

  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function parseOrder(orderParam: string | undefined): string {
  if (!orderParam) return "";
  const [col, dir] = orderParam.split(".");
  if (!col || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) return "";
  const direction = dir?.toLowerCase() === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${quoteIdent(col)} ${direction}`;
}

function pickColumns(selectParam: string | undefined): string {
  if (!selectParam || selectParam === "*") return "*";
  const cols = selectParam
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));
  return cols.length ? cols.map(quoteIdent).join(", ") : "*";
}

function getTenantDb(req: AuthedRequest & { tenantDb?: string }): string {
  return req.tenantDb || "public";
}

/** GET /api/data/:table — list or count rows */
router.get("/:table", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const filters = parseFilters(req.query as Record<string, unknown>);
    const params: unknown[] = [];
    const where = buildWhere(filters, params);
    const order = parseOrder(String(req.query.order || ""));
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const countOnly = String(req.query.count || "") === "true";
    const columns = pickColumns(String(req.query.select || "*"));

    const result = await withTenantClient(tenantDb, async (query) => {
      if (countOnly) {
        const sql = `SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)} ${where}`;
        const { rows } = await query(sql, params);
        return { count: Number(rows[0]?.count ?? 0), rows: [] as Record<string, unknown>[] };
      }

      let sql = `SELECT ${columns} FROM ${quoteIdent(table)} ${where}`;
      if (order) sql += ` ${order}`;
      if (limit && Number.isFinite(limit)) sql += ` LIMIT ${Math.min(Math.max(limit, 1), 5000)}`;

      const { rows } = await query(sql, params);
      return { count: rows.length, rows };
    });

    if (countOnly) {
      res.json({ count: result.count, data: null });
      return;
    }

    res.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/data/:table]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Query failed",
    });
  }
});

/** GET /api/data/:table/:id — single row */
router.get("/:table/:id", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const id = String(req.params.id);
    const columns = pickColumns(String(req.query.select || "*"));

    const row = await withTenantClient(tenantDb, async (query) => {
      const sql = `SELECT ${columns} FROM ${quoteIdent(table)} WHERE ${quoteIdent("id")} = $1 LIMIT 1`;
      const { rows } = await query(sql, [id]);
      return rows[0] ?? null;
    });

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ data: row });
  } catch (err) {
    console.error("[GET /api/data/:table/:id]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Query failed",
    });
  }
});

/** POST /api/data/:table — insert one or many rows */
router.post("/:table", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const body = req.body;
    const rows: Record<string, unknown>[] = Array.isArray(body) ? body : [body];
    const returnRows = String(req.query.returning || "true") !== "false";

    if (rows.length === 0 || typeof rows[0] !== "object") {
      res.status(400).json({ error: "Request body must be an object or array of objects" });
      return;
    }

    const inserted = await withTenantClient(tenantDb, async (query) => {
      const results: Record<string, unknown>[] = [];

      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
        if (keys.length === 0) continue;

        const cols = keys.map(quoteIdent).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const values = keys.map((k) => row[k]);

        const sql = returnRows
          ? `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders}) RETURNING *`
          : `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders})`;

        const { rows: insertedRows } = await query(sql, values);
        if (returnRows && insertedRows[0]) results.push(insertedRows[0]);
      }

      return results;
    });

    res.status(201).json({ data: rows.length === 1 ? inserted[0] ?? null : inserted });
  } catch (err) {
    console.error("[POST /api/data/:table]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Insert failed",
    });
  }
});

/** PATCH /api/data/:table/:id — update by id */
router.patch("/:table/:id", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const id = String(req.params.id);
    const body = req.body as Record<string, unknown>;

    const keys = Object.keys(body || {}).filter((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
    if (keys.length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const setClause = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(", ");
    const values = keys.map((k) => body[k]);
    values.push(id);

    const updated = await withTenantClient(tenantDb, async (query) => {
      const sql = `UPDATE ${quoteIdent(table)} SET ${setClause} WHERE ${quoteIdent("id")} = $${values.length} RETURNING *`;
      const { rows } = await query(sql, values);
      return rows[0] ?? null;
    });

    res.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/data/:table/:id]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Update failed",
    });
  }
});

/** PATCH /api/data/:table — update by filters (query params) */
router.patch("/:table", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const body = req.body as Record<string, unknown>;
    const filters = parseFilters(req.query as Record<string, unknown>);

    if (filters.length === 0) {
      res.status(400).json({ error: "At least one filter query param is required" });
      return;
    }

    const keys = Object.keys(body || {}).filter((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
    if (keys.length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const params: unknown[] = keys.map((k) => body[k]);
    const setClause = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(", ");
    const where = buildWhere(filters, params);

    await withTenantClient(tenantDb, async (query) => {
      const sql = `UPDATE ${quoteIdent(table)} SET ${setClause} ${where}`;
      await query(sql, params);
    });

    res.json({ data: null });
  } catch (err) {
    console.error("[PATCH /api/data/:table]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Update failed",
    });
  }
});

/** DELETE /api/data/:table/:id */
router.delete("/:table/:id", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const id = String(req.params.id);

    await withTenantClient(tenantDb, async (query) => {
      await query(`DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent("id")} = $1`, [id]);
    });

    res.json({ data: null });
  } catch (err) {
    console.error("[DELETE /api/data/:table/:id]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Delete failed",
    });
  }
});

/** DELETE /api/data/:table — delete by filters */
router.delete("/:table", async (req, res) => {
  try {
    const table = assertAllowedTable(req.params.table);
    const tenantDb = getTenantDb(req as AuthedRequest & { tenantDb?: string });
    const filters = parseFilters(req.query as Record<string, unknown>);

    if (filters.length === 0) {
      res.status(400).json({ error: "At least one filter query param is required" });
      return;
    }

    const params: unknown[] = [];
    const where = buildWhere(filters, params);

    await withTenantClient(tenantDb, async (query) => {
      await query(`DELETE FROM ${quoteIdent(table)} ${where}`, params);
    });

    res.json({ data: null });
  } catch (err) {
    console.error("[DELETE /api/data/:table]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Delete failed",
    });
  }
});

export default router;
