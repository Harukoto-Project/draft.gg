import { metaResponseSchema } from "@draftgg/shared";
import type { MetaResponse } from "@draftgg/shared";

import { apiFetch } from "@/services/http";

export async function loadMeta(): Promise<MetaResponse> {
  const response = await apiFetch("/api/meta");
  if (!response.ok) {
    throw new Error("meta_unavailable");
  }

  const body: unknown = await response.json();
  return metaResponseSchema.parse(body);
}
