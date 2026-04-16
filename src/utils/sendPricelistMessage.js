const pricelistEmbed = require("../components/embeds/pricelistEmbed");
const packMenu = require("../components/menus/packMenu");

module.exports = async (channel) => {
    return channel.send({
        embeds: [pricelistEmbed],
        components: [packMenu]
    });
};
