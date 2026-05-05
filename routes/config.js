import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    liffId: process.env.LIFF_ID || ''
  });
});

export default router;
