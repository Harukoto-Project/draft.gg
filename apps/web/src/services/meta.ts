import { metaResponseSchema } from "@draftgg/shared";
import type { MetaResponse } from "@draftgg/shared";

export async function loadMeta(): Promise<MetaResponse> {
  const response = await fetch("/api/meta");
  if (!response.ok) {
    throw new Error("meta_unavailable");
  }

  const body: unknown = await response.json();
  return metaResponseSchema.parse(body);
}
