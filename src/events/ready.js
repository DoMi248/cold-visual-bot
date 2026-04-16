const { CHANNEL_IDS } = require("../config");
const sendPricelistMessage = require("../utils/sendPricelistMessage");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        console.log(`Bot ist online als ${client.user.tag}`);

        const channel = client.channels.cache.get(CHANNEL_IDS.PRICELIST);
        if (!channel) return console.log("Pricelist-Channel nicht gefunden oder nicht gesetzt.");

        try {
            await sendPricelistMessage(channel);
            console.log("Nachricht mit Dropdown wurde gesendet.");
        } catch (error) {
            console.error("Pricelist-Nachricht konnte nicht gesendet werden:", error);
        }
    }
};
