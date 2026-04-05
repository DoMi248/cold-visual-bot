module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "pack_select") {
                return interaction.reply({
                    content: `Du hast **${interaction.values[0]}** ausgewählt.`,
                    ephemeral: true
                });
            }
        }

        if (interaction.isModalSubmit()) {
            // später für PSC Modal
        }
    }
};
