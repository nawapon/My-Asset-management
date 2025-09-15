require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot;

// ตรวจสอบว่า Token และ Chat ID ถูกตั้งค่าในไฟล์ .env อย่างถูกต้องหรือไม่
if (!token || !chatId || token === 'YOUR_TELEGRAM_BOT_TOKEN' || token.split(':').length !== 2) {
    console.warn('** Telegram Bot Token or Chat ID is not configured correctly in .env file. Telegram notifications will be disabled. **');
    module.exports = {
        sendRepairNotification: () => {
            console.log('Skipping Telegram notification because it is not configured.');
            return Promise.resolve();
        }
    };
} else {
    bot = new TelegramBot(token);

    const sendRepairNotification = async (repairDetails) => {
        try {
            const {
                assetNumber,
                assetName,
                problemDescription,
                reporterName,
                reporterLocation,
                reporterContact
            } = repairDetails;
            
            // ใช้ HTML format
            const message = `
<b>🔔 มีการแจ้งซ่อมใหม่</b>\n\n
<b>เลขครุภัณฑ์:</b> <code>${assetNumber}</code>\n
<b>ชื่ออุปกรณ์:</b> ${assetName}\n
<b>ปัญหา:</b> ${problemDescription}\n
<b>ผู้แจ้ง:</b> ${reporterName}\n
<b>สถานที่:</b> ${reporterLocation}\n
<b>ติดต่อ:</b> <code>${reporterContact}</code>
`;


            await bot.sendMessage(chatId, message.trim(), { parse_mode: 'HTML' });
            console.log('Telegram notification sent successfully.');
        } catch (error) {
            console.error('Failed to send Telegram notification:', error.response ? error.response.body : error.message);
        }
    };

    module.exports = { sendRepairNotification };
}
