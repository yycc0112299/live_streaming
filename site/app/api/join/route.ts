import { joinBroadcast } from '../../../lib/room-api.ts';

export async function POST(request: Request): Promise<Response> {
  return joinBroadcast(request, {
    livekitUrl: process.env.LIVEKIT_URL ?? '',
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    creatorKey: process.env.CREATOR_KEY ?? '',
    inviteSecret: process.env.INVITE_SIGNING_KEY ?? '',
  }, Math.floor(Date.now() / 1000));
}
