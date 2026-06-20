import { readFile } from "node:fs/promises";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag?.startsWith("v")) {
  throw new Error("Usage: pnpm release:notes v<version>");
}

const version = tag.slice(1);
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);

if (start < 0) {
  throw new Error(`CHANGELOG.md has no release notes for ${version}`);
}

const bodyStart = changelog.indexOf("\n", start) + 1;
const nextHeading = changelog.indexOf("\n## [", bodyStart);
const linkDefinitions = changelog.indexOf("\n[Unreleased]:", bodyStart);
const endCandidates = [nextHeading, linkDefinitions].filter((index) => index >= 0);
const bodyEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : undefined;
const body = changelog.slice(bodyStart, bodyEnd).trim();

if (!body) {
  throw new Error(`CHANGELOG.md has no release notes for ${version}`);
}

process.stdout.write(`${body}\n`);
