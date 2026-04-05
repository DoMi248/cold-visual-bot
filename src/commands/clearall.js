const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clearall")
        .setDescription("Löscht den kompletten Chatverlauf dieses Channels.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {

        await interaction.reply({
            content: "🧹 Starte Löschung des kompletten Chatverlaufs...",
            ephemeral: true
        });

        const channel = interaction.channel;

        let deleted = 0;

        while (true) {
            const messages = await channel.messages.fetch({ limit: 100 });

            if (messages.size === 0) break;

            await channel.bulkDelete(messages, true);
            deleted += messages.size;

            // kleine Pause für Rate Limits
            await new Promise(res => setTimeout(res, 500));
        }

        await interaction.followUp({
            content: `✔️ **Fertig!** Es wurden insgesamt **${deleted} Nachrichten** gelöscht.`,
            ephemeral: true
        });
    }
};
