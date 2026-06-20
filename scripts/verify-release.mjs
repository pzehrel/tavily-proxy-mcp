import { readFile } from "node:fs/promises";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag) {
  throw new Error("Usage: pnpm release:verify v<version>");
}

/** @type {unknown} */
const packageJsonValue = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

if (
  !packageJsonValue ||
  typeof packageJsonValue !== "object" ||
  !("version" in packageJsonValue) ||
  typeof packageJsonValue.version !== "string"
) {
  throw new Error("package.json must contain a string version");
}

const version = /** @type {string} */ (packageJsonValue.version);
const expectedTag = `v${version}`;

if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match package version ${version}`);
}

const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const heading = `## [${version}]`;

if (!changelog.includes(heading)) {
  throw new Error(`CHANGELOG.md is missing the ${heading} release section`);
}

process.stdout.write(`Release metadata verified for ${tag}\n`);
