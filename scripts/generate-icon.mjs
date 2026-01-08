import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

// Create icons directory
const appIconsPath = "./app-icons";
mkdirSync(appIconsPath, { recursive: true });

const iconsetPath = `${appIconsPath}/icon.iconset`;
mkdirSync(iconsetPath, { recursive: true });

// Icon sizes required for macOS
const sizes = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

// Generate SVG for the icon - a network activity chart style
function generateIconSVG(size) {
  const padding = size * 0.15;
  const chartWidth = size - padding * 2;
  const chartHeight = size - padding * 2;

  // Create a line chart path representing network activity
  const points = 12;
  const pathData = Array.from({ length: points }, (_, i) => {
    const x = padding + (chartWidth / (points - 1)) * i;
    const noise = Math.sin(i * 0.8) * 0.3 + Math.sin(i * 1.5) * 0.2;
    const y = padding + chartHeight * (0.5 + noise * 0.4);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(" ");

  // Add gradient fill under the line
  const fillPath =
    pathData +
    ` L ${size - padding} ${size - padding} L ${padding} ${size - padding} Z`;

  return /* html */ `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#4A9EFF;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#2563EB;stop-opacity:0.3" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#06B6D4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background circle -->
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#1E293B" />

      <!-- Fill under the chart -->
      <path d="${fillPath}" fill="url(#grad)" />

      <!-- Chart line -->
      <path d="${pathData}" stroke="url(#lineGrad)" stroke-width="${size / 40}" fill="none" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Glow effect on top -->
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.3" />
    </svg>
  `.trim();
}

// Generate all icon sizes
for (const { size, name } of sizes) {
  const svg = generateIconSVG(size);
  const buffer = Buffer.from(svg);

  await sharp(buffer).png().toFile(`${iconsetPath}/${name}`);

  console.log(`Generated ${name}`);
}

// Convert to .icns using iconutil
console.log("\nConverting to .icns...");
execSync(`iconutil -c icns ${iconsetPath} -o ${appIconsPath}/icon.icns`);

console.log("✓ icon.icns created successfully!");

// Also export a high-res PNG
console.log("\nGenerating PNG...");
const pngSize = 1024;
const pngSvg = generateIconSVG(pngSize);
const pngBuffer = Buffer.from(pngSvg);
await sharp(pngBuffer).png().toFile(`${appIconsPath}/icon.png`);

console.log("✓ icon.png created successfully!");
