module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {
        const config = require("../config.js");
        const paymentMenu = require("../components/menus/paymentMenu.js");
        const pscModal = require("../components/modals/pscModal.js");
        const ticketEmbed = require("../components/embeds/ticketEmbed.js");
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

        // 1️⃣ Pack Selection
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "pack_select") {
                const selectedPack = interaction.values[0];

                // Zahlungs-Dropdown anzeigen
                return interaction.reply({
                    content: `Du hast das Paket **${selectedPack}** ausgewählt.\n\nWähle jetzt deine Zahlungsmethode:`,
                    components: paymentMenu.components,
                    ephemeral: true
                });
            }

            // 2️⃣ Payment Method Selection
            if (interaction.customId === "payment_select") {
                const paymentMethod = interaction.values[0];

                if (paymentMethod === "paypal") {
                    // PayPal: Email anzeigen
                    return interaction.reply({
                        content: `💳 **PayPal Zahlung**\n\nBitte überweise den Betrag an:\n**test@me.com**\n\nNach der Zahlung wird automatisch ein Ticket erstellt.`,
                        ephemeral: true
                    });
                } else if (paymentMethod === "paysafe") {
                    // Paysafe: Modal öffnen
                    const modal = new ModalBuilder()
                        .setCustomId("paysafe_modal")
                        .setTitle("Paysafe Code");

                    const pscInput = new TextInputBuilder()
                        .setCustomId("psc_code")
                        .setLabel("Geben Sie deinen Paysafe-Code ein")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const actionRow = new ActionRowBuilder().addComponents(pscInput);
                    modal.addComponents(actionRow);

                    return interaction.showModal(modal);
                }
            }
        }

        // 3️⃣ Paysafe Modal Submit
        if (interaction.isModalSubmit()) {
            if (interaction.customId === "paysafe_modal") {
                const pscCode = interaction.fields.getTextInputValue("psc_code");
                const userId = interaction.user.id;
                const userName = interaction.user.username;

                // Bestätigung an User
                await interaction.reply({
                    content: `✅ **Paysafe Code erhalten!**\n\nCode: \\`${pscCode}\
\n\nEin Support-Ticket wird erstellt...`,
                    ephemeral: true
                });

                // Ticket im Support-Channel erstellen
                const ticketChannel = await client.channels.fetch("1490405812047319151");
                const embed = ticketEmbed(userName, userId, pscCode, "paysafe");

                await ticketChannel.send({
                    embeds: [embed]
                });
            }
        }
    }
};
