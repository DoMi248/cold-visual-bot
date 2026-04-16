const crypto = require("crypto");
const { DATA_FILES } = require("../config");
const { readJsonFile, writeJsonFile } = require("./fileHandler");
const { encryptText, decryptText } = require("./encryption");

const getEntries = () => {
    const entries = readJsonFile(DATA_FILES.PAYSAFE, []);
    return Array.isArray(entries) ? entries : [];
};

const saveEntries = (entries) => writeJsonFile(DATA_FILES.PAYSAFE, entries);

const addPaysafeEntry = ({ userId, channelId, packId, packLabel, packPrice, rawCode }) => {
    const entries = getEntries();
    const entry = {
        id: crypto.randomUUID(),
        userId,
        channelId,
        packId,
        packLabel,
        packPrice,
        encryptedCode: encryptText(rawCode),
        createdAt: new Date().toISOString()
    };

    entries.push(entry);
    saveEntries(entries);
    return entry;
};

const getLatestEntryByChannelId = (channelId) =>
    getEntries()
        .filter((entry) => entry.channelId === channelId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

const decryptEntryCode = (entry) => decryptText(entry.encryptedCode);

module.exports = {
    addPaysafeEntry,
    getLatestEntryByChannelId,
    decryptEntryCode,
    getEntries
};
