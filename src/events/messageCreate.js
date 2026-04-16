const { PermissionFlagsBits } = require("discord.js");
const { CHANNEL_IDS, COMMAND_PREFIX } = require("../config");
const sendPricelistMessage = require("../utils/sendPricelistMessage");
const {
    getProducts,
    upsertProduct,
    removeProduct,
    updateProductField,
    sanitizeProductId
} = require("../utils/productStore");
const {
    getEntries,
    getLatestEntryByChannelId,
    decryptEntryCode
} = require("../utils/paysafeStore");

const PRICELIST_COMMAND = "pricelist";
const PRODUCT_COMMANDS = new Set(["product", "products", "pack", "packs"]);
const PAYSAFE_COMMAND = "psc";

const isManager = (message) => message.member.permissions.has(PermissionFlagsBits.ManageGuild);

const requireManager = async (message) => {
    if (isManager(message)) return true;
    await message.reply("Du hast keine Berechtigung für diesen Befehl.");
    return false;
};

const sendProductHelp = (message) =>
    message.reply([
        "Produktverwaltung:",
        `\`${COMMAND_PREFIX}product list\``,
        `\`${COMMAND_PREFIX}product add <id> <preis> <name>\``,
        `\`${COMMAND_PREFIX}product setprice <id> <preis>\``,
        `\`${COMMAND_PREFIX}product rename <id> <name>\``,
        `\`${COMMAND_PREFIX}product remove <id>\``
    ].join("\n"));

const sendPaysafeHelp = (message) =>
    message.reply([
        "Paysafecard-Verwaltung:",
        `\`${COMMAND_PREFIX}psc list [limit]\``,
        `\`${COMMAND_PREFIX}psc show [ticketChannelId]\``
    ].join("\n"));

module.exports = {
    name: "messageCreate",
    async execute(message) {
        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith(COMMAND_PREFIX)) return;

        const tokens = message.content
            .slice(COMMAND_PREFIX.length)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        const command = (tokens.shift() || "").toLowerCase();
        if (!command) return;

        if (command === PRICELIST_COMMAND) {
            if (!(await requireManager(message))) return;

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
            return;
        }

        if (PRODUCT_COMMANDS.has(command)) {
            if (!(await requireManager(message))) return;

            const subCommand = (tokens.shift() || "").toLowerCase();
            try {
                if (!subCommand || subCommand === "help") {
                    await sendProductHelp(message);
                    return;
                }

                if (subCommand === "list") {
                    const products = getProducts();
                    if (!products.length) {
                        await message.reply("Es sind keine Produkte hinterlegt.");
                        return;
                    }

                    const lines = products.map((product) => `• \`${product.id}\` — **${product.label}** (${product.price.toFixed(2)}€)`);
                    await message.reply(lines.join("\n"));
                    return;
                }

                if (subCommand === "add") {
                    const [rawId, rawPrice, ...nameParts] = tokens;
                    if (!rawId || !rawPrice || !nameParts.length) {
                        await message.reply(`Nutzung: \`${COMMAND_PREFIX}product add <id> <preis> <name>\``);
                        return;
                    }

                    const added = upsertProduct({
                        id: rawId,
                        price: rawPrice,
                        label: nameParts.join(" ")
                    });
                    await message.reply(`Produkt gespeichert: \`${added.id}\` — **${added.label}** (${added.price.toFixed(2)}€)`);
                    return;
                }

                if (subCommand === "setprice") {
                    const [rawId, rawPrice] = tokens;
                    if (!rawId || !rawPrice) {
                        await message.reply(`Nutzung: \`${COMMAND_PREFIX}product setprice <id> <preis>\``);
                        return;
                    }

                    const updated = updateProductField(rawId, { price: rawPrice });
                    if (!updated) {
                        await message.reply(`Produkt \`${sanitizeProductId(rawId)}\` nicht gefunden.`);
                        return;
                    }
                    await message.reply(`Preis aktualisiert: **${updated.label}** = ${updated.price.toFixed(2)}€`);
                    return;
                }

                if (subCommand === "rename") {
                    const [rawId, ...nameParts] = tokens;
                    if (!rawId || !nameParts.length) {
                        await message.reply(`Nutzung: \`${COMMAND_PREFIX}product rename <id> <name>\``);
                        return;
                    }

                    const updated = updateProductField(rawId, { label: nameParts.join(" ") });
                    if (!updated) {
                        await message.reply(`Produkt \`${sanitizeProductId(rawId)}\` nicht gefunden.`);
                        return;
                    }
                    await message.reply(`Produkt umbenannt: \`${updated.id}\` → **${updated.label}**`);
                    return;
                }

                if (subCommand === "remove") {
                    const [rawId] = tokens;
                    if (!rawId) {
                        await message.reply(`Nutzung: \`${COMMAND_PREFIX}product remove <id>\``);
                        return;
                    }

                    const removed = removeProduct(rawId);
                    if (!removed) {
                        await message.reply(`Produkt \`${sanitizeProductId(rawId)}\` nicht gefunden.`);
                        return;
                    }
                    await message.reply(`Produkt \`${sanitizeProductId(rawId)}\` wurde entfernt.`);
                    return;
                }

                await sendProductHelp(message);
            } catch (error) {
                await message.reply(`Fehler: ${error.message}`);
            }
            return;
        }

        if (command === PAYSAFE_COMMAND) {
            if (!(await requireManager(message))) return;

            const subCommand = (tokens.shift() || "").toLowerCase();
            try {
                if (!subCommand || subCommand === "help") {
                    await sendPaysafeHelp(message);
                    return;
                }

                if (subCommand === "list") {
                    const limitValue = Number.parseInt(tokens[0], 10);
                    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 20) : 10;
                    const entries = getEntries()
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                        .slice(0, limit);

                    if (!entries.length) {
                        await message.reply("Keine gespeicherten Paysafecard-Einträge gefunden.");
                        return;
                    }

                    const lines = entries.map((entry) =>
                        `• Channel: <#${entry.channelId}> | User: <@${entry.userId}> | Paket: **${entry.packLabel}** (${Number(entry.packPrice).toFixed(2)}€) | ${new Date(entry.createdAt).toLocaleString("de-DE")}`
                    );
                    await message.reply(lines.join("\n"));
                    return;
                }

                if (subCommand === "show") {
                    const targetChannelId = (tokens[0] || message.channel.id).replace(/[<#>]/g, "");
                    const entry = getLatestEntryByChannelId(targetChannelId);
                    if (!entry) {
                        await message.reply(`Kein gespeicherter Paysafecard-Eintrag für Channel \`${targetChannelId}\` gefunden.`);
                        return;
                    }

                    const code = decryptEntryCode(entry);
                    await message.reply([
                        `Paysafecard für <#${entry.channelId}>`,
                        `User: <@${entry.userId}>`,
                        `Paket: **${entry.packLabel}** (${Number(entry.packPrice).toFixed(2)}€)`,
                        `Code: \`${code}\``
                    ].join("\n"));
                    return;
                }

                await sendPaysafeHelp(message);
            } catch (error) {
                await message.reply(`Fehler: ${error.message}`);
            }
        }
    }
};
