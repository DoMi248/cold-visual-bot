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

const TICKET_OWNER_TOPIC_PREFIX = "ticket-owner:";
const MAX_TICKET_NAME_LENGTH = 80;

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

module.exports = {
    name: "interactionCreate",
    async execute(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId === "pack_select") {
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
                    content: "Bitte wähle deine Zahlungsmethode aus:",
                    components: [row],
                    ephemeral: true
                });
            }

            if (interaction.isButton()) {
                if (interaction.customId === "choose_paypal") {
                    const paypalModal = new ModalBuilder()
                        .setCustomId("paypal_modal")
                        .setTitle("PayPal Zahlung");

                    const info = new TextInputBuilder()
                        .setCustomId("paypal_info")
                        .setLabel("PayPal E-Mail für den Nachweis")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("deine-paypal@mail.com")
                        .setRequired(true);

                    paypalModal.addComponents(new ActionRowBuilder().addComponents(info));
                    return interaction.showModal(paypalModal);
                }

                if (interaction.customId === "choose_psc") {
                    const pscModal = new ModalBuilder()
                        .setCustomId("psc_modal")
                        .setTitle("Paysafecard Zahlung");

                    const code = new TextInputBuilder()
                        .setCustomId("psc_code")
                        .setLabel("PSC Code eingeben")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

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

                if (interaction.customId === "paypal_modal" || interaction.customId === "psc_modal") {
                    const guild = interaction.guild;
                    await guild.channels.fetch();
                    const existingTicket = guild.channels.cache.find(
                        (channel) =>
                            channel.type === ChannelType.GuildText &&
                            channel.topic === `${TICKET_OWNER_TOPIC_PREFIX}${interaction.user.id}` &&
                            channel.name.startsWith("ticket-")
                    );

                    if (existingTicket) {
                        return interaction.reply({
                            content: `Du hast bereits ein offenes Ticket: ${existingTicket}`,
                            ephemeral: true
                        });
                    }

                    const normalizedUser = sanitizeTicketNameSegment(interaction.user.username);
                    const paymentMethod = interaction.customId === "psc_modal" ? "paysafe" : "paypal";
                    const paymentInfo =
                        paymentMethod === "paysafe"
                            ? interaction.fields.getTextInputValue("psc_code")
                            : interaction.fields.getTextInputValue("paypal_info");

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

                    await interaction.reply({
                        content: `Dein Ticket wurde erstellt: ${ticketChannel}`,
                        ephemeral: true
                    });

                    await ticketChannel.send({
                        content: `${interaction.user}, danke für deine Angaben. Unser Team meldet sich hier bei dir.`,
                        embeds: [ticketEmbed(interaction.user.username, interaction.user.id, paymentInfo, paymentMethod)],
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
