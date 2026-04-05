const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {

        // 1️⃣ PACK AUSWAHL → ZAHLUNGSMETHODEN-MODAL ÖFFNEN
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "pack_select") {

                const modal = new ModalBuilder()
                    .setCustomId("payment_modal")
                    .setTitle("Zahlungsmethode wählen");

                const method = new TextInputBuilder()
                    .setCustomId("method")
                    .setLabel("Zahlungsmethode (paypal / paysafecard)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(method)
                );

                return interaction.showModal(modal);
            }
        }

        // 2️⃣ ZAHLUNGSMETHODE AUS MODAL AUSWERTEN
        if (interaction.isModalSubmit()) {

            // PAYPAL ODER PSC?
            if (interaction.customId === "payment_modal") {

                const method = interaction.fields.getTextInputValue("method").toLowerCase();

                // PAYPAL → PAYPAL-MODAL ÖFFNEN
                if (method === "paypal") {

                    const paypalModal = new ModalBuilder()
                        .setCustomId("paypal_modal")
                        .setTitle("PayPal Zahlung");

                    const info = new TextInputBuilder()
                        .setCustomId("paypal_info")
                        .setLabel("Unsere PayPal E-Mail")
                        .setStyle(TextInputStyle.Short)
                        .setValue("DEINE-PAYPAL-EMAIL")
                        .setRequired(false);

                    paypalModal.addComponents(
                        new ActionRowBuilder().addComponents(info)
                    );

                    return interaction.showModal(paypalModal);
                }

                // PSC → PSC-MODAL ÖFFNEN
                if (method === "paysafecard") {

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

                return interaction.reply({
                    content: "Ungültige Zahlungsmethode. Bitte gib **paypal** oder **paysafecard** ein.",
                    ephemeral: true
                });
            }

            // 3️⃣ PAYPAL ODER PSC → TICKET ERSTELLEN
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
