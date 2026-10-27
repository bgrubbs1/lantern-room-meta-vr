# Rules notes — Meta VR Start Developer Competition 2026

Verbatim quotes from the official rules, with links and the date they were
retrieved. Source: <https://start-developer-competition-26.devpost.com/rules>
(retrieved 2026-10-27 with `curl -s -L -A 'Mozilla/5.0'`). Text below is copied
from the page as published; only typographic quotes/spacing have been normalised.

> **How to use this file:** these are the constraints the submission has to
> satisfy. The project in this folder is built against them. The competition
> page and rules are the authority — re-read them before submitting, because
> Devpost pages can be updated.

---

## 1. Eligibility gate (act on this first)

> **THIS CONTEST IS OPEN ONLY TO MEMBERS OF THE META VR START PROGRAM (“START”) THAT MEET THE ELIGIBILITY CRITERIA LISTED BELOW.**

> **INTERNET ACCESS, META VR DEVELOPER ACCOUNT, AND START MEMBERSHIP ARE REQUIRED TO PARTICIPATE.**

> **2. ELIGIBILITY.** Entry and participation in this Contest is open only to individuals, Teams, and Organizations as defined below (each an “Entrant”). As of the start of the Entry Period (as defined above), all Entrants whether as an individual or member of a Team or Organization must:
>
> (a) be at least eighteen years of age and the age of majority in their jurisdiction of residence;
>
> (b) not be residents of, or Organizations domiciled in, Brazil, Quebec, or in any area subject to comprehensive international sanctions such as Crimea, Russia, Cuba, Iran, North Korea, Syria, or any other country or individual designated by the United States Treasury's Office of Foreign Assets Control. For clarity, the foregoing includes any countries where restrictions apply to banking and/or wire transfers;
>
> (c) have an active and valid Meta account with Developer Access enabled or in the case of a Team or Organization member has administrative control over by the time of submission; and
>
> (d) Representative or person submitting an Entry must be a member of the Meta VR Start Program by the time of submission.

> **Entry Limit.** Each individual is limited to submitting one (1) Entry in this Contest.

**Implication for this entry:** the code is ready, but it cannot be submitted
until the human entrant has (1) a Meta developer account with Developer Access
and (2) Meta VR Start Program membership. Those are account actions the build
cannot perform. Start the membership application immediately — review is
rolling and the deadline is 2026-11-18.

---

## 2. What must be built

> **3. HOW TO ENTER.** During the Entry Period, eligible Entrants are invited to build and submit an immersive entertainment, gaming, or productivity experience built for Meta VR devices (each a “Project”).

> **Project:** Include a Project that meets the following requirements.
>
> **App Type & Platform:** The Project must be a VR/MR application built for Meta VR devices

---

## 3. Track definitions (this entry: Gaming)

> **Track:** Must align with at least one of the following tracks (each a “Track”). At any time, and at its sole discretion, the Sponsor will have the ability to re-assign a submitted Entry from one Track to another.

> **Entertainment:** Lean-back media and content experiences—spatial cinema, interactive video, music visualization, immersive storytelling, spatial audio, media companion apps (e.g., commentary tracks, popup production notes, social comments). Content designed to be consumed in any environment. Content designed to be consumed in any environment. Hands-first implementation required.

> **Gaming:** Games designed for hands-first (required) or eyes and hands. Puzzle, strategy, casual, social, narrative—genres that thrive seated, without controllers.

> **Productivity:** Apps that make you more effective anywhere or are designed around specific daily moments—multi-panel workspaces, task management, creative tools, or habits tied to a recurring context (morning routine, commute, wind-down). Hands-first implementation required.

---

## 4. Division definitions (this entry: New Experience)

> **Division:** Projects must align with one of the following divisions (each a “Division”). At any time, and at its sole discretion, the Sponsor will have the ability to re-assign a submitted Entry from one Division to another.

> **New Experience:** Project is conceived of and built within the competition window (starting September 24, 2026). No pre-existing codebases, no shipped titles, no early access builds repurposed

> **Adapted / Significantly Updated Experience:** Pre-existing project with a meaningful new feature, mode, or platform integration shipped during the competition window. Any build, prototype, or published app that existed prior to September 24, 2026. Sponsor will determine in its own discretion if an update qualifies as significant.

**This project:** New Experience. The code in this folder was written for this
competition, after 2026-09-24; it contains no pre-existing codebase and is not a
repurposed build.

---

## 5. Hands-first requirement (required for Gaming)

