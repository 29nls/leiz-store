/**
 * Build a PostgREST `.or()` expression for a case-insensitive substring match
 * across the given columns.
 *
 * The user-supplied `term` is percent-encoded before interpolation so it is
 * always treated as a literal value, never as filter syntax. Every character
 * PostgREST treats as filter syntax in a value position is encoded: `,`
 * (condition separator → `%2C`), `"` (quoted-value token → `%22`), `%`
 * (pattern widening → `%25`) and `(`/`)` (logical-group tokens → `%28`/`%29`,
 * which `encodeURIComponent` alone would leave raw). PostgREST URL-decodes
 * the value portion of a filter, so these all round-trip back to plain
 * characters in the LIKE pattern instead of altering the expression.
 *
 * This mirrors the encoding already used in `src/lib/supabase-db.ts`
 * (`buildFilters`), keeping every `.or()` construction in the codebase on the
 * same convention.
 */
export function buildIlikeOrFilter(columns: string[], term: string): string {
  // encodeURIComponent leaves `(` and `)` raw (RFC-3986 unreserved), but
  // PostgREST parses them as logical-group tokens — encode them explicitly.
  const escaped = encodeURIComponent(term).replace(/[()]/g, (c) =>
    c === "(" ? "%28" : "%29"
  );
  return columns.map((column) => `${column}.ilike.%${escaped}%`).join(",");
}
