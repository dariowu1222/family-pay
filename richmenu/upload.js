import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@line/bot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const richMenuJsonPath = path.join(__dirname, 'richmenu.json');
const richMenuImagePath = path.join(__dirname, 'richmenu.png');

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const liffId = process.env.LIFF_ID || '';

if (!channelAccessToken) {
  console.error('LINE_CHANNEL_ACCESS_TOKEN is required.');
  process.exit(1);
}

if (!liffId) {
  console.error('LIFF_ID is required.');
  process.exit(1);
}

const client = new Client({
  channelAccessToken
});

async function main() {
  const richMenuTemplate = await fs.readFile(richMenuJsonPath, 'utf8');
  const richMenuBody = JSON.parse(richMenuTemplate.replaceAll('{LIFF_ID}', liffId));

  const richMenuId = await client.createRichMenu(richMenuBody);

  const imageBuffer = await fs.readFile(richMenuImagePath);
  await client.setRichMenuImage(
    richMenuId,
    imageBuffer,
    'image/png'
  );

  await client.setDefaultRichMenu(richMenuId);

  console.log('Rich menu uploaded successfully.');
  console.log(`Rich menu ID: ${richMenuId}`);
}

main().catch((error) => {
  console.error('Upload rich menu failed:', error);
  process.exit(1);
});
