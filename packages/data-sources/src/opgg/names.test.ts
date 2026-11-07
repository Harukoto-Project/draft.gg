import { describe, expect, it } from "vitest";

import { createNameIndex, toOpggChampionKey } from "./names.js";

describe("toOpggChampionKey", () => {
  it("英語名を OP.GG のキーにする", () => {
    expect(toOpggChampionKey("Ahri")).toBe("AHRI");
    expect(toOpggChampionKey("Lee Sin")).toBe("LEE_SIN");
    expect(toOpggChampionKey("Kai'Sa")).toBe("KAISA");
    expect(toOpggChampionKey("Dr. Mundo")).toBe("DR_MUNDO");
    expect(toOpggChampionKey("Vel'Koz")).toBe("VELKOZ");
    expect(toOpggChampionKey("Nunu & Willump")).toBe("NUNU");
  });
});

describe("createNameIndex", () => {
  it("表示名と Data Dragon のキーのどちらでも引ける", () => {
    const index = createNameIndex([
      {
        id: "Velkoz",
        nameJa: "ベルコズ",
        nameEn: "Vel'Koz",
        numericKey: 161,
        damageType: null,
      },
    ]);

    expect(index.get("velkoz")?.id).toBe("Velkoz");
  });
});
