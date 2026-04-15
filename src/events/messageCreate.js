const { PermissionFlagsBits } = require("discord.js");
const { CHANNEL_IDS, COMMAND_PREFIX } = require("../config");
const sendPricelistMessage = require("../utils/sendPricelistMessage");

module.exports = {
    name: "messageCreate",
    async execute(message) {
        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith(COMMAND_PREFIX)) return;

        const [command] = message.content
            .slice(COMMAND_PREFIX.length)
            .trim()
            .split(/\s+/);

        if (!command || command.toLowerCase() !== "pricelist") return;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply("Du hast keine Berechtigung für diesen Befehl.");
        }

        const configuredChannel = CHANNEL_IDS.PRICELIST
            ? message.guild.channels.cache.get(CHANNEL_IDS.PRICELIST)
            : null;
        const targetChannel = configuredChannel || message.channel;

        try {
            await sendPricelistMessage(targetChannel);
            await message.reply(`Pricelist wurde in ${targetChannel} gesendet.`);
        } catch (error) {
            console.error("Fehler beim Senden der Pricelist:", error);
            await message.reply("Die Pricelist konnte nicht gesendet werden.");
        }
    }
};
