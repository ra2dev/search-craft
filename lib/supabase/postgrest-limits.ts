/**
 * PostgREST `[api] max_rows` default (Supabase local + hosted API).
 * Unbounded `.select()` / `.insert().select()` responses are capped; paginate or batch past this.
 */
export const POSTGREST_MAX_ROWS = 1000;
