const express = require('express');
const main = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = main;
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

    // پرانا سیشن صاف کریں تاکہ ریٹ لمٹ بائی پاس ہو سکے
    if (fs.existsSync(`./session_${num}`)) {
        fs.rmSync(`./session_${num}`, { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(`./session_${num}`);
    
    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            // واٹس ایپ بزنس اور میسنجر دونوں کے لیے نوٹیفیکیشن بھیجنے کا سب سے پکا براؤزر پیرامیٹر
            browser: ["Chrome (Linux)", "", ""]
        });

        if (!sock.authState.creds.registered) {
            await delay(3000); // سرور کنکشن مستحکم کرنے کے لیے پاز
            
            try {
                const code = await sock.requestPairingCode(num);
                return res.json({ code: code });
            } catch (pairingErr) {
                console.log("Pairing Error:", pairingErr);
                return res.status(500).json({ error: "WhatsApp Blocked Request" });
            }
        } else {
            return res.status(400).json({ error: "Already Registered" });
        }

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
