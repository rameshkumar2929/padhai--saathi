# Padhai Saathi

A low-bandwidth, installable study companion for Classes 8-10. Students choose Gujarati, Hindi, or English, take a chapter check, review scores by topic, read a short explanation, and practise. Progress stays in the browser; there is no database or account.

## What is included

- Four Maths and four Science chapters. Each has four topics and five built-in questions per topic (20 questions per chapter), with choices, answers, and explanations in English, Hindi, and Gujarati.
- A balanced 10-question chapter check with a score and Weak / Improving / OK indication for each topic.
- Step-sized built-in explanations and five-question practice sessions. A saved topic reaches OK mastery only after correct answers in at least two separate practice sessions.
- Local progress and score history in `localStorage`; only an optional nickname is stored, and it is not sent to the server.
- An optional Gemini route for a simpler explanation or one extra question. The API key remains on the server. Missing keys, timeouts, invalid model JSON, rate limits, and model errors use the built-in bank instead.
- `/teacher` is a static demo summary. Its class counts are sample numbers, not collected student data.
- A web manifest and service worker cache the app shell and same-origin assets after the first visit. AI needs a connection; progress is device-local and is not synced.

The chapter/topic selection is shared across the three class choices rather than aligned to a particular state board syllabus. The built-in questions are short practice checks, not an official assessment. The API rate limit and cache are best-effort in-memory controls per server process; they are not shared across serverless instances.

## Run locally

Requirements: Node.js 20.9 or newer and npm. On PowerShell systems where script execution blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>. The app works without an API key using the built-in question bank. To check the production version locally:

```powershell
npm run lint
npm run typecheck
npm run build
npm run start
```

## Optional Gemini key (free tier)

1. Sign in to Google AI Studio and create a key at <https://aistudio.google.com/app/apikey>. Select the free option; do not add billing details. If Google asks for a card or payment method, stop and leave AI disabled.
2. Copy `.env.example` to `.env.local` and put the key after `GEMINI_API_KEY=`. Do not paste the key into source code, chat, or a commit. `.env*` is ignored by Git except the safe `.env.example` template.
3. Restart the development server. Without a key, study and practice continue with the built-in bank.

The API route calls Gemini 2.5 Flash, asks for JSON, validates the response, retries once when the returned JSON is invalid, times out quickly, caches repeated requests for 15 minutes, and applies a best-effort per-IP limit of ten uncached calls per hour.

## Deploy free

### GitHub

Create an empty public or private repository named `padhai-saathi` on GitHub, without a README, license, or gitignore. Then set your own Git identity if needed and run these commands in the project folder:

```powershell
git config user.name "YOUR NAME"
git config user.email "YOUR GITHUB EMAIL"
git add .
git commit -m "Build Padhai Saathi study companion"
git remote add origin https://github.com/YOUR-USERNAME/padhai-saathi.git
git push -u origin master
```

If your GitHub repository uses `main`, replace `master` with `main`. The repository has been initialized locally. Check `git config user.name` before committing; the initial environment may contain a placeholder identity.

### Vercel Hobby

1. Import the GitHub repository at <https://vercel.com/new> and select the free Hobby plan. Do not continue if a step requests payment details.
2. In project settings, add `GEMINI_API_KEY` under Environment Variables for Production (and Preview if desired). Paste the secret directly into Vercel yourself; it is never needed in GitHub.
3. Deploy. The app remains usable if this variable is not set, using the built-in bank.

After deployment, test `/`, `/teacher`, all three languages, and AI fallback by leaving `GEMINI_API_KEY` unset or temporarily disabling the network. Never add the key to a browser-visible variable such as `NEXT_PUBLIC_GEMINI_API_KEY`.

## Privacy and limits

No sign-in, email, phone number, real name, database, analytics, or student sync is implemented. A nickname is optional and remains in local browser storage. Clearing browser storage removes progress. The teacher view is sample-only, the question bank is a starter curriculum rather than an official syllabus, and AI-generated material may need teacher review.