# Devpost submission setup — Meta VR Start Developer Competition 2026

**Your submission URL:** https://devpost.com/submit-to/31024-meta-vr-start-developer-competition-2026/manage/submissions
**Competition page:** https://start-developer-competition-26.devpost.com/ · **Deadline: 2026-11-18 12:00 pm Pacific / 3:00 pm Eastern**.
**Prizes:** $1,000,000 total — per-track winner **$70,000** / runner-up **$35,000** (Entertainment, Gaming, Productivity) + **$25,000 special awards**: Best Social & Multiplayer, Best Agentic Interaction, Best Reason to Come Back, **Best First Five Minutes**, Best Accessibility Forward, Boldest Original Concept, Judge's Choice (2).

## ⚠️ Read this first: the competition is eligibility-gated
The official rules open the contest **only to members of the Meta VR Start program** and require an **active Meta account with Developer Access** at submission time. **Joining on Devpost is not enough.**

- Apply to Meta VR Start now (rolling review, so the sooner the better): **https://developers.meta.com/horizon/programs/start/apply/**
- Enable Developer Access on your Meta developer account: https://developers.meta.com/
- If your membership is not approved before **Nov 18**, this entry cannot be submitted — treat this as lower priority than the other contests until you're confirmed.

## GitHub + hosted build — DONE ✅
- Public repository: **https://github.com/bgrubbs1/lantern-room-meta-vr** — full IWSDK source, `README.md` project page, `SUBMISSION.md` paste-ready Devpost copy, `RULES-NOTES.md` (verbatim rules), `DEPLOY.md`, MIT `LICENSE`, 4 genuine screenshots.
- **Hosted WebXR link (this is what judges open):** **https://bgrubbs1.github.io/lantern-room-meta-vr/** — live now (GitHub Pages, built output committed in `/docs`; IWER emulation is included in production so judges can click "Enter XR" even without a headset).
- Verified locally: `npm run typecheck` exit 0 · `npm test` **29/29 pass** · `npm run build` exit 0 (6.1 MB static) · production preview boots and IWER Enter XR works. Quest on-device behavior is marked UNVERIFIED in the repo (see below).

## What the rules require (verified from the official rules, 2026-10-27)
- A **VR/MR application built for Meta VR devices**; **hands-first implementation** (all tracks); WebXR/IWSDK entries submit as a **hosted link** (GitHub Pages or other hosting) — no APK needed.
- **Demonstration video < 3:00** showing the project as viewed on a **Meta Quest or XR Simulator/emulator**, uploaded **publicly** to YouTube or Vimeo with the link on the Devpost form.
- **Text description** covering inspiration, how it was built, future plans, and a **target launch date**.
- Select **Track** and **Division**. This entry: **Track = Gaming**, **Division = New Experience** (built entirely inside the competition window; no pre-existing code).
- Judges then score Innovation & Creativity, Experience Design, etc. (equally weighted).
- The hosted project must remain available **until the winner announcement (~2026-12-11)**.

## Devpost form values (paste-ready in `SUBMISSION.md`)
| Field | Value |
|---|---|
| Project name | `The Lantern Room` |
| Elevator pitch (148/200 chars) | `Five minutes, three hand-built mechanisms, one sleeping lantern: a seated hands-first VR puzzle for Meta Quest, built with Meta's Immersive Web SDK.` |
| Track | `Gaming` |
| Division | `New Experience` |
| Target launch date | `2027-02-19` |
| Hosted project link | `https://bgrubbs1.github.io/lantern-room-meta-vr/` |
| Demo video | your public YouTube/Vimeo URL (must be <3:00) |
| Repository (optional) | `https://github.com/bgrubbs1/lantern-room-meta-vr` |
| Screenshots | `screenshots/lantern-room-desktop.png`, `lantern-room-high-contrast.png`, `lantern-room-finale.png`, `xr-emulator.png` |
| Built with | `meta-quest, immersive-web-sdk, iwsdk, webxr, three.js, typescript, vite, vitest, webaudio, procedural` |
| Description | paste the sections from `SUBMISSION.md` §2 (Inspiration / What it does / How we built it / Challenges / Accomplishments / What we learned / What's next + target launch date) |

## Your remaining steps (~2¼–3½ hours, deadline Nov 18)
1. **Meta developer account + Developer Access** (10–20 min) → apply to **Meta VR Start** (10–20 min, rolling review — do this immediately).
2. **Test the hosted link on your Quest** (15–30 min): open https://bgrubbs1.github.io/lantern-room-meta-vr/ in **Meta Quest Browser** → Enter XR → test hand pinch/grab/drag on all three mechanisms, controllers, and the settings board (high-contrast, gentle motion, gaze Assist); verify audio resumes after entering XR. Remote-debug via `chrome://inspect` if needed (steps in `DEPLOY.md`).
3. **Record the <3:00 demo** (45–90 min) following `SUBMISSION.md` §3 — Quest capture preferred; the IWER emulator is allowed by the rules ("XR Simulator or another equivalent emulator"). Show: first 30 s of learning, each mechanism being solved with hands, the finale, and a short "how it was built with IWSDK" beat.
4. **Upload to YouTube/Vimeo, Public** (10 min), verify in a private window.
5. **Devpost submit** (20–30 min): open your manage URL → join/create project → paste fields, hosted link, video, screenshots, track/division → submit. Keep the Pages site live until winners are announced.

## Unverified items (honest list; also in repo README/SUBMISSION)
Hand-tracking pinch/grab radii and dial sensitivity on real Quest hardware; 60 fps on Quest; WebAudio autoplay/resume after entering XR on Quest Browser; comfort across a full 5-minute seated session; on-device console cleanliness. Do one on-device pass before recording the video; if anything feels off, paste the details and I'll tune it.

## If GitHub Pages needs a rebuild later
The site is served from the committed `/docs` folder (Pages source: `main` /docs). Rebuild with:
```bash
npm run build && rm -rf docs && cp -r dist docs && git add docs && git commit -m "Deploy: refresh static build" && git push
```
