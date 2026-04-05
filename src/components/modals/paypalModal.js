const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");

module.exports = new ModalBuilder()
    .setCustomId("paypal_modal")
    .setTitle("PayPal Zahlung")
    .addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("paypal_email_display")
                .setLabel("PayPal E-Mail")
                .setStyle(TextInputStyle.Short)
                .setValue("support@example.com")
                .setDisabled(true)
                .setRequired(false)
        )
    );