> **Content Experience Requirements & Guidelines:** These requirements and guidelines are applicable across all Tracks and Divisions.
>
> **Requirement: Hands-first** — Fully usable with hands end-to-end. Controller support optional.
>
> **The Test: Can someone complete the entire experience without ever pairing a controller?**

> **Guideline: Seated-optimized** — Designed for seated/stationary use. Limit roomscale or large physical movement.
>
> **The Test: The “airplane seat test”—does every interaction work in a 2ft radius?**

> **Guideline: Easy to get into/out of** — Fast cold start. Clean pause/resume. Satisfying in ≤10 minutes.
>
> **The Test: The “one bus stop test”—can someone have a complete moment in a short ride?**

> **Guideline: Original, not a wrapper** — Core experience is Entrant-built. Thin wrappers around existing platforms or services (YouTube, ChatGPT, etc.) are highly discouraged.
>
> **The Test: The "take it away test" — remove the third-party service. Is there still a Project?**

**How this entry satisfies it:** all three mechanisms are manipulated with
pinch/grab hand tracking; no controller is needed at any point; the player never
moves (seated, table-scale, all interactions inside a ~2 ft reach bubble); the
whole arc is ~3–5 minutes. It is original code with no third-party service or
content dependency, and no runtime network calls.

---

## 6. Submission format (WebXR / IWSDK link)

> **Submission:** Project must be submitted during the Entry Period and remain available until the Winner Announcement in one of the following ways:
>
> **For apps built with Unity, Unreal, Godot, Native/Android or another engine:** An APK uploaded to the Meta VR Developer Dashboard under a new release channel named “Competition”.
>
> **For apps built with IWSDK (WebXR):** A link will be required for judges to access and test your application. See "Deploying to GitHub Pages" for additional details. You may also use your preferred hosting solution (e.g., Vercel, Digital Ocean, AWS, Azure, etc).
>
> All required items must be added to the Submission of the Project on Devpost which includes, but is not limited to:
>
> **Demonstration video** of your Project that should be less than three (3) minutes and showcase footage of your Project as viewed on a Meta Quest device or via XR Simulator or another equivalent emulator. The video must be uploaded to and made publicly visible on YouTube or Vimeo and a link to the video must be provided on the submission form on the Competition website. Judges are not required to watch beyond three minutes.
>
> **A text description** that explains your inspiration, how you built it, future plans for improvement and a target launch date, if not already published to the Meta VR Store. If your Project is an Adapted / Significantly Updated Experience (as described above), Entry should include a summary description of the new features/capabilities added to the application. Screenshots, changelogs and/or demo videos are highly recommended.
>
> **Select the Track** you are submitting your Project into: Entertainment, Gaming, or Productivity.
>
> **Select the Division** you are submitting your Project into: New Experience or Adapted / Significantly Updated Experience.

> **Projects must be made available free of charge and with sufficient access until the Winner Announcement to enable viewing, evaluation, use, and testing by Sponsor and Judges (as defined below).**

> **Language.** Projects must be entirely in the English language or include English subtitles. All Entry materials must be in English or, if not in English, the Entrant must provide an English translation of the demonstration video, text description, and testing instructions as well as all other materials submitted.

**This project:** WebXR built with IWSDK, so the entry is a hosted link
(GitHub Pages — see `DEPLOY.md`). The production bundle injects IWER on desktop
browsers so a judge without a headset can click **Enter XR** and test with mouse
and keyboard; Quest Browser skips the emulator and uses native WebXR.

---

## 7. Originality and content constraints

> **Originality:** The Project must be ORIGINAL to each Entrant (or include content that is in the public domain or that is provided to Entrant by Meta specifically for use in the Contest).

> **Meta Funding:** The Project must not have previously received or currently be receiving direct funding from Sponsor under a separate agreement (e.g., Meta Horizon Start Lifestyle RFP or other development funding from Sponsor).

> **Permitted Development Tools:** The Project must be built using development tools, SDKs, and resources that are available to the general public and/or to Start Program members. Use of Meta tools, SDKs, or features that have not been released to the Start Program or the general public is not permitted.

> If a Project uses or relies upon any third-party tools, code, or assets, the participant must be authorized to use them in accordance with any terms and conditions or licensing requirements of the tools, code, or assets.

> **Projects must not contain any commercial or corporate advertising (including, without limitation, corporate logos, brand names, and slogans), recognizable branded products, or commercial artwork.**

**This project:** all geometry, materials, lettering and audio are generated by
this repository's own MIT-licensed TypeScript. The only third-party code is the
public MIT-licensed IWSDK/Three.js/Vite ecosystem (see `LICENSE`). No external
art, fonts, audio, trademarks, or runtime network calls.

---

## 8. Deadlines and dates

