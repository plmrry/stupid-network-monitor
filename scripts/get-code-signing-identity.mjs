import { execSync } from "node:child_process";

export async function getCodeSigningIdentity() {
  const output = execSync(`pnpm get-identities`).toString();
  const lines = output.split("\n");
  const regex = /\d\)\s(?<secret>.+?)\s"(?<name>.+?)"/;
  for (const line of lines) {
    const matches = line.match(regex);
    if (!matches) continue;
    const groups = matches?.groups;
    if (!groups) continue;
    const { name } = groups;
    if (/Developer ID Application/.test(name)) {
      console.log(`Found code signing identity: ${name}`);
      console.error(`Found code signing identity: ${name}`);
      return name;
    }
  }
  return undefined;
}
