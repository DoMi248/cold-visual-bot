module.exports = {
    GUILD_ID: process.env.GUILD_ID || "",
    COMMAND_PREFIX: process.env.COMMAND_PREFIX || "!",
    PAYPAL_URL: process.env.PAYPAL_URL || "https://www.paypal.com/",
    CHANNEL_IDS: {
        PRICELIST: process.env.PRICELIST_CHANNEL_ID || ""
    }
};
