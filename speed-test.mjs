// @ts-check

import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const SPEEDTEST_URL = `https://paulmurray.lol/api/speedtest`;
const url = new URL(SPEEDTEST_URL);

const DOWNLOAD_COUNT = 5;
const UPLOAD_COUNT = 1;

/** @returns {string} */
function getRandom() {
  return Math.floor(Math.random() * 1_000_000).toString();
}

const rand = getRandom();

/**
 * @param {number} index
 * @returns {string}
 */
function getFilePath(index) {
  return `/tmp/test-download-${rand}-${index}.txt`;
}

/**
 * @param {{ fileName: string, method?: "GET" | "POST" }} parameters
 */
async function downloadFile({ fileName }) {
  url.searchParams.set("random", getRandom());

  const response = await fetch(url.toString(), {
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  await pipeline(
    // @ts-expect-error
    Readable.fromWeb(response.body),
    createWriteStream(fileName)
  );
}

/**
 * @param {{ fileName: string, method?: "GET" | "POST" }} parameters
 */
async function uploadFile({ fileName }) {
  url.searchParams.set("random", getRandom());

  const { readFile } = await import("node:fs/promises");
  const fileBuffer = await readFile(fileName);

  // Use Blob to handle redirects properly
  const body = new Blob([fileBuffer]);

  // Upload using fetch
  try {
    const response = await fetch(url, {
      body,
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      },
      method: "POST",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed with status ${response.status}: ${text}`);
    }

    await pipeline(
      // @ts-expect-error
      Readable.fromWeb(response.body),
      createWriteStream(fileName)
    );
  } catch (error) {
    console.error("Upload error details:", error);
    if (error.cause) {
      console.error("Error cause:", error.cause);
    }
    throw error;
  }
}

/**
 * @returns {Promise<{ functionDuration: number }>}
 */
export async function speedTest() {
  const start = performance.now();

  /**
   * DOWNLOAD
   */
  for (const index of Array.from({ length: DOWNLOAD_COUNT }).keys()) {
    const fileName = getFilePath(index);
    await downloadFile({ fileName });
  }

  /**
   * UPLOAD
   */
  for (const index of Array.from({ length: UPLOAD_COUNT }).keys()) {
    const fileName = getFilePath(index);
    await uploadFile({ fileName });
  }

  const end = performance.now();

  const functionDuration = end - start;

  return {
    functionDuration,
  };
}
