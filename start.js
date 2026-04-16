require("dotenv").config();

if (!process.env.DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN fehlt. Bitte in der .env Datei setzen.");
    process.exit(1);
}

if (!process.env.PSC_ENCRYPTION_KEY) {
    console.error("PSC_ENCRYPTION_KEY fehlt. Bitte in der .env Datei setzen.");
    process.exit(1);
}

require("./src/bot");
