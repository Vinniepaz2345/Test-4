const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;

require('dotenv').config();
require('events').EventEmitter.defaultMaxListeners = 500;

const pair = require('./pair');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/pair', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.send({ error: 'Number missing' });

  const id = Math.random().toString(36).slice(2);
  require('./pair')(number, id, res);
});

// Only ONE app.listen here
app.listen(PORT, () => {
  console.log(`Vinnie Pairing Server Running on port ${PORT}`);
});
