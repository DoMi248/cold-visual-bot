const { PermissionFlagsBits } = require("discord.js");
const { CHANNEL_IDS, COMMAND_PREFIX } = require("../config");
const sendPricelistMessage = require("../utils/sendPricelistMessage");

const PRICELIST_COMMAND = "pricelist";

module.exports = {
    name: "messageCreate",
    async execute(message) {
        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith(COMMAND_PREFIX)) return;

        const [command] = message.content
            .slice(COMMAND_PREFIX.length)
            .trim()
            .split(/\s+/);

        if (!command || command.toLowerCase() !== PRICELIST_COMMAND) return;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply("Du hast keine Berechtigung für diesen Befehl.");
        }

        const configuredChannelId = CHANNEL_IDS.PRICELIST.trim();
        const configuredChannel = configuredChannelId
            ? message.guild.channels.cache.get(configuredChannelId)
            : null;
        const targetChannel = configuredChannel || message.channel;

        try {
            await sendPricelistMessage(targetChannel);
            const successMessage = targetChannel.id === message.channel.id
                ? "Pricelist wurde hier gesendet."
                : `Pricelist wurde in <#${targetChannel.id}> gesendet.`;
            await message.reply(successMessage);
        } catch (error) {
            console.error("Fehler beim Senden der Pricelist:", error);
            await message.reply("Die Pricelist konnte nicht gesendet werden.");
        }
    }
};
