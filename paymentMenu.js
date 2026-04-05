const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId("payment_select")
        .setPlaceholder("Zahlungsmethode auswählen…")
        .addOptions([
            {
                label: "PayPal",
                value: "paypal"
            },
            {
                label: "Paysafe",
                value: "paysafe"
            }
        ])
);