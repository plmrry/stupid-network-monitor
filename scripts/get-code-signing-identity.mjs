// @ts-check

import { execFileSync } from "node:child_process";

export async function getCodeSigningIdentity() {
  const output = execFileSync(`security find-identity -v -p codesigning`, {
    shell: true,
  }).toString();
  const lines = output.split("\n");
  const regex = /\d\)\s(?<secret>.+?)\s"(?<name>.+?)"/;
  for (const line of lines) {
    const matches = line.match(regex);
    if (!matches) continue;
    const groups = matches?.groups;
    if (!groups) continue;
    const { name } = groups;
    if (/Developer ID Application/.test(name)) {
      console.log(`Using code signing identity: ${name}`);
      return name;
    }
  }
  return undefined;
}
