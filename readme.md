# Our Space

Private two-person space with Supabase authentication/signalling, LiveKit audio/video calls, and a synchronized YouTube watch room.

## Production deployment

Pushing this repository deploys the Vite site to Vercel, including the SPA route rewrite in `vercel.json`. It does **not** deploy Supabase database migrations or Edge Functions.

Before testing calls or Watch Something after this revision:

1. Apply every migration in `supabase/migrations` to the linked Supabase project, in filename order. `20261003000004_phase6_watch_together.sql` creates the synchronized player; `20261003000005_watch_chat_broadcast.sql` authorizes ephemeral private Watch chat; `20261003000006_watch_sync_broadcast.sql` enables low-latency private playback controls. In **Realtime Settings**, keep **Allow public access** disabled so private-channel authorization is enforced.
2. Deploy `supabase/functions/livekit-token` and `supabase/functions/youtube-search`. The latter now supports the music-only Watch search mode.
3. Set these Edge Function secrets in Supabase:
   - `LIVEKIT_URL` — the production `wss://…` LiveKit endpoint.
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `YOUTUBE_API_KEY` — an enabled YouTube Data API v3 key, stored only as a Supabase secret.
4. Confirm the Vercel project has deployed the current `main` commit and test its normal HTTPS URL, not a preview URL that has expired.

For a CLI-based Supabase deployment after linking the project:

```powershell
supabase db push
supabase functions deploy livekit-token
supabase functions deploy youtube-search
supabase secrets set LIVEKIT_URL="wss://your-project.livekit.cloud" LIVEKIT_API_KEY="..." LIVEKIT_API_SECRET="..." YOUTUBE_API_KEY="..."
```

Use two different paired accounts when testing. The same account on a laptop and phone intentionally disconnects its earlier LiveKit session.

## Verify Watch Something

Use two different paired accounts in separate browsers. Open **Watch Something** on both, search for an embeddable YouTube video from one account, then play, pause, and seek in either browser. The other browser should follow without a page refresh. A browser may require its own **Tap to join** gesture before it can start audible playback.

## Verify locally

```powershell
npm install
npm run build
npm run dev
```

Copy `.env.example` to `.env` and provide the Supabase URL and publishable key. Never commit `.env` or any LiveKit secret.
