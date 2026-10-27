# SUBMISSION — paste-ready Devpost copy

Meta VR Start Developer Competition 2026 · **The Lantern Room**

Everything below is written to be copied into the Devpost submission form. Items
marked **[FILL IN]** are user-supplied values (URLs, YouTube link) — no personal
details are stored in this repository.

---

## 1. Form fields (copy/paste)

| Devpost field | Value |
| --- | --- |
| **Project name** | The Lantern Room |
| **Elevator pitch (≤200 chars)** | `Five minutes, three hand-built mechanisms, one sleeping lantern: a seated hands-first VR puzzle for Meta Quest, built with Meta's Immersive Web SDK.` (148 characters) |
| **Track** | **Gaming** |
| **Division** | **New Experience** |
| **Target launch date** | **2027-02-19** (Meta Horizon Store / Quest app submission) |
| **Hosted project link** | **[FILL IN]** `https://<github-username>.github.io/the-lantern-room/` (see `DEPLOY.md`) |
| **Demo video (public YouTube/Vimeo)** | **[FILL IN]** `https://www.youtube.com/watch?v=…` — must be **Public**, under 3:00 |
| **Project repository** (optional) | **[FILL IN]** GitHub repository URL |
| **Screenshots** | `screenshots/lantern-room-desktop.png`, `screenshots/lantern-room-high-contrast.png`, `screenshots/lantern-room-finale.png`, `screenshots/xr-emulator.png` |
| **Built with tags** | `meta-quest`, `immersive-web-sdk`, `iwsdk`, `webxr`, `three.js`, `typescript`, `vite`, `vitest`, `webaudio`, `procedural` |

Built-with description (one line, for the tags panel):

> Meta Immersive Web SDK (IWSDK) · WebXR · Three.js · TypeScript · Vite · Vitest · WebAudio · procedural geometry and materials

---

## 2. Description — paste-ready sections

The rules require inspiration, how it was built, future plans and a target launch
date; the sections below match the Devpost description guidance and the README.

### Inspiration

The "Best First Five Minutes" brief asks for an opening that teaches itself. The
most memorable first minutes in a headset are usually quiet ones: you look at
something small, reach for it, and it responds. The Lantern Room is built around
that moment. There is no menu and no locomotion — just a warm observatory table
at night, a locked lantern, and three physical objects that are obviously
touchable. There is exactly one line of text. Everything else is taught by
reaction: a rune notch, a glint, a chime, a third of the lantern lighting up.
The fantasy is an astronomer's table at the end of a night watch: solve three
small hands-on rituals and the lantern wakes, releasing a swarm of fireflies.

### What it does

A complete seated session is roughly 3–5 minutes — the length of a bus stop.
Three hands-first mechanisms each unlock a third of the lantern:

1. **Constellation dial** — pinch one of three concentric rings and twist your
   wrist to rotate it until its notch lines up with an engraved star line. Each
   ring snaps into place with a chime.
2. **Hidden drawer** — pinch the brass drawer knob and pull it toward you, then
   pinch the hidden bolt inside and slide it sideways.
3. **Orrery** — pinch the small coloured planets and place each into its matching
   orbit cradle. Correct placements lock in; wrong ones bounce home.

When all three are solved the lantern opens: the petals swing out, the cap rises,
fireflies burst into the room, and a soft finale plays. Pinch the lantern
afterwards to restart without leaving the session.

**Controls:** pinch/grab/drag/rotate with hand tracking is primary; controllers
work as an optional fallback; on desktop the hosted build includes the IWER
emulator so you can test with mouse and keyboard. No controller pairing is
required at any point.

**Accessibility & comfort:** high-contrast palette, gentle-motion mode,
gaze-dwell Assist so every mechanism can be advanced eyes-only, keyboard
shortcuts (C/G/A/R) for desktop testing, and seated-only interaction inside a
two-foot reach bubble. One short hint line instead of any text walls.

### How we built it

The project is a Vite + TypeScript WebXR app built with **Meta's Immersive Web
SDK (IWSDK)**, which provides the ECS, WebXR session lifecycle, hand tracking,
the near-grab system and IWER (its in-browser XR emulator).

The experience is **100% procedural**: every surface is generated from Three.js
primitives, every material is created in code, all lettering is drawn into an
HTML canvas at runtime, and every sound is synthesised with WebAudio. The
production build contains no models, textures, fonts, or audio files, makes no
runtime network calls, and uses no CDNs — it is a single static bundle.

