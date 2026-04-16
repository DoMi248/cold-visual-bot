const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    AttachmentBuilder
} = require("discord.js");
const ticketEmbed = require("../components/embeds/ticketEmbed");
const { PAYPAL_URL, DEFAULT_PAYPAL_URL, CHANNEL_IDS } = require("../config");
const { findProductById } = require("../utils/productStore");
const { addPaysafeEntry } = require("../utils/paysafeStore");

const TICKET_OWNER_TOPIC_PREFIX = "ticket-owner:";
const MAX_TICKET_NAME_LENGTH = 80;
const CHOOSE_PSC_PREFIX = "choose_psc:";
const PSC_MODAL_PREFIX = "psc_modal:";
const PSC_MAX_INPUT_LENGTH = 19;
const PAYSAFE_CODE_REGEX = /^\d{4}([ -]?\d{4}){3}$/;
const MAX_TRANSCRIPT_MESSAGES = 1000;
const AUTO_DELETE_DELAY_MS = 24 * 60 * 60 * 1000;
const TICKET_RATING_MODAL_ID = "ticket_rating_modal";
const ticketAutoDeleteTimeouts = new Map();

const sanitizeTicketNameSegment = (value) =>
    (value || "ticket")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, MAX_TICKET_NAME_LENGTH) || "ticket";

const getTicketBaseName = (channelName) => sanitizeTicketNameSegment((channelName || "ticket").replace(/^ticket-|^closed-/, ""));

const getTicketOwnerId = (channel) => {
    if (!channel?.topic?.startsWith(TICKET_OWNER_TOPIC_PREFIX)) return null;
    return channel.topic.slice(TICKET_OWNER_TOPIC_PREFIX.length);
};

const isTicketChannel = (channel) => {
    if (!channel || channel.type !== ChannelType.GuildText) return false;
    return channel.topic?.startsWith(TICKET_OWNER_TOPIC_PREFIX);
};

const userIsTicketAdmin = (interaction) =>
    Boolean(
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    );

const userIsTicketOwner = (interaction) => getTicketOwnerId(interaction.channel) === interaction.user.id;

const ensureTicketAdmin = async (interaction) => {
    if (!userIsTicketAdmin(interaction)) {
        await interaction.reply({
            content: "Nur Admins mit **Kanäle verwalten** dürfen diese Aktion ausführen.",
            ephemeral: true
        });
        return false;
    }

    if (!isTicketChannel(interaction.channel)) {
        await interaction.reply({
            content: "Diese Aktion ist nur in Ticket-Kanälen verfügbar.",
            ephemeral: true
        });
        return false;
    }

    return true;
};

const isHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const SAFE_PAYPAL_URL = (() => {
    if (isHttpUrl(PAYPAL_URL)) return PAYPAL_URL;
    console.warn(`PAYPAL_URL is invalid or empty. Using fallback: ${DEFAULT_PAYPAL_URL}`);
    return DEFAULT_PAYPAL_URL;
})();

const createTicketManagementRow = () =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_request_close")
            .setLabel("Schließung anfragen")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ticket_rate")
            .setLabel("Artikel bewerten")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_force_close")
            .setLabel("Schließung erzwingen")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("ticket_rename")
            .setLabel("Ticket umbenennen")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_delete")
            .setLabel("Ticket löschen")
            .setStyle(ButtonStyle.Danger)
    );

const buildPayPalPaymentUrl = (baseUrl, amount) => {
    const normalizedAmount = Number(amount).toFixed(2);
    const url = new URL(baseUrl);
    const isPayPalMe = /(^|\.)paypal\.me$/i.test(url.hostname);

    if (isPayPalMe) {
        const pathWithoutSlash = url.pathname.replace(/\/+$/, "");
        return `${url.origin}${pathWithoutSlash}/${normalizedAmount}`;
    }

    url.searchParams.set("amount", normalizedAmount);
    return url.toString();
};

const isValidPaysafeCode = (value) => PAYSAFE_CODE_REGEX.test(String(value || "").trim());

const formatTranscriptLine = (message) => {
    const createdAt = new Date(message.createdTimestamp).toISOString();
    const authorTag = message.author?.tag || "unknown";
    const authorId = message.author?.id || "unknown";
    const content = message.cleanContent?.trim() || "[kein Text]";
    const attachments = [...(message.attachments?.values() || [])].map((file) => file.url);
    const attachmentInfo = attachments.length ? ` | Anhänge: ${attachments.join(", ")}` : "";
    return `[${createdAt}] ${authorTag} (${authorId}): ${content}${attachmentInfo}`;
};

