import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationsUrl = new URL("../../../infra/postgres/", import.meta.url);

describe("PostgreSQL migration contract", () => {
  it("uses one unique numeric version per migration", async () => {
    const files = (await readdir(migrationsUrl))
      .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(file))
      .sort();
    const versions = files.map((file) => file.slice(0, 3));
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);

    expect(files.length).toBeGreaterThan(30);
    expect(duplicates).toEqual([]);
  });
});
