import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, 'richmenu.png');

const width = 2500;
const height = 1686;
const col1 = 833;
const col2 = 1667;
const row1 = 843;

const titles = [
  { text: '家庭代墊',   x: 416,  y: 421 },
  { text: '採買清單',   x: 1250, y: 421 },
  { text: '家庭行事曆', x: 2083, y: 421 },
  { text: '帳單提醒',   x: 416,  y: 1264 },
  { text: '家庭任務',   x: 1250, y: 1264 },
  { text: '家庭設定',   x: 2083, y: 1264 }
];

function createSvg() {
  const titleSvg = titles.map((item) => {
    return `
      <text
        x="${item.x}"
        y="${item.y}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="92"
        font-weight="700"
        font-family="Arial, Microsoft JhengHei, sans-serif"
        fill="#111111"
      >${item.text}</text>
    `;
  }).join('');

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
      <line x1="${col1}" y1="0" x2="${col1}" y2="${height}" stroke="#111111" stroke-width="8" />
      <line x1="${col2}" y1="0" x2="${col2}" y2="${height}" stroke="#111111" stroke-width="8" />
      <line x1="0" y1="${row1}" x2="${width}" y2="${row1}" stroke="#111111" stroke-width="8" />
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#111111" stroke-width="8" />
      ${titleSvg}
    </svg>
  `;
}

async function main() {
  const svg = createSvg();
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  console.log(`Rich menu image generated: ${outputPath}`);
}

main().catch((error) => {
  console.error('Generate rich menu PNG failed:', error);
  process.exit(1);
});