const buildTranscriptPayload = async (channel) => {
    const allMessages = [];
    let before;

    while (allMessages.length < MAX_TRANSCRIPT_MESSAGES) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {})
        });

        if (!batch.size) break;
        allMessages.push(...batch.values());

        before = batch.last().id;
        if (batch.size < 100) break;
    }

    const sortedMessages = allMessages
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .slice(-MAX_TRANSCRIPT_MESSAGES);

    const lines = [
        `Ticket-Transcript`,
        `Channel: #${channel.name} (${channel.id})`,
        `Erstellt am: ${new Date().toISOString()}`,
        `Nachrichten: ${sortedMessages.length}`,
        ""
    ];

    if (!sortedMessages.length) {
        lines.push("[Keine Nachrichten vorhanden]");
    } else {
        lines.push(...sortedMessages.map(formatTranscriptLine));
    }

    const fileName = `ticket-transcript-${channel.id}-${Date.now()}.txt`;
    return {
        fileName,
        buffer: Buffer.from(lines.join("\n"), "utf8")
    };
};

const sendTicketTranscript = async ({ guild, channel, ownerId }) => {
    const result = {
        postedInTranscriptChannel: false,
        sentByDm: false,
        issues: []
    };

    const transcriptPayload = await buildTranscriptPayload(channel);
    const transcriptChannelId = String(CHANNEL_IDS.TICKET_TRANSCRIPTS || "").trim();

    if (transcriptChannelId) {
        try {
            const transcriptChannel = guild.channels.cache.get(transcriptChannelId)
                || await guild.channels.fetch(transcriptChannelId);

            if (!transcriptChannel?.isTextBased()) {
                result.issues.push("Transcript-Channel ist nicht textbasiert.");
            } else {
                await transcriptChannel.send({
                    content: `Transcript für <#${channel.id}> | Käufer: ${ownerId ? `<@${ownerId}>` : "unbekannt"}`,
                    files: [new AttachmentBuilder(transcriptPayload.buffer, { name: transcriptPayload.fileName })]
                });
                result.postedInTranscriptChannel = true;
            }
        } catch (error) {
            result.issues.push(`Transcript konnte nicht in den Transcript-Channel gesendet werden (${error.message}).`);
        }
    } else {
        result.issues.push("TICKET_TRANSCRIPT_CHANNEL_ID ist nicht gesetzt.");
    }

    if (!ownerId) {
        result.issues.push("Ticket-Owner konnte nicht ermittelt werden, DM wurde nicht versendet.");
        return result;
    }

    try {
        const user = await guild.client.users.fetch(ownerId);
        await user.send({
            content: `Hier ist dein Transcript für Ticket \`${channel.name}\` (${channel.id}).`,
            files: [new AttachmentBuilder(transcriptPayload.buffer, { name: transcriptPayload.fileName })]
        });
        result.sentByDm = true;
    } catch (error) {
        result.issues.push(`Transcript konnte nicht per DM versendet werden (${error.message}).`);
    }

    return result;
};

const postEncryptedPaysafeLog = async (guild, entry) => {
    const encryptChannelId = String(CHANNEL_IDS.PSC_ENCRYPT_LOG || "").trim();
    if (!encryptChannelId) return;

    try {
        const encryptChannel = guild.channels.cache.get(encryptChannelId)
            || await guild.channels.fetch(encryptChannelId);
        if (!encryptChannel?.isTextBased()) return;

        await encryptChannel.send([
            "Neuer PSC-Kauf gespeichert:",
            `• Ticket-Channel: <#${entry.channelId}> (\`${entry.channelId}\`)`,
            `• Käufer: <@${entry.userId}>`,
            `• Paket: **${entry.packLabel}** (${Number(entry.packPrice).toFixed(2)}€)`,
            `• Verschlüsselter Code: \`${entry.encryptedCode}\``,
            `• Zeitpunkt: ${new Date(entry.createdAt).toLocaleString("de-DE")}`
        ].join("\n"));
    } catch (error) {
        console.error("PSC Encrypt-Log konnte nicht gesendet werden:", error);
    }
};

