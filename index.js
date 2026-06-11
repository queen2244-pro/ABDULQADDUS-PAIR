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

    // پرانے سیشن فولڈر کو لازمی ڈیلیٹ کرنا تاکہ واٹس ایپ پرانا ڈیٹا ریجیکٹ نہ کرے
    if (fs.existsSync(`./session_${num}`)) {
        fs.rmSync(`./session_${num}`, { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(`./session_${num}`);
    
    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            // یہ آفیشل واٹس ایپ ویب کی کروم ڈیسک ٹاپ آئیڈینٹیٹی ہے، جو کوڈ ریجیکٹ ہونے نہیں دے گی
            browser: Browsers.appropriate('Chrome')
        });

        if (!sock.authState.creds.registered) {
            await delay(2000); // سرور کو اسٹیبل کرنے کے لیے پاز
            const code = await sock.requestPairingCode(num);
            return res.json({ code: code });
        } else {
            return res.status(400).json({ error: "Already Linked" });
        }

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                await delay(5000);
                const credsData = fs.readFileSync(`./session_${num}/creds.json`, 'utf-8');
                const base64Session = Buffer.from(credsData).toString('base64');
                const sessionId = `ABDULQADDUS-MD;;;${base64Session}`;
                
                await sock.sendMessage(sock.user.id, { 
                    text: `*SUCCESSFULLY CONNECTED!* 🎉\n\nYour Session ID:\n\n\`\`\`${sessionId}\`\`\`` 
                });
                
                setTimeout(() => {
                    fs.rmSync(`./session_${num}`, { recursive: true, force: true });
                }, 10000);
            }
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
