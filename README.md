# StrokeSense — AI swim technique coach

Upload a swimming video, tell the coach what you want checked, and get a breakdown of the biggest technique
issues, why they matter, drills to fix them, and a short plan — then keep chatting about it. Sessions are saved
in your browser so you can come back to them. Works on phones and desktops.

**How it works:** the video goes from your device straight to Google's Gemini file service, Gemini watches the
clip and returns a structured coaching report, and every follow-up question is answered with the video still in
view. Your API key only ever lives on the server.

---

## Deploy it in ~15 minutes (no coding tools needed)

You need three free accounts: Google AI Studio (API key), GitHub (holds the code), Vercel (hosts the site).

### 1. Get a Gemini API key
1. Go to https://aistudio.google.com/apikey and sign in with your Google account.
2. Click **Create API key**. Copy it somewhere safe — you'll paste it into Vercel in step 3.
   (The free tier is enough for a demo. If you hit rate limits during testing, turn on billing for that key in AI Studio.)

### 2. Put the code on GitHub
1. Go to https://github.com and sign up / sign in.
2. Click the **+** (top right) → **New repository**. Name it `strokesense`, leave it **Public** or **Private** (either works), click **Create repository**.
3. On the new repo page click **uploading an existing file** (or **Add file → Upload files**).
4. Unzip `strokesense.zip` on your PC, open the unzipped `strokesense` folder, select **everything inside it** (the `app`, `components`, `lib` folders and all the files) and drag them into the GitHub upload box. Wait for every file to finish.
5. Scroll down and click **Commit changes**.

### 3. Deploy on Vercel
1. Go to https://vercel.com and sign up **with your GitHub account**.
2. Click **Add New… → Project**, find `strokesense` in the list and click **Import**.
3. Leave Framework as **Next.js**. Open **Environment Variables** and add:
   - Name: `GEMINI_API_KEY` — Value: *the key from step 1*
4. Click **Deploy**. It takes about 1–2 minutes.
5. Click the preview / **Visit** button. Your app is live at `https://strokesense-xxxx.vercel.app`. Open that link on your phone too — the layout adapts automatically.

### 4. Try it
Pick a 15–45 second clip (MP4 or MOV, filmed from the side or front), type what you want checked, hit **Analyze my swim**.
The first analysis takes about a minute. Then ask follow-ups in the chat box.

---

## If something goes wrong

- **"GEMINI_API_KEY is not set"** → In Vercel: Project → Settings → Environment Variables, add it, then Deployments → ⋯ → Redeploy.
- **Upload rejected / network error** → Try a shorter clip (under ~100 MB) or export it as MP4. Phone videos usually work as-is.
- **Analysis times out** → Use a shorter clip (under 45 s). Vercel's free plan stops a request after 60 seconds.
- **Model not found error** → Google renamed the model. In Vercel add an environment variable `GEMINI_MODEL` with a current model name from https://ai.google.dev/models (e.g. `gemini-3.8-flash`) and redeploy.
- **Old session says "video has expired"** → Google keeps uploads for ~48 hours. Start a new session and re-upload.

## Updating the app later
Edit a file on GitHub (open the file → pencil icon → Commit). Vercel redeploys automatically within a minute or two.

## Running locally (optional, needs Node.js 18+)
```
npm install
copy .env.example .env.local   # then paste your key into .env.local
npm run dev                    # open http://localhost:3000
```
