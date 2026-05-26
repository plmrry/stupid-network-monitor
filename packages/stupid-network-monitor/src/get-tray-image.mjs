// @ts-check

import * as d3 from "d3";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number }} NetworkDatum
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

export const MAX_BARS = 20;
const CHART_WIDTH = 2;
const TEXT_WIDTH = 12;
const FONT_SIZE = 0.3;
export const SCALE_FACTOR = 2;
const COLOR = "white";

/**
 * Image should be: `32x32@2x (144dpi)`
 *
 * @see: https://www.electronjs.org/docs/latest/api/tray#macos
 *
 * @param {{ history: NetworkDatum[], trayHeight?: number, color?: string }} options
 * @returns {string}
 */
export function getTrayImage({ history, trayHeight: _trayHeight }) {
  const scaledTrayHeight = Math.floor(_trayHeight * SCALE_FACTOR);

  const data = history.slice(-MAX_BARS);

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
  const maxOutput = d3.max(history, (d) => d.outputBytes) || 100_000;
  const maxInput = d3.max(history, (d) => d.inputBytes) || 10_000_000;

  const averageOutput = Math.floor(d3.mean(history, (d) => d.outputBytes) || 0);
  const averageInput = Math.floor(d3.mean(history, (d) => d.inputBytes) || 0);

  const strokeWidth = (totalWidth / MAX_BARS) * 0.2;

  const xScale = d3
    .scalePoint(d3.range(0, MAX_BARS), [totalWidth, textBoxWidth])
    .padding(0.8);

  const heightScaleInput = d3.scaleLinear([0, maxInput], [0, halfHeight]);
  const heightScaleOutput = d3.scaleLinear([0, maxOutput], [0, halfHeight]);

  /** @type {string[]} */
  const bars = [];

  for (const [index, datum] of data.entries()) {
    const x = xScale(index);
    const { inputBytes, outputBytes } = datum;

    const outputHeight = heightScaleOutput(outputBytes);
    const inputHeight = heightScaleInput(inputBytes);

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

  // Convert bytes/sec to Mbps
  /**
   * @param {number} bytes
   * @param {boolean} [showMbps]
   * @returns {string}
   */
  const bytesToMbps = (bytes, showMbps = true) => {
    const bits = bytes * 8;
    const mbps = bits / 1_000_000;
    return showMbps ? `${mbps.toFixed(1)} Mbps` : `${mbps.toFixed(1)}`;
  };

  const outAvgString = bytesToMbps(averageOutput, false);
  const inAvgString = bytesToMbps(averageInput, false);

  const outMaxString = bytesToMbps(maxOutput);
  const inMaxString = bytesToMbps(maxInput);

  const pad = 15;

  const outString = `${outAvgString.padStart(pad)} / ${outMaxString.padStart(pad)}`;
  const inString = `${inAvgString.padStart(pad)} / ${inMaxString.padStart(pad)}`;

  const children = [
    // /* html */ `<rect x="0" y="0" width="100%" height="90%" fill="none" stroke="${color}" />`,
    // /* html */ `<rect x="0" y="0" width="${textBoxWidth}" height="100%" fill="none" stroke="${color}" />`,
    // /* html */ `<rect x="${textBoxWidth}" y="0" width="${chartBoxWidth}" height="100%" fill="none" stroke="${color}" />`,
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
