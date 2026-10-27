# DEPLOY — hosting The Lantern Room on GitHub Pages

The competition rules for IWSDK/WebXR entries require a **link judges can open
and test**. This project is a static Vite build, so GitHub Pages is the simplest
free, HTTPS hosting option. The included `vite.config.ts` already uses
`base: './'`, so the same `dist/` works at a GitHub Pages project URL
(`https://<user>.github.io/<repo>/`) with no path edits.

> **Keep the site live and unchanged until the winner announcement (on or around
> 2026-12-11).** The rules require the Project to "remain available until the
> Winner Announcement", and no changes to the submission are allowed after the
> entry period ends.

---

## 0. Prerequisites

- A GitHub account and a repository for this project (name example:
  `the-lantern-room`).
- Node.js 20.19+ / 22.12+ and npm locally.
- The project builds locally:

  ```bash
  npm install
  npm run build   # must print "✓ built in …" and create dist/
  ```

If your environment blocks writes to `~/.npm`, run npm with the cache inside the
project:

```bash
npm_config_cache=$PWD/.npm-cache npm install
```

---

## 1. Option A (recommended): GitHub Actions Pages workflow

The repository includes `.github/workflows/deploy-pages.yml`, which builds the
Vite app and publishes `dist/` via GitHub's official Pages actions.

1. **Create the repository** on GitHub (public or private — Pages is available
   for both on current plans; public is simplest for judges).
2. **Push the code** (from this folder):

   ```bash
   git init
   git add -A
   git commit -m "The Lantern Room — Meta VR Start 2026 entry"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

3. **Enable Pages with GitHub Actions as the source:**
   GitHub repo → **Settings** → **Pages** → **Build and deployment** →
   **Source: GitHub Actions**. (No branch selection needed.)
4. **Run the workflow.** It runs automatically on the push to `main`; you can
   also trigger it from the **Actions** tab → *Deploy The Lantern Room to GitHub
   Pages* → **Run workflow**.
5. Wait for the green check, then open the URL shown under
   **Settings → Pages** — typically
   `https://<user>.github.io/<repo>/`.

The workflow runs `npm ci`, `npm run build`, uploads `dist/` as the Pages
artifact, and deploys it. It uses `actions/upload-pages-artifact` +
`actions/deploy-pages`, so no `gh-pages` branch is required.

### If the page shows a 404 after deploying

- Confirm **Settings → Pages → Source** is **GitHub Actions** (not a branch).
- Confirm the workflow run completed successfully (Actions tab).
- GitHub Pages takes 1–2 minutes to propagate after the first deploy.
- A project site lives under `/<repo>/`; the `./` base in `vite.config.ts` means
  assets resolve correctly there. If you ever add an absolute base, use
  `base: '/<repo>/'` instead (never `'/'` for project sites).

---

## 2. Option B: manual `gh-pages` branch

If you prefer not to run Actions:

```bash
npm run build
npx gh-pages -d dist        # publishes dist/ to the gh-pages branch
```

(Or, without `gh-pages`: )
```bash
npm run build
git subtree push --prefix dist origin gh-pages
```

Then: repo **Settings → Pages → Build and deployment → Source: Deploy from a
branch** → Branch: **gh-pages** → Folder: **/ (root)** → **Save**. The site
appears at `https://<user>.github.io/<repo>/` after a minute or two.

---

## 3. Verify the deployment (before submitting)

From a terminal:

```bash
curl -I https://<user>.github.io/<repo>/
# expect HTTP/2 200 and content-type: text/html
```

Then open the URL in **desktop Chrome**:

- The room should render (a dark observatory, a table, a lantern, one hint line).
- Because this build injects IWER on desktop browsers, an **Enter XR** button
  appears; clicking it enters an emulated Quest session so the hosted link can be
  tested without a headset. This is how judges without a headset can try it.
- The page must be served over **HTTPS** — WebXR requires a secure context
  (localhost is the only exception).

---

## 4. Test on a Meta Quest (what the video needs)

1. Put the headset on, make sure **hand tracking is enabled** in
   Settings → Movement Tracking → Hands and Body Tracking, and that the headset
   is on the same Wi-Fi network if you are testing a network URL.
2. Open the **Meta Quest Browser** and go to
   `https://<user>.github.io/<repo>/`.
3. Press **Enter VR** (the in-page button; the browser may also show its own XR
   prompt). Native WebXR is used — the desktop emulator is skipped on Quest
   Browser by user-agent.
4. Put the controllers down to play with hands (pinch to grab). If hands are not
   tracked, pick the controllers up and use grip/trigger; the same interactions
   work.
5. Complete the session (~3–5 minutes), then double-check the accessibility
   settings board (contrast / gentle motion / gaze assist).

### Remote debugging console on Quest (chrome://inspect)

Desktop Chrome can inspect the Quest Browser tab over USB/ADB:

1. Enable **Developer Mode** on the headset (Meta Horizon app → Devices →
   Developer Mode) and connect it to the computer with USB; accept the USB
   debugging prompt inside the headset.
2. Confirm the device is visible:
   ```bash
   adb devices
   ```
3. Forward the browser's DevTools socket:
   ```bash
   adb forward tcp:9222 localabstract:chrome_devtools_remote
   ```
4. In desktop Chrome open `chrome://inspect/#devices` →
   **Configure…** → add `localhost:9222` → the open Quest Browser tab should
   appear under *Remote Target* → click **inspect** to see console logs,
   network activity and errors live while the headset runs the app.
5. `chrome://inspect` also lets you capture a screenshot of the remote page for
   quick visual checks (the authoritative video capture is the headset's own
   recorder, see `SUBMISSION.md`).

> If `adb` is not installed: it ships with the Android platform tools, and also
> with Meta Quest Developer Hub (a GUI that surfaces the same remote-target
> workflow).

---

## 5. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Blank page, console shows failed asset paths | Wrong `base`. Keep `base: './'` in `vite.config.ts`, or set it to `/<repo>/` for project pages. |
| "Enter XR" missing on desktop | IWER is only injected in the production build (configured in `iwsdk.config.json` → `dev.emulator.injectOnBuild`) and skipped for the OculusBrowser user-agent. Re-run `npm run build` and redeploy. |
| Enter VR fails on Quest | The page must be **HTTPS**; also check the headset has WebXR/hand-tracking available and the browser is updated. |
| 404 on a sub-path or after refresh | Pages only serves files that exist; this is a single-page app with no client routes, so deep links are not expected. |
| Old version still served | GitHub Pages/CDN caching; wait a minute, or hard-refresh. Ensure the submission-time build is the one deployed. |
| Actions workflow fails on `npm ci` | Commit `package-lock.json` (it is included in this project) and use Node 20.19+/22.12+ in the workflow (the included one pins Node 22). |

---

## 6. After submitting

- Do **not** delete the repository or Pages site; it must stay reachable until
  the winner announcement (on or around 2026-12-11).
- Keep the deployed build frozen: no edits to the hosted content after the
  entry period ends (no changes are allowed after 2026-11-18 12:00 noon PT).
- If the URL changes for any reason, that invalidates the submission — deploy
  once, early, and keep it stable.