Internally it is split into a **pure, unit-tested puzzle model**
(`src/puzzle/state.ts`) and a thin 3D view (`src/scene/`). The view reads IWSDK's
`Grabbed` ECS tag each frame and mirrors the hand-driven transform into the state
machine, then applies game rules (snap, lock, reject, celebrate). Hand
interactions use the SDK's built-in `OneHandGrabbable` constraints: the dial
rings rotate only around Y, the drawer slides only on Z, the bolt slides only on
X, and planets move in a bounded 3D box. The grab system routes hand pinches
through the same pointer pipeline as controllers, so hands are the primary input
and controllers work as a fallback with no extra code.

Verification performed before submission: `npm test` (29 Vitest unit tests),
`npm run typecheck`, `npm run build`, the dev server, the production bundle
served by `vite preview`, and headless-Chrome screenshots of the real build
(including an emulated XR session). On-device Quest testing is the entrant's
job before recording the video.

### Challenges

- **Verifying IWSDK behaviour from the installed package.** Grab constraints are
  absolute values in the target's parent space, not deltas. A naive drawer
  constraint would teleport the drawer to the room origin on the first grab, so
  the constraints are written as explicit absolute boxes (documented in
  `src/scene/build.ts`), and the dial reads its angle back from the rotated
  object each frame because the grab system owns the transform.
