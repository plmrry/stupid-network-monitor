// @ts-check

import fs from "node:fs";
import stream from "node:stream";

const SPEEDTEST_URL = `https://paulmurray.lol/api/speedtest`;
const url = new URL(SPEEDTEST_URL);

const DOWNLOAD_COUNT = 10;
const UPLOAD_COUNT = DOWNLOAD_COUNT * 0.5;

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

  const writeStream = await fs.createWriteStream(fileName);

  await stream.promises.pipeline(stream.Readable.fromWeb(response.body), writeStream);
}

/**
 * @param {{ fileName: string, method?: "GET" | "POST" }} parameters
 */
async function uploadFile({ fileName }) {
  url.searchParams.set("random", getRandom());

  const fileBuffer = await fs.promises.readFile(fileName);

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

    const writeStream = await fs.createWriteStream(fileName);

    await stream.promises.pipeline(stream.Readable.fromWeb(response.body), writeStream);
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
