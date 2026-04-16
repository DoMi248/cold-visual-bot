const fs = require("fs");
const path = require("path");

const ensureJsonFile = (filePath, fallbackValue) => {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
        return;
    }

    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content) {
        fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
    }
};

const readJsonFile = (filePath, fallbackValue) => {
    ensureJsonFile(filePath, fallbackValue);
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        console.error(`JSON konnte nicht gelesen werden (${filePath}):`, error);
        return fallbackValue;
    }
};

const writeJsonFile = (filePath, value) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
};

module.exports = {
    ensureJsonFile,
    readJsonFile,
    writeJsonFile
};
