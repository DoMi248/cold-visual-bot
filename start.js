require("dotenv").config();

if (!process.env.DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN fehlt. Bitte in der .env Datei setzen.");
    process.exit(1);
}

require("./src/bot");
