const { DATA_FILES } = require("../config");
const { readJsonFile, writeJsonFile } = require("./fileHandler");

const XP_PER_MESSAGE = 15;
const MESSAGE_COOLDOWN_MS = 60 * 1000;

const getEntries = () => {
    const entries = readJsonFile(DATA_FILES.LEVELS, []);
    return Array.isArray(entries) ? entries : [];
};

const saveEntries = (entries) => writeJsonFile(DATA_FILES.LEVELS, entries);

const getRequiredXp = (level) => Math.max(100, Number(level) * 100);

const addMessageXp = ({ guildId, userId, timestamp = Date.now() }) => {
    const entries = getEntries();
    const entryIndex = entries.findIndex((entry) => entry.guildId === guildId && entry.userId === userId);
    const current = entryIndex === -1
        ? { guildId, userId, level: 1, xp: 0, lastMessageAt: 0 }
        : entries[entryIndex];

    const lastMessageAt = Number(current.lastMessageAt) || 0;
    if (timestamp - lastMessageAt < MESSAGE_COOLDOWN_MS) {
        return null;
    }

    let nextLevel = Number(current.level) || 1;
    let nextXp = (Number(current.xp) || 0) + XP_PER_MESSAGE;
    let leveledUp = false;

    while (nextXp >= getRequiredXp(nextLevel)) {
        nextXp -= getRequiredXp(nextLevel);
        nextLevel += 1;
        leveledUp = true;
    }

    const nextEntry = {
        guildId,
        userId,
        level: nextLevel,
        xp: nextXp,
        lastMessageAt: timestamp
    };

    if (entryIndex === -1) {
        entries.push(nextEntry);
    } else {
        entries[entryIndex] = nextEntry;
    }
    saveEntries(entries);

    return {
        ...nextEntry,
        leveledUp
    };
};

module.exports = {
    addMessageXp
};
