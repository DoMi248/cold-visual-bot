const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId("pack_select")
        .setPlaceholder("Information auswählen…")
        .addOptions([
            {
                label: "Kleidung Basic",
                value: "basic"
            },
            {
                label: "Kleidung Premium",
                value: "premium"
            },
            {
                label: "Kleidung Custom",
                value: "custom"
            }
        ])
);
