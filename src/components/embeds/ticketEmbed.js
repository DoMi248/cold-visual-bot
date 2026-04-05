// ticketEmbed.js

const { MessageEmbed } = require('discord.js');

const ticketEmbed = (userName, amount, status) => {
    return new MessageEmbed()
        .setColor(status === 'verified' ? '#00FF00' : '#FF0000')
        .setTitle('Payment Verification Status')
        .setDescription(`User: ${userName}\nAmount: $${amount}\nStatus: ${status}`)
        .setFooter('Please contact support if you have any questions.');
};

module.exports = ticketEmbed;