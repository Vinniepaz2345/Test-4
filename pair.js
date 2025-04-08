require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('events').EventEmitter.defaultMaxListeners = 500;

const fs = require('fs');
const path = require('path');
const { Storage } = require("megajs");
const { default: Gifted_Tech, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");

const PORT = process.env.PORT || 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve pair.html + static assets (if any)
app.use(express.static(path.join(__dirname)));

// Utility functions
const randomMegaId = (length = 6, numberLength = 4) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const number = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${result}${number}`;
};

const uploadCredsToMega = async (credsPath) => {
  const storage = await new Storage({
    email: process.env.MEGA_EMAIL,
    password: process.env.MEGA_PASSWORD
  }).ready;

  const fileSize = fs.statSync(credsPath).size;
  const uploadResult = await storage.upload({
    name: `${randomMegaId()}.json`,
    size: fileSize
  }, fs.createReadStream(credsPath)).complete;

  const fileNode = storage.files[uploadResult.nodeId];
  const megaUrl = await fileNode.link();
  return megaUrl;
};

const removeFile = (FilePath) => {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
};

// Core pairing function
const GIFTED_PAIR_CODE = async (num, id, res) => {
  const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);

  try {
    let Gifted = Gifted_Tech({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
      },
      printQRInTerminal: false,
      logger: pino({ level: "fatal" }).child({ level: "fatal" }),
      browser: Browsers.macOS("Safari")
    });

    if (!Gifted.authState.creds.registered) {
      await delay(1500);
      num = num.replace(/[^0-9]/g, '');
      const code = await Gifted.requestPairingCode(num);
      if (!res.headersSent) res.send({ code });
    }

    Gifted.ev.on('creds.update', saveCreds);
    Gifted.ev.on("connection.update", async (s) => {
      const { connection, lastDisconnect } = s;
      if (connection === "open") {
        await delay(5000);
        const filePath = `./temp/${id}/creds.json`;
        if (!fs.existsSync(filePath)) return;
        const megaUrl = await uploadCredsToMega(filePath);
        const sid = megaUrl.includes("https://mega.nz/file/")
          ? 'Vinnie~' + megaUrl.split("https://mega.nz/file/")[1]
          : 'Error: Invalid URL';

        const session = await Gifted.sendMessage(Gifted.user.id, { text: sid });

        const VINNIE_TEXT = `
*✅Session ID Generated✅*
__________________________
╔════◇
║『 𝗬𝗢𝗨'𝗩𝗘 𝗖𝗛𝗢𝗦𝗘𝗡 𝗩𝗜𝗡𝗡𝗜𝗘 𝗠𝗗 』
╚══════════════╝
╔═════◇
║ 『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ 𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥: _youtube.com/@vinniebot_
║❒ 𝐎𝐰𝐧𝐞𝐫: _https://t.me/vinniebotdevs_
║❒ 𝐑𝐞𝐩𝐨: _https://github.com/vinniebot/vinnie-md_
║❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y_
║ 💜💜💜
╚══════════════╝ 
 𝗩𝗜𝗡𝗡𝗜𝗘-𝗠𝗗 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 5.0.0
__________________________

Use your Session ID Above to Deploy your Bot.`;

        await Gifted.sendMessage(Gifted.user.id, { text: VINNIE_TEXT }, { quoted: session });
        await delay(100);
        await Gifted.ws.close();
        removeFile(`./temp/${id}`);
      } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
        await delay(10000);
        GIFTED_PAIR_CODE(num, id, res);
      }
    });
  } catch (err) {
    console.error("Service Error:", err);
    removeFile(`./temp/${id}`);
    if (!res.headersSent) res.send({ code: "Service is Currently Unavailable" });
  }
};

// Pairing endpoint
app.post('/code', async (req, res) => {
  const number = req.body.number;
  if (!number) return res.status(400).send({ error: 'Phone number is required' });
  const id = Math.random().toString(36).slice(2, 10);
  await GIFTED_PAIR_CODE(number, id, res);
});

// Serve frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Vinnie Pairing Server Running at http://localhost:${PORT}`);
});
