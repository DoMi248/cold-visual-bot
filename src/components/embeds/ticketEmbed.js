const { EmbedBuilder } = require("discord.js");

const maskPaysafeCode = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "");
    if (digitsOnly.length < 4) return "****";
    return `**** **** **** ${digitsOnly.slice(-4)}`;
};

const ticketEmbed = ({ userName, userId, paymentInfo, paymentMethod, packLabel, packPrice }) => {
    const status = paymentMethod === "paysafe" ? "Paysafe Code eingereicht" : "PayPal ueberwiesen";

    return new EmbedBuilder()
        .setTitle("Zahlungs-Ticket")
        .setDescription("Ein neues Zahlungs-Ticket wurde erstellt.")
        .addFields(
            { name: "Benutzer", value: `${userName} (ID: ${userId})`, inline: false },
            { name: "Paket", value: `${packLabel} (${packPrice.toFixed(2)}€)`, inline: false },
            { name: "Zahlungsmethode", value: paymentMethod === "paysafe" ? "Paysafe" : "PayPal", inline: true },
            { name: "Status", value: status, inline: true },
            { name: "Zahlungsinformation", value: paymentMethod === "paysafe" ? `Code: \`${maskPaysafeCode(paymentInfo)}\`` : "PayPal", inline: false },
            { name: "Nachricht", value: "Wir ueberpruefen die Zahlung und melden uns schnellstmoeglich bei Ihnen!", inline: false }
        )
        .setColor("#2b2d31")
        .setTimestamp()
        .setFooter({ text: "Zahlungs-System" });
};

module.exports = ticketEmbed;
