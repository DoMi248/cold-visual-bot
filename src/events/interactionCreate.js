const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");
const ticketEmbed = require("../components/embeds/ticketEmbed");
const { PAYPAL_URL, DEFAULT_PAYPAL_URL } = require("../config");
const { findProductById } = require("../utils/productStore");
const { addPaysafeEntry } = require("../utils/paysafeStore");

const TICKET_OWNER_TOPIC_PREFIX = "ticket-owner:";
const MAX_TICKET_NAME_LENGTH = 80;
const CHOOSE_PSC_PREFIX = "choose_psc:";
const PSC_MODAL_PREFIX = "psc_modal:";
const PSC_MAX_INPUT_LENGTH = 19;
const PAYSAFE_CODE_REGEX = /^\d{4}([ -]?\d{4}){3}$/;

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
            .setCustomId("ticket_close")
            .setLabel("Ticket schließen")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("ticket_rename")
            .setLabel("Ticket umbenennen")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_reopen")
            .setLabel("Ticket wieder öffnen")
            .setStyle(ButtonStyle.Success),
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

                if (interaction.customId === "ticket_close") {
                    if (!(await ensureTicketAdmin(interaction))) return;

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

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#f39c12")
                                .setTitle("Ticket geschlossen")
                                .setDescription(`Dieses Ticket wurde von ${interaction.user} geschlossen.`)
                                .setTimestamp()
                        ]
                    });
                    return;
                }

                if (interaction.customId === "ticket_reopen") {
                    if (!(await ensureTicketAdmin(interaction))) return;

                    const ownerId = getTicketOwnerId(interaction.channel);
                    if (ownerId) {
                        await interaction.channel.permissionOverwrites.edit(ownerId, {
                            SendMessages: true,
                            ViewChannel: true,
                            ReadMessageHistory: true
                        });
                    }

                    const baseName = getTicketBaseName(interaction.channel.name);
                    await interaction.channel.setName(`ticket-${baseName}`);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2ecc71")
                                .setTitle("Ticket wieder geöffnet")
                                .setDescription(`Dieses Ticket wurde von ${interaction.user} wieder geöffnet.`)
                                .setTimestamp()
                        ]
                    });
                    return;
                }

                if (interaction.customId === "ticket_delete") {
                    if (!(await ensureTicketAdmin(interaction))) return;

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
                        addPaysafeEntry({
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            packId: selectedProduct.id,
                            packLabel: selectedProduct.label,
                            packPrice: selectedProduct.price,
                            rawCode: paymentInfo
                        });
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
