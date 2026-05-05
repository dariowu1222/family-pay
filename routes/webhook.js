import express from 'express';
import { Client, middleware } from '@line/bot-sdk';

const router = express.Router();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
};

const client = new Client(lineConfig);

const postbackMessages = {
  FEATURE_SHOPPING_LIST: '採買清單功能尚在開發中，之後會開放。',
  FEATURE_CALENDAR: '家庭行事曆功能尚在開發中，之後會開放。',
  FEATURE_BILL_REMINDER: '帳單提醒功能尚在開發中，之後會開放。',
  FEATURE_TASK: '家庭任務功能尚在開發中，之後會開放。',
  FEATURE_SETTING: '家庭設定功能尚在開發中，之後會開放。'
};

router.post('/', middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

async function handleEvent(event) {
  if (event.type === 'follow') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '歡迎加入家庭代墊系統！請點選下方選單開始使用。'
    });
  }

  if (event.type === 'postback') {
    const data = event.postback?.data || '';
    const text = postbackMessages[data] || '此功能尚在開發中，之後會開放。';
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text
    });
  }

  return Promise.resolve(null);
}

export default router;
