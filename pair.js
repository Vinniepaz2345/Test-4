const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const { delay, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, default: makeWASocket } = require("@whiskeysockets/baileys");
const { Storage } = require("megajs");

const router = express.Router();

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

router.get('/', async (req, res) => {
  let number = req.query.number;
  if (!number) return res.status(400).send({ error: "Missing number query" });

  const id = Math.random().toString(36).slice(2, 10);
  const sessionPath = `./temp/${id}`;
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  try {
    let sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
      },
      logger: pino({ level: "fatal" }),
      browser: Browsers.macOS("Safari"),
    });

    if (!sock.authState.creds.registered) {
      await delay(1500);
      number = number.replace(/[^0-9]/g, '');
      const code = await sock.requestPairingCode(number);
      res.send({ code }); // Send pairing code
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection }) => {
      if (connection === "open") {
        await delay(5000);
        const credsFile = `${sessionPath}/creds.json`;
        if (!fs.existsSync(credsFile)) return;

        const megaUrl = await uploadCredsToMega(credsFile);
        const sessionId = megaUrl.replace("https://mega.nz/file/", "");

        await sock.sendMessage(sock.user.id, { text: sessionId });
        await delay(1000);

        const message = `
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
╚══════════════╝ 
𝗩𝗜𝗡𝗡𝗜𝗘-𝗠𝗗 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 5.0.0
__________________________

Use your Session ID Above to Deploy your Bot.
        `;

        await sock.sendMessage(sock.user.id, { text: message });

        await delay(1000);
        await sock.ws.close();
        removeFile(sessionPath);
      }
    });

  } catch (err) {
    console.error("Error generating session:", err);
    removeFile(sessionPath);
    res.status(500).send({ error: "Session generation failed" });
  }
});

module.exports = pair;
