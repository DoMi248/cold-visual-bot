const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const { PAYPAL_EMAIL } = require("../config");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {

        // DEBUG
        console.log("Interaction type:", interaction.type);
        console.log("Is SelectMenu:", interaction.isStringSelectMenu?.());
        console.log("CustomId:", interaction.customId);

        // 1️⃣ PACK AUSWAHL → BUTTONS SENDEN
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "pack_select") {

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("choose_paypal")
                        .setLabel("PayPal")
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId("choose_psc")
                        .setLabel("Paysafecard")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content: `Bitte wähle deine Zahlungsmethode aus:`,
                    components: [row],
                    ephemeral: true
                });
            }
        }

        // 2️⃣ BUTTON → PAYPAL-MODAL
        if (interaction.isButton()) {

            if (interaction.customId === "choose_paypal") {

                const paypalModal = new ModalBuilder()
                    .setCustomId("paypal_modal")
                    .setTitle("PayPal Zahlung");

                const info = new TextInputBuilder()
                    .setCustomId("paypal_info")
                    .setLabel("Unsere PayPal E-Mail")
                    .setStyle(TextInputStyle.Short)
                    .setValue(PAYPAL_EMAIL || "PAYPAL_EMAIL_NICHT_GESETZT")
                    .setRequired(false);

                paypalModal.addComponents(
                    new ActionRowBuilder().addComponents(info)
                );

                return interaction.showModal(paypalModal);
            }

            // 3️⃣ BUTTON → PSC-MODAL
            if (interaction.customId === "choose_psc") {

                const pscModal = new ModalBuilder()
                    .setCustomId("psc_modal")
                    .setTitle("Paysafecard Zahlung");

                const code = new TextInputBuilder()
                    .setCustomId("psc_code")
                    .setLabel("PSC Code eingeben")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                pscModal.addComponents(
                    new ActionRowBuilder().addComponents(code)
                );

                return interaction.showModal(pscModal);
            }
        }

        // 4️⃣ PAYPAL ODER PSC → TICKET ERSTELLEN
        if (interaction.isModalSubmit()) {

            if (interaction.customId === "paypal_modal" || interaction.customId === "psc_modal") {

                const guild = interaction.guild;

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: 0,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: ["ViewChannel"]
                        },
                        {
                            id: interaction.user.id,
                            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
                        }
                    ]
                });

                await interaction.reply({
                    content: `Dein Ticket wurde erstellt: ${ticketChannel}`,
                    ephemeral: true
                });

                await ticketChannel.send({
                    content: `Danke für deine Angaben!\n\nWir prüfen jetzt deine Zahlung und melden uns schnellstmöglich bei dir.`
                });
            }
        }
    }
};
