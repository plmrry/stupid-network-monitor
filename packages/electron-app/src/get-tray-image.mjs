// @ts-check

import * as d3 from "d3";

export const MAX_BARS = 20;
const CHART_WIDTH = 2;
const TEXT_WIDTH = 6;
const FONT_SIZE = 0.3;
export const SCALE_FACTOR = 2;
const COLOR = "white";
const MAX_SAMPLE_INTERVAL_MILLISECONDS = 5_000;

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number, timestamp: string }} NetworkDatum
 */

/**
 * @typedef {{
 *   inputGbps: number,
 *   outputGbps: number
 * }} NetworkMeasurement
 */

/**
 * @param {{ width: number | string, height: number | string, children: string }} options
 * @returns {string}
 */
function svgWrapper({ width, height, children }) {
  return /* html */ `
<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
>
  ${children}
</svg>
`;
}

/**
 * @param {{ x1: number | string, y1: number | string, x2: number | string, y2: number | string, stroke: string, strokeWidth: number }} options
 * @returns {string}
 */
function lineSvg({ x1, y1, x2, y2, stroke, strokeWidth }) {
  return /* html */ `
<line
  x1="${x1}"
  y1="${y1}"
  x2="${x2}"
  y2="${y2}"
  shape-rendering="crispEdges"
  stroke="${stroke}"
  stroke-width="${strokeWidth}"
  opacity="1"
/>
`;
}

/**
 * @param {{ x: number | string, y: number | string, children: string, color: string, fontSize: number }} options
 * @returns {string}
 */
function textSvg({ children, color, fontSize, x, y }) {
  return /* html */ `
<text
  alignment-baseline="middle"
  fill="${color}"
  font-size="${fontSize}"
  text-anchor="end"
  text-rendering="geometricPrecision"
  x="${x}"
  y="${y}"
>
  ${children}
</text>`;
}

/**
 * Convert bytes transferred during an interval to gigabits per second.
 *
 * @param {number} bytes
 * @param {number} durationMilliseconds
 * @returns {number}
 */
function bytesToGbps(bytes, durationMilliseconds) {
  if (durationMilliseconds <= 0) return 0;

  const bits = bytes * 8;
  const durationSeconds = durationMilliseconds / 1_000;
  return bits / durationSeconds / 1_000_000_000;
}

/**
 * Derive per-interval network rates from timestamped byte counts.
 *
 * @param {NetworkDatum[]} history
 * @returns {NetworkMeasurement[]}
 */
function getMeasurements(history) {
  /** @type {NetworkMeasurement[]} */
  const measurements = [];

  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];

    const durationMilliseconds = Date.parse(current.timestamp) - Date.parse(previous.timestamp);

    if (
      !Number.isFinite(durationMilliseconds) ||
      durationMilliseconds <= 0 ||
      durationMilliseconds > MAX_SAMPLE_INTERVAL_MILLISECONDS
    ) {
      continue;
    }

    measurements.push({
      inputGbps: bytesToGbps(current.inputBytes, durationMilliseconds),
      outputGbps: bytesToGbps(current.outputBytes, durationMilliseconds),
    });
  }

  return measurements;
}

/**
 * @param {number} gbps
 * @returns {string}
 */
function formatGbps(gbps) {
  return `${gbps.toFixed(2)} Gbps`;
}

/**
 * Image should be: `32x32@2x (144dpi)`
 *
 * @see: https://www.electronjs.org/docs/latest/api/tray#macos
 *
 * @param {{ history: NetworkDatum[], trayHeight?: number, color?: string }} options
 * @returns {string}
 */
export function getTrayImage({ history, trayHeight }) {
  const scaledTrayHeight = Math.floor(trayHeight * SCALE_FACTOR);

  const measurements = getMeasurements(history);
  const data = measurements.slice(-MAX_BARS);

  const totalHeight = (scaledTrayHeight ?? 30) * 0.9;
  const fontSize = totalHeight * FONT_SIZE;

  const textBoxWidth = Math.floor(fontSize * TEXT_WIDTH);

  const chartBoxWidth = Math.floor(scaledTrayHeight * CHART_WIDTH);

  const totalWidth = Math.floor(textBoxWidth + chartBoxWidth);

  const halfHeight = totalHeight * 0.5;

  /**
   * Get max values for scaling the chart.
   * Use more than what's displayed to prevent big jumps.
   * Make vague assumptions about internet speeds if no data yet.
   */
  const maxOutput = d3.max(measurements, (measurement) => measurement.outputGbps) || 0.001;
  const maxInput = d3.max(measurements, (measurement) => measurement.inputGbps) || 0.1;

  const displayedMaxOutput = d3.max(data, (measurement) => measurement.outputGbps) || 0;
  const displayedMaxInput = d3.max(data, (measurement) => measurement.inputGbps) || 0;

  const strokeWidth = (totalWidth / MAX_BARS) * 0.2;

  const xScale = d3.scalePoint(d3.range(0, MAX_BARS), [totalWidth, textBoxWidth]).padding(0.8);

  const heightScaleInput = d3.scaleLinear([0, maxInput], [0, halfHeight]);
  const heightScaleOutput = d3.scaleLinear([0, maxOutput], [0, halfHeight]);

  /** @type {string[]} */
  const bars = [];

  for (const [index, datum] of data.entries()) {
    const x = xScale(index);
    const { inputGbps, outputGbps } = datum;

    const outputHeight = heightScaleOutput(outputGbps);
    const inputHeight = heightScaleInput(inputGbps);

    /**
     * Output is on top, pointing upwards.
     * Input is on bottom, pointing downwards.
     */

    const outputY1 = halfHeight;
    const outputY2 = outputY1 - outputHeight;

    const inputY1 = halfHeight;
    const inputY2 = halfHeight + inputHeight;

    const outputBar = lineSvg({
      stroke: COLOR,
      strokeWidth,
      x1: x,
      x2: x,
      y1: outputY1,
      y2: outputY2,
    });

    const inputBar = lineSvg({
      stroke: COLOR,
      strokeWidth,
      x1: x,
      x2: x,
      y1: inputY1,
      y2: inputY2,
    });

    bars.push(outputBar);
    bars.push(inputBar);
  }

  const MARGIN = totalWidth * 0.05;

  const textX = textBoxWidth - MARGIN;

  const outMaxString = formatGbps(displayedMaxOutput);
  const inMaxString = formatGbps(displayedMaxInput);

  const pad = 15;

  const outString = outMaxString.padStart(pad);
  const inString = inMaxString.padStart(pad);

  const children = [
    bars.join("\n"),
    lineSvg({
      x1: textBoxWidth,
      x2: totalWidth,
      y1: halfHeight,
      y2: halfHeight,
      stroke: COLOR,
      strokeWidth: 2,
    }),
    textSvg({
      children: outString,
      color: COLOR,
      fontSize,
      x: textX,
      y: "30%",
    }),
    textSvg({
      children: inString,
      color: COLOR,
      fontSize,
      x: textX,
      y: "70%",
    }),
  ].join("\n");

  const svgString = svgWrapper({
    children,
    height: totalHeight,
    width: totalWidth,
  });

  return svgString;
}
