import * as Ably from 'ably';

let ablyRest: Ably.Rest | null = null;

export function getAblyClient(): Ably.Rest {
    const key = process.env.ABLY_KEY || process.env.ABLY_API_KEY;
    if (!key) {
        throw new Error('ABLY_KEY or ABLY_API_KEY environment variable is not set');
    }
    if (!ablyRest) {
        ablyRest = new Ably.Rest({ key });
    }
    return ablyRest;
}
