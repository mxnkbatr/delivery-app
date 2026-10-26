import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useEffect } from 'react';

interface RoomEventHandlerProps {
    onDisconnected?: () => void;
    onReconnecting?: () => void;
    onReconnected?: () => void;
}

export default function RoomEventHandler({
    onDisconnected,
    onReconnecting,
    onReconnected
}: RoomEventHandlerProps) {
    const room = useRoomContext();

    useEffect(() => {
        if (!room) return;

        const handleDisconnected = () => {
            console.log('Room disconnected');
            onDisconnected?.();
        };

        const handleReconnecting = () => {
            console.log('Room reconnecting');
            onReconnecting?.();
        };

        const handleReconnected = () => {
            console.log('Room reconnected');
            onReconnected?.();
        };

        room.on(RoomEvent.Disconnected, handleDisconnected);
        room.on(RoomEvent.Reconnecting, handleReconnecting);
        room.on(RoomEvent.Reconnected, handleReconnected);

        return () => {
            room.off(RoomEvent.Disconnected, handleDisconnected);
            room.off(RoomEvent.Reconnecting, handleReconnecting);
            room.off(RoomEvent.Reconnected, handleReconnected);
        };
    }, [room, onDisconnected, onReconnecting, onReconnected]);

    return null;
}
