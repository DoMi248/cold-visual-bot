const { EmbedBuilder } = require("discord.js");

const ticketEmbed = (userName, userId, paymentInfo, paymentMethod) => {
    const status = paymentMethod === "paysafe" ? "Paysafe Code eingereicht" : "PayPal ueberwiesen";

    return new EmbedBuilder()
        .setTitle("Zahlungs-Ticket")
        .setDescription("Ein neues Zahlungs-Ticket wurde erstellt.")
        .addFields(
            { name: "Benutzer", value: `${userName} (ID: ${userId})`, inline: false },
            { name: "Zahlungsmethode", value: paymentMethod === "paysafe" ? "Paysafe" : "PayPal", inline: true },
            { name: "Status", value: status, inline: true },
            { name: "Zahlungsinformation", value: paymentMethod === "paysafe" ? "Code: `" + paymentInfo + "`" : "PayPal", inline: false },
            { name: "Nachricht", value: "Wir ueberpruefen die Zahlung und melden uns schnellstmoeglich bei Ihnen!", inline: false }
        )
        .setColor("#2b2d31")
        .setTimestamp()
        .setFooter({ text: "Zahlungs-System" });
};

module.exports = ticketEmbed;