// @ts-check

import { api } from "@electron-forge/core";

await api.package({
  arch: "arm64",
  interactive: true,
  platform: "darwin",
});
