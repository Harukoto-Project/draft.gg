import { createDdragonClient } from "@draftgg/data-sources";
import { saveChampionMaster } from "@draftgg/db";
import type { Database } from "@draftgg/db";

import type { Job } from "../runner/index.js";
import { createDdragonJob } from "./ddragon.js";

/** 常駐スケジューラに登録するジョブ。1ジョブ = 1ファイルで追加し、ここに並べる。 */
export function createJobs(db: Database): Job[] {
  return [
    createDdragonJob({
      client: createDdragonClient(),
      save: (input) => saveChampionMaster(db, input),
    }),
  ];
}
