# Roadmap

This document defines what LockedIn is building now (MVP) and what it is
explicitly not building yet. The "not now" section exists so that future
features are never used to justify scope creep in the MVP, while also making
sure MVP architecture doesn't quietly foreclose them.

## MVP Scope (Building Now)

LockedIn's MVP is a single-purpose tool: **LeetCode email automation**. A user
sets up a study roadmap once, and the product nags them daily via email until
they finish it. Nothing else.

### Features

1. **Sign in** — user authenticates to access their roadmap(s).
2. **Create roadmap** — user creates a roadmap: a named, time-boxed plan to
   work through a set of problems.
3. **Upload questions** — user uploads/curates the list of LeetCode problems
   that make up the roadmap.
4. **Configure roadmap** — name, start date, end date, and daily email
   send-time.
5. **Daily email** — an automated email per roadmap per day, containing:
   - problem title
   - link to the problem
   - difficulty
   - progress (e.g. problems completed / total, days elapsed / total)
   - a quote
6. **View progress** — user can see roadmap progress in-app.
7. **Mark complete** — user can mark a problem as solved.

That's the full MVP. No AI, no gamification, no multi-channel notifications,
no analytics.

## Future Vision — Not Building Now

The following are real product directions, deliberately deferred. They are
listed here so the architecture built for the MVP does not have to be
rewritten to accommodate them later.

- **AI-generated roadmaps** — generate the problem list/order from a prompt
  instead of manual upload.
- **Missions** — smaller sub-goals within or across roadmaps.
- **XP / levels** — gamified progression layer on top of completion.
- **Additional notification channels** — WhatsApp, push notifications,
  Twitter/X, alongside or instead of email.
- **Analytics** — aggregate/personal insight into study patterns, streaks,
  problem-type breakdowns, etc.
- **Habits beyond LeetCode** — generalizing the roadmap/reminder engine to
  arbitrary habits, not just coding problems.

### Architecture must support this — constraints on the MVP build

None of the above is being built now, but the MVP's data model and interfaces
must not assume they'll never exist:

- **Problem entity stays generic.** Model it as "an item with a title, a
  link, a difficulty, and a completion state" rather than baking in
  LeetCode-specific fields, so a future AI-generation path or non-LeetCode
  habit can populate the same shape.
- **Notification delivery is channel-agnostic at the boundary.** Even though
  only email ships in the MVP, the code that decides *what* to send and *when*
  should not be entangled with the code that decides *how* (email vs.
  WhatsApp vs. push). One channel today, but the seam should already exist.
- **Roadmap creation is pluggable.** "Upload questions" is one way to
  populate a roadmap; it should not be wired so tightly into the roadmap
  model that "AI generates the list instead" requires a schema rewrite.
- **Progress is a first-class, extensible concept.** Track completion in a
  way that a future XP/level/mission layer can be computed from or attached
  to, without needing to re-derive history retroactively.

These are constraints on shape, not commitments to build anything early —
the MVP still ships only the seven features above.
