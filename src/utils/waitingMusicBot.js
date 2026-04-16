const { ChannelType } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");
const { Readable } = require("stream");
const { MUSIC, COMMAND_PREFIX } = require("../config");

const sessions = new Map();

const normalizeChannelId = (value) => String(value || "").replace(/[<#>]/g, "").trim();

const isHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const ensureMusicUrl = () => {
    if (!isHttpUrl(MUSIC.STREAM_URL)) {
        throw new Error("MUSIC_STREAM_URL fehlt oder ist ungültig. Bitte in .env setzen.");
    }
    return MUSIC.STREAM_URL;
};

const createStreamResource = async (streamUrl) => {
    const response = await fetch(streamUrl);
    if (!response.ok || !response.body) {
        throw new Error(`Musikstream konnte nicht geladen werden (HTTP ${response.status}).`);
    }
    const stream = Readable.fromWeb(response.body);
    return createAudioResource(stream);
};

const stopSession = (guildId) => {
    const session = sessions.get(guildId);
    if (!session) return false;

    session.stopped = true;
    session.player.stop(true);
    session.connection.destroy();
    sessions.delete(guildId);
    return true;
};

const startLoop = async (session) => {
    if (session.stopped) return;

    try {
        const resource = await createStreamResource(session.streamUrl);
        session.player.play(resource);
    } catch (error) {
        console.error("Wartezimmer-Musik konnte nicht gestartet werden:", error);
        if (!session.stopped) {
            setTimeout(() => startLoop(session), 5_000);
        }
    }
};

const resolveTargetVoiceChannel = async (message, args) => {
    const explicitChannelId = normalizeChannelId(args[0]);
    if (explicitChannelId) {
        const explicitChannel = message.guild.channels.cache.get(explicitChannelId)
            || await message.guild.channels.fetch(explicitChannelId).catch(() => null);
        if (!explicitChannel) {
            throw new Error(`Voice-Channel \`${explicitChannelId}\` wurde nicht gefunden.`);
        }
        if (explicitChannel.type !== ChannelType.GuildVoice) {
            throw new Error("Der angegebene Channel ist kein Voice-Channel.");
        }
        return explicitChannel;
    }

    if (message.member?.voice?.channel?.type === ChannelType.GuildVoice) {
        return message.member.voice.channel;
    }

    const defaultVoiceChannelId = normalizeChannelId(MUSIC.DEFAULT_VOICE_CHANNEL_ID);
    if (defaultVoiceChannelId) {
        const defaultVoiceChannel = message.guild.channels.cache.get(defaultVoiceChannelId)
            || await message.guild.channels.fetch(defaultVoiceChannelId).catch(() => null);
        if (defaultVoiceChannel?.type === ChannelType.GuildVoice) {
            return defaultVoiceChannel;
        }
    }

    throw new Error("Kein Voice-Channel gefunden. Join zuerst einem Talk oder setze MUSIC_DEFAULT_VOICE_CHANNEL_ID.");
};

const sendHelp = async (message) => {
    await message.reply([
        "Wartezimmer-Musik:",
        `\`${COMMAND_PREFIX}wartemusik join [voiceChannelId]\``,
        `\`${COMMAND_PREFIX}wartemusik leave\``,
        `\`${COMMAND_PREFIX}wartemusik status\``
    ].join("\n"));
};

const joinMusic = async (message, args) => {
    const streamUrl = ensureMusicUrl();
    const targetVoiceChannel = await resolveTargetVoiceChannel(message, args);

    const existingConnection = getVoiceConnection(message.guild.id);
    if (existingConnection) {
        existingConnection.destroy();
    }
    stopSession(message.guild.id);

    const connection = joinVoiceChannel({
        channelId: targetVoiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause
        }
    });

    const session = {
        guildId: message.guild.id,
        voiceChannelId: targetVoiceChannel.id,
        streamUrl,
        connection,
        player,
        stopped: false
    };

    player.on(AudioPlayerStatus.Idle, () => {
        startLoop(session);
    });

    player.on("error", (error) => {
        console.error("AudioPlayer Fehler:", error);
    });

    connection.subscribe(player);
    sessions.set(message.guild.id, session);

    await startLoop(session);

    await message.reply(`Wartezimmer-Musik gestartet in ${targetVoiceChannel}.`);
};

const leaveMusic = async (message) => {
    const stopped = stopSession(message.guild.id);
    if (!stopped) {
        await message.reply("Es läuft aktuell keine Wartezimmer-Musik.");
        return;
    }
    await message.reply("Wartezimmer-Musik wurde gestoppt und der Bot hat den Talk verlassen.");
};

const musicStatus = async (message) => {
    const session = sessions.get(message.guild.id);
    if (!session) {
        await message.reply("Wartezimmer-Musik ist aktuell nicht aktiv.");
        return;
    }

    await message.reply([
        "Wartezimmer-Musik aktiv:",
        `• Voice-Channel: <#${session.voiceChannelId}>`,
        `• Stream: ${session.streamUrl}`
    ].join("\n"));
};

const handleWaitingMusicCommand = async (message, tokens) => {
    const subCommand = (tokens.shift() || "").toLowerCase();

    if (!subCommand || subCommand === "help") {
        await sendHelp(message);
        return;
    }

    if (subCommand === "join" || subCommand === "start") {
        await joinMusic(message, tokens);
        return;
    }

    if (subCommand === "leave" || subCommand === "stop") {
        await leaveMusic(message);
        return;
    }

    if (subCommand === "status") {
        await musicStatus(message);
        return;
    }

    await sendHelp(message);
};

module.exports = {
    handleWaitingMusicCommand
};
