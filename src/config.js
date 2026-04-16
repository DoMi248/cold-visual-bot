function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

module.exports = {
    GUILD_ID: requireEnv("GUILD_ID"),
    TARGET_CHANNEL: requireEnv("TARGET_CHANNEL"),
    PAYPAL_EMAIL: requireEnv("PAYPAL_EMAIL")
};
