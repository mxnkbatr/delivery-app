export function getAblyEnabled(): boolean {
    return !!(process.env.ABLY_KEY || process.env.ABLY_API_KEY);
}
