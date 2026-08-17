// @ts-check

import fs from "node:fs/promises";
import { app } from "electron";

/**
 * Store 1 minute of history.
 *
 * @constant {number}
 */
const MAX_HISTORY_LENGTH = 1 * 60;

/**
 * File where history is stored in the `userData` folder.
 *
 * @constant {string}
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
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }
    const userDataPath = app.getPath("userData");
    const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
    await fs.writeFile(historyPath, JSON.stringify(history), "utf-8");
  },
};
