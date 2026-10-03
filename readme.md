# Our Space

Private two-person space with Supabase authentication/signalling and LiveKit audio/video calls.

## Production call deployment

Pushing this repository deploys the Vite site to Vercel, including the SPA route rewrite in `vercel.json`. It does **not** deploy Supabase database migrations or Edge Functions.

Before testing calls after this revision:

1. Apply every migration in `supabase/migrations` to the linked Supabase project, in filename order. The current reliability migration is `20261003000003_call_reliability.sql`.
2. Deploy `supabase/functions/livekit-token`.
3. Set these Edge Function secrets in Supabase:
   - `LIVEKIT_URL` — the production `wss://…` LiveKit endpoint.
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Confirm the Vercel project has deployed the current `main` commit and test its normal HTTPS URL, not a preview URL that has expired.

For a CLI-based Supabase deployment after linking the project:

```powershell
supabase db push
supabase functions deploy livekit-token
supabase secrets set LIVEKIT_URL="wss://your-project.livekit.cloud" LIVEKIT_API_KEY="..." LIVEKIT_API_SECRET="..."
```

Use two different paired accounts when testing. The same account on a laptop and phone intentionally disconnects its earlier LiveKit session.

## Verify locally

```powershell
npm install
npm run build
npm run dev
```

Copy `.env.example` to `.env` and provide the Supabase URL and publishable key. Never commit `.env` or any LiveKit secret.
