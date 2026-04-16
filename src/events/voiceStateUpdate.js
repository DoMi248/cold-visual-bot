const { handleWaitingRoomJoin } = require("../utils/waitingMusicBot");

module.exports = {
    name: "voiceStateUpdate",
    async execute(oldState, newState) {
        await handleWaitingRoomJoin(oldState, newState);
    }
};
