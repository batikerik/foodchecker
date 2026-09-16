# FoodChecker

A mobile web app: take a photo of an ingredient list of anything (food, drinks, hair gel, baby formula, household chemicals) - and get a breakdown of the components, risks, contraindications, and a safety score from 0 to 100 tailored personally to you.

Your profile (allergies, conditions, pregnancy, etc.) is stored only in your phone's localStorage and is sent along with the photo so the score is personalized.

## What's where

```
public/index.html   the entire interface (single file, no build step)
lib/analyze.js      Gemini call + response schema + expert prompt
api/analyze.js      serverless function for Vercel
server.js           local server (static files + /api/analyze)
```

## Running locally

Dependencies are already installed. All you need is a key:

```powershell
$env:GEMINI_API_KEY = "<your key>"
npm run dev
```

Open http://localhost:3000

To avoid entering the key every time, save it once for your user account:

```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "<твой ключ>", "User")
```

After that, open a **new** PowerShell window (the old one still sees the old variables).

The camera in a mobile browser requires HTTPS or localhost. Over `http://<IP>:3000` on a local network, the "Take a photo" button may only open the gallery - for a full camera test it's easier to deploy (see below).

## Deploying to Vercel

```sh
npm i -g vercel
vercel                          # first deploy, press Enter to accept the defaults
vercel env add GEMINI_API_KEY   # paste the key, choose Production
vercel --prod
```

You'll get an HTTPS link - open it on your phone and add it to your home screen ("Share" -> "Add to Home Screen"); it will behave like an app.

## Settings

- **Model:** `gemini-3.6-flash`. Changed via the `GEMINI_MODEL` environment variable without touching the code. If the model ever gets renamed, the app will automatically fall back to `gemini-flash-latest`.
- **Prompt and scoring scale:** the `SYSTEM` constant in `lib/analyze.js`.
- **Profile fields:** `FIELDS` in `public/index.html` + `profileToText` in `lib/analyze.js`.
- **Thinking depth:** the `GEMINI_THINKING` variable, currently `high`. The set of allowed values depends on the model - for `gemini-3.6-flash` it's only `high` and `low`. If the model rejects the given level, the request is automatically retried without it.