- **Restricted build environment.** The sandbox blocked writes to `~/.npm`,
  blocked `ps` (used by the SDK dev plugin's workspace lock), and could not
  download Playwright. The project ships a sandbox-safe dev launcher and a
  DevTools-protocol screenshot script so everything could still be verified.
- **Keeping it at 60 fps.** No post-processing, a small shared material set,
  preallocated particle buffers, and animation written directly into typed arrays
  to stay allocation-free per frame.
- **No headset available.** All pre-submission verification is browser/emulator
  level and every on-device claim is marked UNVERIFIED rather than assumed.

### Accomplishments

- A complete hands-first experience from cold start to finale and soft restart,
  with three genuinely distinct physical interactions and no controller needed.
- A fully procedural art direction — warm/cool observatory lighting, star dome,
  dust motes, constellation inlay, firefly finale — with zero external assets and
  no network calls.
- Accessibility designed in: high-contrast palette, gentle motion, gaze-dwell
  assist for every mechanism, and keyboard equivalents.
- The entire puzzle logic is covered by 29 unit tests, including the eyes-only
  assist path that can complete the whole experience without hands.

### What we learned

- The grab system *is* the product: believable manipulation comes from
  constraints and feedback (snap windows, chimes, light), not from more geometry.
- Affordance beats onboarding: making the target visible replaced almost every
  instruction we would otherwise have written.
- A tested puzzle model is a design tool — being able to "play" the whole
  experience in unit tests caught logic issues before headset debugging.
- Verify fast-moving XR SDKs against the installed types and source, not just
  documentation.

### What's next

**Target launch date: 2027-02-19** (Meta Horizon Store, Quest app submission;
the same WebXR build can also ship as a hosted app).

1. On-device hand-tuning: pinch grab radii, snap windows, dial sensitivity, and a
   measured 60 fps check on Quest hardware.
2. A short "night watch" progression: several small observatory tables with
   different mechanism sets, carrying the lantern's light between them.
3. Accessibility depth: voice-over narration for the hint line, a one-switch
   mode, and colour-blind-safe planet markings (shape as well as hue).
4. An optional mixed-reality mode that anchors the table to the player's real
   table using scene understanding/passthrough.
5. Richer spatial audio: contact sounds for pinch ticks and drawer rollers.

### Testing instructions for judges

1. Open the hosted link in **Meta Quest Browser** and press **Enter VR** (or the
   in-page Enter XR prompt). Put your controllers down to use hand tracking, or
   grip the controllers for controller input.
2. If you are judging from a desktop browser without a headset: the build
   includes IWER on desktop, so click **Enter XR** and use mouse/keyboard to
   emulate a Quest. Click and drag to manipulate objects; the IWER controller
   panels show trigger/grip simulation.
3. Everything is seated and reachable: pinch a dial ring and twist; pinch the
   drawer knob and pull; pinch the bolt inside and slide; pinch and place the
   three planets into their cradles.
4. Accessibility: use the settings board on the table (or keys `C` contrast,
   `G` gentle motion, `A` gaze assist, `R` restart) to try the high-contrast,
   gentle-motion, and gaze-dwell Assist modes.
5. The session is 3–5 minutes; the full payoff is the lantern opening.

---

## 3. Demo video script (<3:00, real footage only)

Rules: the video must be **under three minutes**, show footage of the project as
viewed on a **Meta Quest device or via XR Simulator / an equivalent emulator**,
be **publicly visible on YouTube or Vimeo**, and must not rely on AI-generated
video. Show real gameplay that honestly represents the experience; lead with the
story and what makes it distinct. Judges are not required to watch beyond 3:00.

**Format:** 1920×1080 (or native Quest capture), 60 fps if possible, H.264 MP4.
Record the headset view; optionally add a small real-world hand-tracking inset
only if it honestly matches what the app shows. Captions only — no wall of text.

| Time | Picture | Action / gesture | Audio / caption |
| --- | --- | --- | --- |
| 0:00–0:15 | Cold open: the dark observatory, star dome, warm lantern, single hint line. Camera slowly looks down to the table. | Player seated, no UI. | Room tone + low pad. Caption: **"The Lantern Room — a seated hands-first VR puzzle"** |
| 0:15–0:35 | Close-up: the constellation dial. Three rings with glowing rune notches and three engraved star lines inlaid in the wood. | Hand enters frame; **pinch the Ember ring**, twist wrist; ring rotates; **snap + chime**; rune line locks. Repeat for the second ring. | Chime, with a caption: **"Pinch. Twist. Snap."** |
| 0:35–0:55 | Pull back slightly; third ring aligns; the dial's arc lights and one third of the lantern brightens. | **Pinch and twist** the third ring; the last chime. | Success arpeggio. Caption: **"Each mechanism lights a third of the lantern."** |
| 0:55–1:20 | The drawer: brass knob on the table's front edge. | **Pinch the knob and pull** toward the chest; the drawer slides open; reveal the glowing bolt. Then **pinch the bolt and slide it sideways**. | Wood thunk, metal click. Caption: **"Open. Find the hidden bolt."** |
| 1:20–1:45 | The orrery: three coloured planets, three empty orbit cradles above a small brass sun. | **Pinch a planet**, lift, **place** it into the matching cradle (chime). Do the second and third; note a wrong-slot attempt bouncing back (0.5 s) to show honest feedback. | Chimes; soft error thud on the wrong slot. Caption: **"Every world in its orbit."** |
| 1:45–2:20 | The finale: the three base gems glow, lantern petals swing open, cap rises, fireflies burst into the room. Hold on the reveal. | Player lowers hands; then **pinches the lantern** to restart. | Finale shimmer; the pad swells. Caption: **"Wake the lantern."** |
| 2:20–2:40 | Accessibility: settings board; toggle **CONTRAST** (room switches to high-contrast palette), toggle **GENTLE** (particles calm), toggle **GAZE**; look at a mechanism and let the dwell reticle advance it one step. | **Pinch the toggles**, then gaze-dwell at a mechanism. | Click; caption: **"High contrast, gentle motion, eyes-only Assist."** |
| 2:40–2:55 | End card on the same room shot. | — | Caption: **The Lantern Room · Gaming — New Experience** · **Target launch: 2027-02-19** · **Built with Meta Immersive Web SDK** |

**Recording options (pick one, record at least two takes):**

- **Meta Quest (preferred — satisfies the rules directly):** put the headset on,
  open the hosted link in Quest Browser, press Enter VR, then use the headset's
  built-in capture (Meta button → **Capture** → **Record**) to record the VR view
  with microphone narration if wanted. Alternatively `adb shell screenrecord
  --time-limit 180 /sdcard/lantern.mp4` followed by `adb pull
  /sdcard/lantern.mp4` while the app runs in the headset.
- **Emulator (allowed: "XR Simulator or another equivalent emulator"):** on
  desktop Chrome open the hosted link (or `npm run dev`), click **Enter XR** to
  enter IWER's emulated Quest, then screen-record the browser window (macOS
  `Cmd+Shift+5`, Windows `Win+Alt+R`, or OBS). Drive interactions with the IWER
  controller panels (mouse) to perform pinch/pull/place gestures.
- **Editing:** trim to ≤2:55, keep real-time gesture footage, do not speed up the
  finale. Export 1080p, upload as **Public** to YouTube, and put the URL in the
  Devpost form.

**Compliance checks for the video:** under 3:00 · recorded from Quest or an
equivalent emulator · shows real gameplay (no AI-generated footage) · English
captions/narration · no third-party logos, music, or brand names · does not
depict any identifiable person other than the entrant.

