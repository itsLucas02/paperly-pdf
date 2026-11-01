import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function pool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({ connectionString: databaseUrl });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

// Lazy so importing this module (build time, or a deploy without DATABASE_URL)
// does not throw; the workspace routes catch the error and return 503.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const client = drizzle(pool());
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});