const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;

require('dotenv').config();
require('events').EventEmitter.defaultMaxListeners = 500;

const pair = require('./pair'); // No /src

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/pair', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.json({ error: 'Number missing' });

  const id = Math.random().toString(36).slice(2);
  try {
    const code = await pair(number, id); // make sure pair.js returns the code
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate code' });
  }
});

app.listen(PORT, () => {
  console.log(`Vinnie Pairing Server Running on port ${PORT}`);
});
