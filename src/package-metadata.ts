import { createRequire } from "node:module";

interface PackageMetadata {
  name: string;
  version: string;
}

const value: unknown = createRequire(import.meta.url)("../package.json");

if (
  !value ||
  typeof value !== "object" ||
  !("name" in value) ||
  typeof value.name !== "string" ||
  !("version" in value) ||
  typeof value.version !== "string"
) {
  throw new Error("package.json must contain string name and version fields");
}

export const packageMetadata: PackageMetadata = {
  name: value.name,
  version: value.version,
};
