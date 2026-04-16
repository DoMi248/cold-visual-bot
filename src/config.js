const path = require("path");

const DEFAULT_PAYPAL_URL = "https://www.paypal.com/";

module.exports = {
    GUILD_ID: process.env.GUILD_ID || "",
    COMMAND_PREFIX: process.env.COMMAND_PREFIX || "!",
    DEFAULT_PAYPAL_URL,
    PAYPAL_URL: process.env.PAYPAL_URL || DEFAULT_PAYPAL_URL,
    PSC_ENCRYPTION_KEY: process.env.PSC_ENCRYPTION_KEY || "",
    DATA_FILES: {
        PRODUCTS: path.join(__dirname, "data", "products.json"),
        PAYSAFE: path.join(__dirname, "data", "paysafe.json")
    },
    CHANNEL_IDS: {
        PRICELIST: process.env.PRICELIST_CHANNEL_ID || "",
        TICKET_TRANSCRIPTS: process.env.TICKET_TRANSCRIPT_CHANNEL_ID || "",
        PSC_ENCRYPT_LOG: process.env.PSC_ENCRYPT_CHANNEL_ID || ""
    },
    MUSIC: {
        STREAM_URL: process.env.MUSIC_STREAM_URL || "",
        DEFAULT_VOICE_CHANNEL_ID: process.env.MUSIC_DEFAULT_VOICE_CHANNEL_ID || ""
    }
};
