import { statusResponseSchema } from "@draftgg/shared";
import type { StatusResponse } from "@draftgg/shared";

import { request } from "@/services/http";

export async function loadStatus(signal?: AbortSignal): Promise<StatusResponse> {
  const response = await request("/api/status", { signal });
  return statusResponseSchema.parse(await response.json());
}
