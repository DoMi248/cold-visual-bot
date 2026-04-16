const DEFAULT_PAYPAL_URL = "https://www.paypal.com/";

module.exports = {
    GUILD_ID: process.env.GUILD_ID || "",
    COMMAND_PREFIX: process.env.COMMAND_PREFIX || "!",
    DEFAULT_PAYPAL_URL,
    PAYPAL_URL: process.env.PAYPAL_URL || DEFAULT_PAYPAL_URL,
    CHANNEL_IDS: {
        PRICELIST: process.env.PRICELIST_CHANNEL_ID || ""
    }
};
