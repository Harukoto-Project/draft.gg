import { metaQuerySchema, metaResponseSchema } from "@draftgg/shared";
import type { MetaResponse, StatsSnapshot } from "@draftgg/shared";
import { POSITIONS } from "@draftgg/shared";
import { Hono } from "hono";

export interface MetaSource {
  getSnapshot(): StatsSnapshot;
}

export function createMetaRoute(source: MetaSource) {
  return new Hono().get("/", (c) => {
    const parsed = metaQuerySchema.safeParse({
      position: c.req.query("position") || undefined,
      tier: c.req.query("tier") || undefined,
    });
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

    const snapshot = source.getSnapshot();
    const tier = parsed.data.tier ?? snapshot.tier;
    const names = new Map(snapshot.champions.map((champion) => [champion.id, champion.nameJa]));
    const stats = (snapshot.tier === tier ? snapshot.meta : [])
      .filter((row) => parsed.data.position === undefined || row.position === parsed.data.position)
      .map((row) => ({
        ...row,
        nameJa: names.get(row.championId) ?? row.championId,
      }))
      .sort((a, b) => {
        const position = POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
        return (
          position ||
          a.tierRank - b.tierRank ||
          b.winRate - a.winRate ||
          a.championId.localeCompare(b.championId)
        );
      });

    const body: MetaResponse = metaResponseSchema.parse({ patch: snapshot.patch, tier, stats });
    c.header("Cache-Control", "public, max-age=300");
    return c.json(body);
  });
}
