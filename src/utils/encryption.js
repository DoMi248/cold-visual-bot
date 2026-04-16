const crypto = require("crypto");
const { PSC_ENCRYPTION_KEY } = require("../config");

const ALGORITHM = "aes-256-gcm";
// 12 bytes (96 bit) is the recommended IV size for GCM.
const IV_LENGTH = 12;

const getEncryptionKey = () => {
    if (!PSC_ENCRYPTION_KEY) {
        throw new Error("PSC_ENCRYPTION_KEY fehlt. Bitte in .env setzen.");
    }
    return crypto.createHash("sha256").update(PSC_ENCRYPTION_KEY).digest();
};

const encryptText = (plainText) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptText = (payload) => {
    const [ivHex, authTagHex, encryptedHex] = String(payload).split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error("Ungültige verschlüsselte Daten.");
    }

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
};

module.exports = {
    encryptText,
    decryptText
};
