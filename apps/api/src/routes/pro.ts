import { proChampionsQuerySchema, proChampionsResponseSchema } from "@draftgg/shared";
import type { ProChampionsResponse, ProLeague } from "@draftgg/shared";
import { Hono } from "hono";

export interface ProReader {
  load(query: { league?: ProLeague; patch?: string }): Promise<ProChampionsResponse>;
}

export function createProRoute(reader: ProReader) {
  return new Hono().get("/champions", async (c) => {
    const parsed = proChampionsQuerySchema.safeParse({
      league: c.req.query("league") || undefined,
      patch: c.req.query("patch") || undefined,
    });
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

    const body = proChampionsResponseSchema.parse(await reader.load(parsed.data));
    c.header("Cache-Control", "public, max-age=300");
    return c.json(body);
  });
}
