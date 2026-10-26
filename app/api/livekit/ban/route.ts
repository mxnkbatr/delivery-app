import { RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { roomName, identity } = await request.json();

    if (!roomName || !identity) {
      return NextResponse.json({ error: 'Missing roomName or identity' }, { status: 400 });
    }

    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!wsUrl || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Initialize RoomServiceClient — convert wss:// to https:// for REST API
    const httpUrl = wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    // Remove the participant
    await roomService.removeParticipant(roomName, identity);

    return NextResponse.json({ success: true, message: `User ${identity} removed from room ${roomName}` });
  } catch (error: any) {
    console.error('Ban Error:', error);
    return NextResponse.json({ error: 'Failed to ban user', details: error.message }, { status: 500 });
  }
}
