const express = require('express');
const main = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers } = main;
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number is required" });
    
    num = num.replace(/[^0-9]/g, '');

    if (fs.existsSync(`./session_${num}`)) {
        fs.rmSync(`./session_${num}`, { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(`./session_${num}`);
    
    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            // واٹس ایپ بزنس کی آفیشل موبائل ایپ پروٹوکول آئی ڈی (یہ بلاک نہیں ہوتی)
            browser: ["WhatsApp", "Safari", "17.4.1"]
        });

        if (!sock.authState.creds.registered) {
            await delay(2000);
            const code = await sock.requestPairingCode(num);
            return res.json({ code: code });
        } else {
            return res.status(400).json({ error: "Already Linked" });
        }

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
