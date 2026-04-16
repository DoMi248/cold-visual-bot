const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");
const { MUSIC, COMMAND_PREFIX } = require("../config");

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".webm"]);
const CURRENT_TRACK_MARKER = "[AKTUELL]";
const sessions = new Map();

const normalizeChannelId = (value) => String(value || "").replace(/[<#>]/g, "").trim();
const normalizeTrackToken = (value) => String(value || "").trim().toLowerCase();
const wrapIndex = (index, length) => ((index % length) + length) % length;

const resolveAudioDirectory = () => {
    const configured = String(MUSIC.AUDIO_DIR || "").trim();
    const directory = configured || "src/data/audio";
    return path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory);
};

const getConfiguredTrackNames = () =>
    String(MUSIC.TRACKS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const toTrackLabel = (filename) => path.parse(filename).name;

const resolveTracks = () => {
    const audioDir = resolveAudioDirectory();
    const configuredTracks = getConfiguredTrackNames();

    const fromName = (filename) => {
        const fullPath = path.join(audioDir, filename);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Track-Datei nicht gefunden: ${filename}`);
        }
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            throw new Error(`Track ist keine Datei: ${filename}`);
        }
        return {
            filePath: fullPath,
            filename: path.basename(fullPath),
            label: toTrackLabel(path.basename(fullPath))
        };
    };

    if (configuredTracks.length) {
        return configuredTracks.map(fromName);
    }

    if (!fs.existsSync(audioDir)) {
        return [];
    }

    return fs.readdirSync(audioDir)
        .filter((entry) => AUDIO_EXTENSIONS.has(path.extname(entry).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, "de"))
        .map(fromName);
};

const ensureTracks = () => {
    const tracks = resolveTracks();
    if (!tracks.length) {
        throw new Error("Keine Audio-Tracks gefunden. Lege Dateien in MUSIC_AUDIO_DIR ab oder setze MUSIC_TRACKS.");
    }
    return tracks;
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

    throw new Error("Kein Voice-Channel gefunden. Nutze `join [voiceChannelId]`, trete selbst einem Talk bei oder setze MUSIC_DEFAULT_VOICE_CHANNEL_ID.");
};

const createSession = async (guild, voiceChannel) => {
    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
        existingConnection.destroy();
    }
    stopSession(guild.id);

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play
        }
    });
    player.on("error", (error) => {
        console.error("AudioPlayer Fehler:", error);
    });

    connection.subscribe(player);

    const session = {
        guildId: guild.id,
        voiceChannelId: voiceChannel.id,
        connection,
        player,
        stopped: false,
        selectedTrackIndex: 0
    };
    sessions.set(guild.id, session);
    return session;
};

const ensureSession = async (guild, voiceChannel) => {
    const existing = sessions.get(guild.id);
    if (
        existing &&
        !existing.stopped &&
        existing.voiceChannelId === voiceChannel.id &&
        existing.connection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
        return existing;
    }
    return createSession(guild, voiceChannel);
};

const playTrack = (session, tracks, trackIndex) => {
    const normalizedIndex = Number.isInteger(trackIndex) ? trackIndex : session.selectedTrackIndex || 0;
    if (normalizedIndex < 0 || normalizedIndex >= tracks.length) {
        throw new Error("Ungültiger Track-Index.");
    }

    const track = tracks[normalizedIndex];
    const resource = createAudioResource(fs.createReadStream(track.filePath));

    session.selectedTrackIndex = normalizedIndex;
    session.player.play(resource);
    return track;
};

const findTrackIndex = (tracks, query) => {
    const token = normalizeTrackToken(query);
    if (!token) return -1;

    const numeric = Number.parseInt(token, 10);
    if (Number.isInteger(numeric) && String(numeric) === token) {
        const index = numeric - 1;
        if (index >= 0 && index < tracks.length) return index;
    }

    return tracks.findIndex((track) =>
        normalizeTrackToken(track.label) === token || normalizeTrackToken(track.filename) === token
    );
};

const sendHelp = async (message) => {
    await message.reply([
        "Wartezimmer-Musik:",
        `\`${COMMAND_PREFIX}wartemusik join [voiceChannelId]\``,
        `\`${COMMAND_PREFIX}wartemusik leave\``,
        `\`${COMMAND_PREFIX}wartemusik status\``,
        `\`${COMMAND_PREFIX}wartemusik list\``,
        `\`${COMMAND_PREFIX}wartemusik switch <trackName|nummer>\``,
        `\`${COMMAND_PREFIX}wartemusik next\``,
        `\`${COMMAND_PREFIX}wartemusik prev\``
    ].join("\n"));
};

const joinMusic = async (message, args) => {
    const tracks = ensureTracks();
    const targetVoiceChannel = await resolveTargetVoiceChannel(message, args);
    const session = await ensureSession(message.guild, targetVoiceChannel);
    const track = playTrack(session, tracks, session.selectedTrackIndex || 0);

    await message.reply(`Wartezimmer-Musik gestartet in ${targetVoiceChannel} mit **${track.label}**.`);
};

const leaveMusic = async (message) => {
    const stopped = stopSession(message.guild.id);
    if (!stopped) {
        await message.reply("Es läuft aktuell keine Wartezimmer-Musik.");
        return;
    }
    await message.reply("Wartezimmer-Musik wurde gestoppt und der Bot hat den Talk verlassen.");
};

const listTracks = async (message) => {
    const tracks = ensureTracks();
    const session = sessions.get(message.guild.id);
    const selectedIndex = session?.selectedTrackIndex ?? 0;

    const lines = tracks.map((track, index) => `${index === selectedIndex ? CURRENT_TRACK_MARKER : "•"} ${index + 1}. ${track.label}`);
    await message.reply(["Verfügbare Tracks:", ...lines].join("\n"));
};

const switchTrack = async (message, args) => {
    const tracks = ensureTracks();
    const query = args.join(" ").trim();
    if (!query) {
        await message.reply(`Nutzung: \`${COMMAND_PREFIX}wartemusik switch <trackName|nummer>\``);
        return;
    }

    const nextIndex = findTrackIndex(tracks, query);
    if (nextIndex === -1) {
        await message.reply("Track nicht gefunden. Nutze `wartemusik list`.");
        return;
    }

    const currentSession = sessions.get(message.guild.id);
    if (!currentSession) {
        const channel = await resolveTargetVoiceChannel(message, []);
        const session = await ensureSession(message.guild, channel);
        const track = playTrack(session, tracks, nextIndex);
        await message.reply(`Track gewechselt zu **${track.label}** und Wiedergabe gestartet.`);
        return;
    }

    const track = playTrack(currentSession, tracks, nextIndex);
    await message.reply(`Track gewechselt zu **${track.label}**.`);
};

const switchRelativeTrack = async (message, step) => {
    const tracks = ensureTracks();
    const currentSession = sessions.get(message.guild.id);
    if (!currentSession) {
        await message.reply("Es läuft aktuell keine Wartezimmer-Musik. Starte zuerst `wartemusik join`.");
        return;
    }

    const currentIndex = currentSession.selectedTrackIndex || 0;
    const nextIndex = wrapIndex(currentIndex + step, tracks.length);
    const track = playTrack(currentSession, tracks, nextIndex);
    await message.reply(`Jetzt läuft **${track.label}**.`);
};

const musicStatus = async (message) => {
    const tracks = resolveTracks();
    const session = sessions.get(message.guild.id);
    if (!session) {
        await message.reply("Wartezimmer-Musik ist aktuell nicht aktiv.");
        return;
    }

    const currentTrack = tracks[session.selectedTrackIndex];
    await message.reply([
        "Wartezimmer-Musik aktiv:",
        `• Voice-Channel: <#${session.voiceChannelId}>`,
        `• Track: ${currentTrack ? currentTrack.label : "unbekannt"}`
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

    if (subCommand === "list") {
        await listTracks(message);
        return;
    }

    if (subCommand === "switch" || subCommand === "select" || subCommand === "track") {
        await switchTrack(message, tokens);
        return;
    }

    if (subCommand === "next") {
        await switchRelativeTrack(message, 1);
        return;
    }

    if (subCommand === "prev" || subCommand === "previous") {
        await switchRelativeTrack(message, -1);
        return;
    }

    await sendHelp(message);
};

const handleWaitingRoomJoin = async (oldState, newState) => {
    if (!newState.guild || newState.member?.user?.bot) return;

    const waitingRoomId = normalizeChannelId(MUSIC.WAITING_ROOM_CHANNEL_ID);
    if (!waitingRoomId) return;

    const joinedWaitingRoom = newState.channelId === waitingRoomId && oldState.channelId !== waitingRoomId;
    if (!joinedWaitingRoom) return;

    const targetChannel = newState.channel
        || await newState.guild.channels.fetch(waitingRoomId).catch(() => null);
    if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) return;

    try {
        const tracks = ensureTracks();
        const session = await ensureSession(newState.guild, targetChannel);
        playTrack(session, tracks, session.selectedTrackIndex || 0);
    } catch (error) {
        console.error("Wartezimmer-Begrüßungsmusik konnte nicht abgespielt werden:", error);
    }
};

module.exports = {
    handleWaitingMusicCommand,
    handleWaitingRoomJoin
};
