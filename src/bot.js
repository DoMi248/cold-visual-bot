require("dotenv").config();

const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.events = new Collection();

// EVENTS LADEN
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    client.events.set(event.name, event);

    // WICHTIG: Nur EIN Argument weitergeben!
    client.on(event.name, (interaction) => event.execute(interaction, client));
}

client.login(process.env.DISCORD_TOKEN);
