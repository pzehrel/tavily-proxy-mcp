import packageJson from "../package.json";
import { describe, expect, it } from "vitest";
import { packageMetadata } from "../src/package-metadata.js";

describe("packageMetadata", () => {
  it("matches the published package metadata", () => {
    expect(packageMetadata).toEqual({
      name: packageJson.name,
      version: packageJson.version,
    });
  });
});
