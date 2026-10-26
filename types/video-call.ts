export type ConnectionState = 'connecting' | 'reconnecting' | 'connected' | 'failed' | 'disconnected';

export interface TokenResponse {
    token: string;
    expiresIn: number;
}

export type PermissionError = 'camera' | 'microphone' | 'both' | 'denied' | 'unavailable' | null;

export interface VideoCallState {
    roomName: string;
    token: string;
    identity: string;
    isConnecting: boolean;
}
