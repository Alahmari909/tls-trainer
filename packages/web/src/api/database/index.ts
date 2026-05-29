import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[database] DATABASE_URL is not set — server will start but DB calls will fail");
}

const client = createClient({
  url: dbUrl ?? "file:./fallback.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
