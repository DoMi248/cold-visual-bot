const { TARGET_CHANNEL } = require("../config");
const pricelistEmbed = require("../components/embeds/pricelistEmbed");
const packMenu = require("../components/menus/packMenu");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        console.log(`Bot ist online als ${client.user.tag}`);

        const channel = client.channels.cache.get(TARGET_CHANNEL);
        if (!channel) return console.log("Channel nicht gefunden!");

        await channel.send({
            embeds: [pricelistEmbed],
            components: [packMenu]
        });

        console.log("Nachricht mit Dropdown wurde gesendet.");
    }
};