module.exports = {
    name: "interactionCreate",
    async execute(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId === "pack_select") {
                const selectedProduct = findProductById(interaction.values?.[0]);
                if (!selectedProduct) {
                    return interaction.reply({
                        content: "Dieses Paket existiert nicht mehr. Bitte erneut auswählen.",
                        ephemeral: true
                    });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`PayPal (${selectedProduct.price.toFixed(2)}€)`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(buildPayPalPaymentUrl(SAFE_PAYPAL_URL, selectedProduct.price)),
                    new ButtonBuilder()
                        .setCustomId(`${CHOOSE_PSC_PREFIX}${selectedProduct.id}`)
                        .setLabel("Paysafecard")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content: `Bitte wähle die Zahlungsmethode für **${selectedProduct.label}** aus:`,
                    components: [row],
                    ephemeral: true
                });
            }

            if (interaction.isButton()) {
                if (interaction.customId.startsWith(CHOOSE_PSC_PREFIX)) {
                    const productId = interaction.customId.slice(CHOOSE_PSC_PREFIX.length);
                    const product = findProductById(productId);
                    if (!product) {
                        return interaction.reply({
                            content: "Das ausgewählte Paket existiert nicht mehr.",
                            ephemeral: true
                        });
                    }

                    const pscModal = new ModalBuilder()
                        .setCustomId(`${PSC_MODAL_PREFIX}${product.id}`)
                        .setTitle("Paysafecard Zahlung");

                    const code = new TextInputBuilder()
                        .setCustomId("psc_code")
                        .setLabel("PSC Code eingeben (16-stellig)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder("1234-5678-9012-3456")
                        .setMinLength(16)
                        .setMaxLength(PSC_MAX_INPUT_LENGTH);

                    pscModal.addComponents(new ActionRowBuilder().addComponents(code));
                    return interaction.showModal(pscModal);
                }

                if (interaction.customId === "ticket_rename") {
                    if (!(await ensureTicketAdmin(interaction))) return;

                    const modal = new ModalBuilder()
                        .setCustomId("ticket_rename_modal")
                        .setTitle("Ticket umbenennen");

                    const newNameInput = new TextInputBuilder()
                        .setCustomId("ticket_new_name")
                        .setLabel("Neuer Ticketname (ohne Prefix)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("z. B. kunde-max-mustermann")
                        .setRequired(true)
                        .setMaxLength(MAX_TICKET_NAME_LENGTH);

                    modal.addComponents(new ActionRowBuilder().addComponents(newNameInput));
                    return interaction.showModal(modal);
                }

                if (interaction.customId === "ticket_request_close" || interaction.customId === "ticket_rate") {
                    if (!isTicketChannel(interaction.channel)) {
                        return interaction.reply({
                            content: "Diese Aktion ist nur in Ticket-Kanälen verfügbar.",
                            ephemeral: true
                        });
                    }

                    if (userIsTicketAdmin(interaction) || !userIsTicketOwner(interaction)) {
                        return interaction.reply({
                            content: "Nur der Käufer (nicht Admins) kann diese Aktion ausführen.",
                            ephemeral: true
                        });
                    }

                    const ratingModal = new ModalBuilder()
                        .setCustomId(TICKET_RATING_MODAL_ID)
                        .setTitle("Artikel bewerten");

                    const starsInput = new TextInputBuilder()
                        .setCustomId("ticket_rating_stars")
                        .setLabel("Sterne (1-5)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("1, 2, 3, 4 oder 5")
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(1);

                    const textInput = new TextInputBuilder()
                        .setCustomId("ticket_rating_text")
                        .setLabel("Kommentar")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("Optionaler Text zu deiner Bewertung")
                        .setRequired(false)
                        .setMaxLength(1000);

                    ratingModal.addComponents(
                        new ActionRowBuilder().addComponents(starsInput),
                        new ActionRowBuilder().addComponents(textInput)
                    );
                    return interaction.showModal(ratingModal);
                }

                if (interaction.customId === "ticket_force_close") {
                    if (!(await ensureTicketAdmin(interaction))) return;
                    await interaction.deferReply({ ephemeral: true });

                    const ownerId = getTicketOwnerId(interaction.channel);
                    if (ownerId) {
                        await interaction.channel.permissionOverwrites.edit(ownerId, {
                            SendMessages: false,
                            ViewChannel: true,
                            ReadMessageHistory: true
                        });
                    }

                    const baseName = getTicketBaseName(interaction.channel.name);
                    await interaction.channel.setName(`closed-${baseName}`);

                    if (ticketAutoDeleteTimeouts.has(interaction.channel.id)) {
                        clearTimeout(ticketAutoDeleteTimeouts.get(interaction.channel.id));
                    }

                    const channelIdForTimeout = interaction.channel.id;
                    const guildIdForTimeout = interaction.guild.id;
                    const timeoutHandle = setTimeout(async () => {
                        ticketAutoDeleteTimeouts.delete(channelIdForTimeout);
                        try {
                            const guild = await interaction.client.guilds.fetch(guildIdForTimeout);
                            const channel = await guild.channels.fetch(channelIdForTimeout);
                            if (channel && isTicketChannel(channel)) {
                                await channel.delete("Ticket wurde nach 24h Wartezeit automatisch gelöscht");
                            }
                        } catch {
                            // noop
                        }
                    }, AUTO_DELETE_DELAY_MS);
                    ticketAutoDeleteTimeouts.set(interaction.channel.id, timeoutHandle);

                    const transcriptResult = await sendTicketTranscript({
                        guild: interaction.guild,
                        channel: interaction.channel,
                        ownerId
                    });

                    await interaction.editReply({
                        content: "Schließung erzwungen. Ticket bleibt 24h für die Bewertung sichtbar."
                    });

                    const deleteAtUnix = Math.floor((Date.now() + AUTO_DELETE_DELAY_MS) / 1000);
                    await interaction.followUp({
                        content: [
                            `Automatische Löschung: <t:${deleteAtUnix}:F> (<t:${deleteAtUnix}:R>)`,
                            `Transcript-Channel: ${transcriptResult.postedInTranscriptChannel ? "✅" : "❌"}`,
                            `DM an Käufer: ${transcriptResult.sentByDm ? "✅" : "❌"}`,
                            ...(transcriptResult.issues.length ? ["", ...transcriptResult.issues.map((issue) => `• ${issue}`)] : [])
                        ].join("\n"),
                        ephemeral: true
                    });
                    return;
                }

                if (interaction.customId === "ticket_delete") {
                    if (!(await ensureTicketAdmin(interaction))) return;

                    if (ticketAutoDeleteTimeouts.has(interaction.channel.id)) {
                        clearTimeout(ticketAutoDeleteTimeouts.get(interaction.channel.id));
                        ticketAutoDeleteTimeouts.delete(interaction.channel.id);
                    }

                    await interaction.reply({
                        content: "Ticket wird gelöscht…",
                        ephemeral: true
                    });

                    await interaction.channel.delete("Ticket wurde von einem Admin gelöscht");
                    return;
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId === "ticket_rename_modal") {
                    if (!(await ensureTicketAdmin(interaction))) return;

                    const rawNewName = interaction.fields.getTextInputValue("ticket_new_name");
                    const normalizedName = sanitizeTicketNameSegment(rawNewName);
                    const isClosed = interaction.channel.name.startsWith("closed-");
                    const nextName = `${isClosed ? "closed" : "ticket"}-${normalizedName}`;

                    await interaction.channel.setName(nextName);
                    return interaction.reply({
                        content: `Ticket wurde umbenannt zu **${nextName}**.`,
                        ephemeral: true
                    });
                }

                if (interaction.customId === TICKET_RATING_MODAL_ID) {
                    if (!isTicketChannel(interaction.channel)) {
                        return interaction.reply({
                            content: "Diese Aktion ist nur in Ticket-Kanälen verfügbar.",
                            ephemeral: true
                        });
                    }

                    if (userIsTicketAdmin(interaction) || !userIsTicketOwner(interaction)) {
                        return interaction.reply({
                            content: "Nur der Käufer (nicht Admins) kann eine Bewertung abgeben.",
                            ephemeral: true
                        });
                    }

                    const rawStars = interaction.fields.getTextInputValue("ticket_rating_stars").trim();
                    const stars = Number(rawStars);
                    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
                        return interaction.reply({
                            content: "Bitte gib eine gültige Sternezahl von 1 bis 5 an.",
                            ephemeral: true
                        });
                    }

                    const reviewChannelId = String(CHANNEL_IDS.TICKET_REVIEWS || "").trim();
                    if (!reviewChannelId) {
                        return interaction.reply({
                            content: "Bewertungs-Channel ist nicht konfiguriert (TICKET_REVIEW_CHANNEL_ID).",
                            ephemeral: true
                        });
                    }

                    const reviewChannel = interaction.guild.channels.cache.get(reviewChannelId)
                        || await interaction.guild.channels.fetch(reviewChannelId).catch(() => null);
                    if (!reviewChannel?.isTextBased()) {
                        return interaction.reply({
                            content: "Bewertungs-Channel ist nicht erreichbar oder nicht textbasiert.",
                            ephemeral: true
                        });
                    }

                    const ratingText = interaction.fields.getTextInputValue("ticket_rating_text").trim();
                    const ownerId = getTicketOwnerId(interaction.channel);
                    const starVisual = "⭐".repeat(stars);

                    await reviewChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#f1c40f")
                                .setTitle("Neue Käufer-Bewertung")
                                .addFields(
                                    { name: "Käufer", value: ownerId ? `<@${ownerId}> (\`${ownerId}\`)` : interaction.user.toString(), inline: false },
                                    { name: "Ticket", value: `<#${interaction.channel.id}> (\`${interaction.channel.id}\`)`, inline: false },
                                    { name: "Bewertung", value: `${starVisual} (${stars}/5)`, inline: false },
                                    { name: "Kommentar", value: ratingText || "Kein zusätzlicher Text.", inline: false }
                                )
                                .setTimestamp()
                        ]
                    });

                    await interaction.reply({
                        content: "Danke! Deine Bewertung wurde gespeichert und die Schließung angefragt.",
                        ephemeral: true
                    });

                    await interaction.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#3498db")
                                .setTitle("Schließung angefragt")
                                .setDescription(`${interaction.user} hat eine Schließung angefragt und eine Bewertung abgegeben.`)
                                .setTimestamp()
                        ]
                    });
                    return;
                }

                if (interaction.customId.startsWith(PSC_MODAL_PREFIX)) {
                    const selectedProductId = interaction.customId.slice(PSC_MODAL_PREFIX.length);
                    const selectedProduct = findProductById(selectedProductId);
                    if (!selectedProduct) {
                        return interaction.reply({
                            content: "Das ausgewählte Paket existiert nicht mehr.",
                            ephemeral: true
                        });
                    }

                    const paymentInfo = interaction.fields.getTextInputValue("psc_code").trim();
                    if (!isValidPaysafeCode(paymentInfo)) {
                        return interaction.reply({
                            content: "Ungültiger Paysafecard-Code. Erlaubt sind 16 Ziffern (z. B. 1234-5678-9012-3456).",
                            ephemeral: true
                        });
                    }

                    const guild = interaction.guild;
                    await guild.channels.fetch();
                    const existingTicket = guild.channels.cache.find(
                        (channel) =>
                            isTicketChannel(channel) &&
                            getTicketOwnerId(channel) === interaction.user.id &&
                            channel.name.startsWith("ticket-")
                    );

                    if (existingTicket) {
                        return interaction.reply({
                            content: `Du hast bereits ein offenes Ticket: ${existingTicket}`,
                            ephemeral: true
                        });
                    }

                    const normalizedUser = sanitizeTicketNameSegment(interaction.user.username);

                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${normalizedUser}`,
                        type: ChannelType.GuildText,
                        topic: `${TICKET_OWNER_TOPIC_PREFIX}${interaction.user.id}`,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            }
                        ]
                    });

                    try {
                        const storedEntry = addPaysafeEntry({
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            packId: selectedProduct.id,
                            packLabel: selectedProduct.label,
                            packPrice: selectedProduct.price,
                            rawCode: paymentInfo
                        });

                        await postEncryptedPaysafeLog(guild, storedEntry);
                    } catch (storageError) {
                        await ticketChannel.delete("PSC-Code konnte nicht sicher gespeichert werden");
                        return interaction.reply({
                            content: "PSC-Code konnte nicht sicher gespeichert werden. Bitte Admin informieren.",
                            ephemeral: true
                        });
                    }

                    await interaction.reply({
                        content: `Dein Ticket wurde erstellt: ${ticketChannel}`,
                        ephemeral: true
                    });

                    await ticketChannel.send({
                        content: `${interaction.user}, danke für deine Angaben. Unser Team meldet sich hier bei dir.`,
                        embeds: [
                            ticketEmbed({
                                userName: interaction.user.username,
                                userId: interaction.user.id,
                                paymentInfo,
                                paymentMethod: "paysafe",
                                packLabel: selectedProduct.label,
                                packPrice: selectedProduct.price
                            })
                        ],
                        components: [createTicketManagementRow()]
                    });
                }
            }
        } catch (error) {
            console.error("Fehler bei interactionCreate:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction
                    .reply({
                        content: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.",
                        ephemeral: true
                    })
                    .catch(() => null);
            }
        }
    }
};
