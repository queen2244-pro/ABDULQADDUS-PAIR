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

    const { state, saveCreds } = await useMultiFileAuthState(`./session_${num}`);
    
    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            // یہاں آفیشل کروم ڈیسک ٹاپ سیٹ کر دیا ہے تاکہ واٹس ایپ بلاک نہ کرے
            browser: Browsers.appropriate('Chrome')
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(num);
            res.json({ code: code });
        }

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                await delay(5000);
                const credsData = fs.readFileSync(`./session_${num}/creds.json`, 'utf-8');
                const base64Session = Buffer.from(credsData).toString('base64');
                
                const sessionId = `ABDULQADDUS-MD;;;${base64Session}`;
                
                await sock.sendMessage(sock.user.id, { 
                    text: `*SUCCESSFULLY CONNECTED!* 🎉\n\nHere is your ABDULQADDUS-MD Session ID:\n\n\`\`\`${sessionId}\`\`\`\n\nCopy this ID and deploy on Heroku.` 
                });
                
                setTimeout(() => {
                    fs.rmSync(`./session_${num}`, { recursive: true, force: true });
                }, 10000);
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
