'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionState, TokenResponse } from '@/types/video-call';

export function useVideoRoom() {
    const [token, setToken] = useState<string>('');
    const [identity, setIdentity] = useState<string>('');
    const [roomName, setRoomName] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const disconnect = useCallback(() => {
        setToken('');
        setIdentity('');
        setRoomName('');
        setDisplayName('');
        setConnectionState('disconnected');
        setIsConnecting(false);
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
        }
    }, []);

    const fetchToken = async (rName: string, iden: string, dispName: string): Promise<TokenResponse> => {
        const response = await fetch('/api/livekit/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName: rName, identity: iden, displayName: dispName })
        });
        if (!response.ok) {
            throw new Error('Failed to fetch token');
        }
        const data = await response.json();
        return data as TokenResponse;
    };

    const scheduleRefresh = useCallback((expiresIn: number, rName: string, iden: string, dispName: string) => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }
        // Schedule refresh at 80% of expiresIn
        const delay = expiresIn * 0.8 * 1000;
        refreshTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await fetchToken(rName, iden, dispName);
                setToken(data.token);
                scheduleRefresh(data.expiresIn, rName, iden, dispName);
            } catch (err) {
                console.error('Error refreshing token:', err);
            }
        }, delay);
    }, []);

    const connectToRoom = useCallback(async (rName: string, iden: string, dispName: string) => {
        setIsConnecting(true);
        setConnectionState('connecting');
        try {
            const data = await fetchToken(rName, iden, dispName);
            setToken(data.token);
            setIdentity(iden);
            setRoomName(rName);
            setDisplayName(dispName);
            setConnectionState('connected');
            scheduleRefresh(data.expiresIn, rName, iden, dispName);
            return data.token;
        } catch (err) {
            setConnectionState('failed');
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, [scheduleRefresh]);

    const refreshToken = useCallback(async () => {
        if (!roomName || !identity) return;
        try {
            const data = await fetchToken(roomName, identity, displayName);
            setToken(data.token);
            scheduleRefresh(data.expiresIn, roomName, identity, displayName);
        } catch (err) {
            console.error('Manual refresh token failed:', err);
            throw err;
        }
    }, [roomName, identity, displayName, scheduleRefresh]);

    useEffect(() => {
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, []);

    return {
        token,
        identity,
        roomName,
        connectionState,
        setConnectionState,
        connectToRoom,
        refreshToken,
        disconnect,
        isConnecting
    };
}
