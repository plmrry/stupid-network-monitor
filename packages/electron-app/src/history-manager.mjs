// @ts-check

import fs from "node:fs/promises";
import { app } from "electron";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{
 *  inputBytes: number;
 *  outputBytes: number;
 *  timestamp: string;
 * }} NetworkDatum
 */

/**
 * File where history is stored in the `userData` folder.
 */
const HISTORY_FILE_NAME = "history.json";

export const HistoryManager = {
  async read() {
    try {
      const userDataPath = app.getPath("userData");
      const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
      const parsed = await import(historyPath, { with: { type: "json" } }).then(
        (module) => module.default,
      );
      return parsed;
    } catch {
      return [];
    }
  },
  async write({ history }) {
    const userDataPath = app.getPath("userData");
    const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
    await fs.writeFile(historyPath, JSON.stringify(history), "utf-8");
  },
};