> **Entry period:** September 24, 2026 at 10:00:00 AM PT — November 18, 2026 at 12:00:00 PM PT

> **Judging period:** On or around November 18, 2026 — On or around December 9, 2026

> **Winner Announcement:** On or around December 11, 2026

The competition page header also states: **“Deadline: Nov 18, 2026 @ 12:00pm PST”**.
Both the rules table (PT) and page header (PST) point at the same wall-clock time
on 2026-11-18. Treat **2026-11-18 12:00 noon Pacific** as the hard deadline and
submit at least 24 hours early.

> **Once the Entry Period has ended, you may not make changes or alterations to your submission. The judging process will be based on the state of the Entry at the time of submission deadline. Entries must be capable of successful and consistent operation and function.**

**Implication:** the hosted link must stay up and unchanged until the winner
announcement (on or around 2026-12-11). Do not delete the GitHub Pages site or
repository after submitting.

---

## 9. Judging criteria (for prioritising polish)

> **Stage One:** The first stage will determine via pass/fail whether the Projects meet a baseline level of viability, in that the Project and Entry reasonably fits the theme and reasonably applies the required tools and features featured in the Contest.
>
> **Stage Two:** All Entries that pass Stage One will be evaluated in Stage Two based on the below equally weighted criteria (the “Judging Criteria”).

| Criterion (25% each) | Verbatim description |
| --- | --- |
| Innovation & Creativity | “Measures originality, creative ambition, and relevance to the chosen track (Gaming, Entertainment, or Productivity). High-scoring projects differentiate themselves, show developer ingenuity, and uniquely leverage Meta device capabilities (e.g., spatial depth, hands-first design, gaze, passthrough mode, scene understanding, persistent anchors) to drive repeat usage.” |
| Experience Design | “Evaluates design, mechanics, and user journey for the intended audience, with emphasis on seated, hands-first, or context-specific use. Strong entries have intuitive navigation, clear onboarding, and a habit-forming purpose. Passthrough should be purposeful: the player's real room meaningfully changes the experience, not a scene that plays the same with passthrough off. We'll also evaluate FoV-aware design. Since the field of view differs between Meta VR devices, keep essential UI and interactions within a comfortable, narrower FoV and adapt across devices.” |
| Technical Implementation | “Assesses technical expertise, reliability, and strategic use of platform tools, particularly the features that define hands-first experiences: gaze interactions (Unity/Unreal ISDK v207+), hand tracking, passthrough, spatial anchoring, and FoV-aware design. High-scoring entries must be performant on Meta Quest hardware (min 60 fps), solid and bug-free, and show seamless integration of features relevant to their specific track.” |
| Polish & Presentation | “Assesses the overall quality of the project submission, including UI/UX, art direction, and sound design. High-scoring entries are performant, visually cohesive, and clearly demonstrate relevance to the chosen track. This includes high-quality submission materials (text, images, video) that effectively communicate the project's value. On your video/trailer: show real gameplay that honestly represents the experience. Lead with the story and what makes your project distinct. Don't lean on AI-generated video to carry the pitch.” |

**Design targets this implies:** 60 fps minimum on Quest (keep the scene light —
no post-processing, low draw-call count, procedural materials only), console-clean
behaviour, and a demo video of real gameplay (no AI-generated footage).

---

## 10. Special awards targeted by this entry

> **Best First Five Minutes** — “Spotlights the craft of the opening: how fast the experience explains itself, teaches controller-free interaction without a wall of text, and delivers a payoff before the user takes the headset off.”

> **Best Accessibility Forward Experience** — “Pushes the envelope on accessible XR design—voice alternatives for hand interactions, eyes-only navigation for limited mobility, high-contrast modes, or experiences inclusive by default.”

**How this entry targets them:** one short hint line instead of text walls,
affordance-first mechanisms, and a full payoff (firefly reveal + lantern opening)
in about 3–5 minutes; plus a high-contrast palette, a gentle-motion mode, a gaze
dwell “Assist” path so every puzzle step can be completed eyes-only, keyboard
shortcuts for desktop testing, and seated-only design.

---

## 11. Prizes (context only)

> **Best New Gaming Experience / Best Adapted / Significantly Updated Gaming Experience** — 1x Winner, 1x Runner-up — $100,000 / $50,000

> Total ARV of all prizes: Up to $1,000,000 U.S. Dollars (USD)

This build targets **Gaming → New Experience**.

---

## 12. Full rules

Read the complete Official Rules before entering:
<https://start-developer-competition-26.devpost.com/rules>

Competition home: <https://start-developer-competition-26.devpost.com/>
