const pricelistEmbed = require("../components/embeds/pricelistEmbed");
const packMenu = require("../components/menus/packMenu");
const { getProducts } = require("./productStore");

module.exports = async (channel) => {
    const products = getProducts();
    const menu = packMenu(products);
    return channel.send({
        embeds: [pricelistEmbed(products)],
        components: menu ? [menu] : []
    });
};
