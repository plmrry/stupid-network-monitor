// @ts-check
/// <reference types="node" />
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import stream from "node:stream";

const speedtestUrlPath = `/api/speedtest`;
const speedtestUrlOrigin = `https://paulmurray.lol`;
const speedtestUrl = new URL(speedtestUrlPath, speedtestUrlOrigin);

const DOWNLOAD_COUNT = 20;
const UPLOAD_COUNT = DOWNLOAD_COUNT;

/** @returns {string} */
function getRandom() {
  const array = new Uint32Array(2);
  const values = crypto.getRandomValues(array);
  return [...values].map((num) => num.toString(32)).join("");
}

const rand = getRandom();

/**
 * @param {number} index
 * @returns {string}
 */
function getFilePath(index) {
  return path.join(os.tmpdir(), `test-download-${rand}-${index}.txt`);
}

/**
 * @param {{ fileName: string, method?: "GET" | "POST" }} parameters
 */
async function downloadFile({ fileName }) {
  const random = getRandom();
  speedtestUrl.searchParams.set("random", random);

  const request = new Request(speedtestUrl, {
    cache: "no-store",
    headers: new Headers({
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    }),
    method: "GET",
  });

  const response = await fetch(request);

  await using readableStream = stream.Readable.fromWeb(response.body);

  await using writeStream = await fs.createWriteStream(fileName);

  await stream.promises.pipeline(readableStream, writeStream);
}

/**
 * @param {{ fileName: string, method?: "GET" | "POST" }} parameters
 */
async function uploadFile({ fileName }) {
  const random = getRandom();
  speedtestUrl.searchParams.set("random", random);

  await using readFileStream = fs.createReadStream(fileName);

  const request = new Request(speedtestUrl, {
    body: readFileStream,
    cache: "no-store",
    duplex: "half",
    headers: new Headers({
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    }),
    method: "POST",
  });

  const response = await fetch(request);

  await using readableStream = stream.Readable.fromWeb(response.body);

  await using writeStream = await fs.createWriteStream(fileName);

  await stream.promises.pipeline(readableStream, writeStream);
}

/**
 * @returns {Promise<{ functionDuration: number }>}
 */
export async function speedTest() {
  const start = performance.now();

  /**
   * DOWNLOAD
   */
  for (const index of Array(DOWNLOAD_COUNT).keys()) {
    const fileName = getFilePath(index);
    try {
      await downloadFile({ fileName });
    } catch {}
  }

  /**
   * UPLOAD
   */
  for (const index of Array(UPLOAD_COUNT).keys()) {
    const fileName = getFilePath(index);
    try {
      await uploadFile({ fileName });
    } catch {}
  }

  const end = performance.now();

  const functionDuration = end - start;

  return {
    functionDuration,
  };
}
