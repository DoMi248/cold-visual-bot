const { EmbedBuilder } = require("discord.js");

module.exports = (products) => {
    const listLines = (products || []).map((product) => `• **${product.label}** — \`${product.price.toFixed(2)}€\``);
    const description = [
        "**Individuelle Preise für Kleidung**",
        listLines.length ? listLines.join("\n") : "Derzeit sind keine Produkte hinterlegt.",
        "",
        "Wähle ein Paket aus dem Dropdown, um die Zahlung zu starten."
    ].join("\n");

    return new EmbedBuilder()
        .setTitle("SERVER INFORMATION")
        .setDescription(description)
        .setColor("#2b2d31");
};
