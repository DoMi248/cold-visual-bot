const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = (products) => {
    const options = (products || []).slice(0, 25).map((product) => ({
        label: product.label.slice(0, 100),
        value: product.id,
        description: `${product.price.toFixed(2)}€`
    }));

    if (!options.length) return null;

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("pack_select")
            .setPlaceholder("Paket auswählen…")
            .addOptions(options)
    );
};
