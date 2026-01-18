// @ts-check
/** biome-ignore-all lint/correctness/noUnusedVariables: Allow unused variables. */

import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ONE_MEG = 1_000_000;
const TEN_MEG = 10_000_000;
const ONE_HUNDRED_MEG = 100_000_000;
const ONE_GIG = 1_000_000_000;

const size = ONE_MEG;

const DOWNLOAD_COUNT = 20;
const UPLOAD_COUNT = 10;

const downloadArray = Array.from({ length: DOWNLOAD_COUNT });
const uploadArray = Array.from({ length: UPLOAD_COUNT });

async function fetchFile(size, fileName) {
  const url = new URL(`https://speed.cloudflare.com/__down`);

  url.searchParams.append("bytes", size.toString());
  url.searchParams.append(
    "rand",
    Math.floor(Math.random() * 1_000_000).toString()
  );

  // Download using fetch and stream to file
  const response = await fetch(url.toString(), {
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Stream response body to file
  await pipeline(
    // @ts-ignore
    Readable.fromWeb(response.body),
    createWriteStream(fileName)
  );
}

/**
 * DOWNLOAD
 */
for (const index of downloadArray.keys()) {
  const url = new URL(`https://speed.cloudflare.com/__down`);

  url.searchParams.append("bytes", size.toString());

  console.log(`Fetching ${index + 1} of ${DOWNLOAD_COUNT}...`, url.toString());

  const fileName = `/tmp/test-download-${index}.txt`;

  // Download using fetch and stream to file
  await fetchFile(size, fileName);

  console.log(`Fetching ${index + 1} of ${DOWNLOAD_COUNT}... Done.`);
}

console.log(`Uploading big files...`);

/**
 * UPLOAD
 */
for (const index of uploadArray.keys()) {
  console.log(`Uploading ${index + 1} of ${UPLOAD_COUNT}...`);

  const uploadUrl = new URL(`https://speed.cloudflare.com/__up`);
  uploadUrl.searchParams.append(
    "rand",
    Math.floor(Math.random() * 1_000_000).toString()
  );

  const fileName = `/tmp/test-download-${index}.txt`;

  // Upload using fetch with file stream
  const fileStream = createReadStream(fileName);

  const uploadResponse = await fetch(uploadUrl.toString(), {
    // @ts-ignore
    body: Readable.toWeb(fileStream),
    duplex: "half",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
    method: "POST",
  });

  if (!uploadResponse.ok) {
    throw new Error(`HTTP error! status: ${uploadResponse.status}`);
  }

  console.log(`Uploading ${index + 1} of ${UPLOAD_COUNT}... Done.`);
}