---

## 4. User-only checklist (accounts & actions this build cannot do)

Estimated total: **about 2½–3½ hours**, spread across several days because
Meta VR Start membership review is rolling. **Start item 2 today.**

| # | Step | Minutes | Notes |
| --- | --- | --- | --- |
| 1 | **Meta developer account + Developer Access.** Go to <https://developers.meta.com/>, create/log in to the account, and enable **Developer Access** for the organisation. | 10–20 | Required by rule 2(c): "have an active and valid Meta account with Developer Access enabled … by the time of submission". |
| 2 | **Apply to the Meta VR Start Program.** <https://developers.meta.com/horizon/programs/start/apply/> | 10–20 to apply; review is rolling — **do it immediately** | Required by rule 2(d): the submitting representative "must be a member of the Meta VR Start Program by the time of submission". Membership review is rolling, so apply first and work on everything else while it is reviewed. **Joining the Devpost hackathon is NOT sufficient** — the program membership is separate. |
| 3 | **Deploy the hosted link.** Follow `DEPLOY.md` (GitHub Pages, ~10–15 min) and put the final URL in the Devpost form. | 10–15 | Required for IWSDK/WebXR entries. Keep the site live and unchanged until the winner announcement (on or around 2026-12-11). |
| 4 | **Test on a Meta Quest.** Open the hosted link in **Quest Browser**, press Enter VR, put the controllers down, and complete the whole experience with hands. Re-test with controllers, and check the three accessibility toggle paths. | 15–30 | This is the on-device pass the builder could not do. Note any grab/snap tuning issues and re-deploy (before the deadline). Also open `chrome://inspect` on desktop with the headset connected to check console errors (see `DEPLOY.md`). |
| 5 | **Record the demo video** following the script in §3 (Quest capture preferred; emulator capture allowed). Take at least two takes. | 45–90 | <3:00 hard limit; real footage; English. |
| 6 | **Upload the video publicly to YouTube** (or Vimeo), set visibility **Public**, copy the URL. | 10 | Judges must be able to watch it; unlisted is risky. |
| 7 | **Join the Devpost hackathon and submit.** Click **Join hackathon** on <https://start-developer-competition-26.devpost.com/>, then **Enter a submission**: name, pitch, description (paste §2), Track **Gaming**, Division **New Experience**, hosted link, video URL, screenshots, built-with tags, target launch date **2027-02-19**. Review everything and submit. | 20–30 | Must be completed before **2026-11-18 12:00 noon PT**. After the entry period no changes are allowed; keep the hosted link up. |

**Pre-submit sanity checks**

- [ ] Meta VR Start membership approved (item 2) and Developer Access enabled (item 1).
- [ ] Hosted link opens over **HTTPS** and boots on both desktop Chrome and Quest Browser.
- [ ] The hosted link is the **production build** (`npm run build`), not a dev server.
- [ ] Video is **<3:00**, public, and shows real Quest/emulator gameplay.
- [ ] Description contains inspiration, how it was built, future plans, **target launch date 2027-02-19**.
- [ ] Track **Gaming**, Division **New Experience** selected.
- [ ] No PII other than the entrant's own Devpost account; no third-party logos/brands in the screenshots or video.
- [ ] The site stays reachable until the winner announcement (on or around 2026-12-11).

---

## 5. What is verified vs UNVERIFIED (be honest in the submission)

**Verified in the build environment (2026-10-27):**

- `npm test`: 29 Vitest unit tests pass (puzzle rules, progress, reset, assist).
- `npm run typecheck`: passes.
- `npm run build`: succeeds; static `dist/` produced; production bundle boots when served.
- `npm run dev`: starts and serves the app (Vite + IWSDK dev server, IWER injected).
- IWER **Enter XR** works in both the dev server and the production preview; an
  emulated XR session was entered and captured.
- Screenshots in `screenshots/` are genuine captures of the built app.
- Audio synthesises in-browser without asset files (functional smoke-level check).

**UNVERIFIED — the entrant must confirm on a headset before submitting:**

- Hand tracking, pinch grab radii, dial sensitivity and snap feel on a real Quest.
- Any XR/frame-rate measurement on Quest hardware (target: stable 60 fps).
- Audio autoplay/resume behaviour on Quest Browser after entering XR.
- Comfort over a full 5-minute seated session.
- Emulator captures are from IWER (an "equivalent emulator" under the rules); a
  Quest capture is still the safest video for judging.
