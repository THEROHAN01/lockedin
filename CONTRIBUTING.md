# Contributing

## Commit messages

This repository's commit history is documentation. `docs/ARCHITECTURE.md` and
`docs/DECISIONS.md` both lead with rationale rather than mechanics, and commit
messages here are written the same way — because the diff already records what
changed, and nothing except the message records why.

### The convention

**Subject line.** Imperative mood, no trailing period, under about 65
characters. State the point of the change rather than the area it touched:

| | |
|---|---|
| yes | `Run the enforced rules in CI, not just on someone's laptop` |
| yes | `Close the double-send hole that release-on-failure opened` |
| yes | `Let Fumadocs style the docs site instead of fighting it` |
| no | `added the swager api openapi interface` |

The last one is a real commit in this history. It is past tense, lowercase,
misspelled, and says nothing a reader could act on — which is the drift this
convention exists to stop.

**No type prefixes.** No `feat:`, `fix:`, or `chore:`. Nothing in this repo
consumes them: there is no changelog generator and no release automation keyed
off them, so they would be ceremony without a reader. If that changes, this is
the place to revisit.

**Body.** Blank line after the subject, then why over what. Cover whichever of
these apply:

- what was wrong, missing, or surprising before the change
- why this approach, over the one a reader would reach for first
- what bit you on the way, and would bite the next person
- anything deliberately left out, and why

Wrap around 72 characters. Where `docs/DECISIONS.md` already holds the
reasoning, cite the ADR rather than restating it — that log is the durable
record, and a message that duplicates it will drift out of step with it.

A body is not mandatory. A genuinely self-evident change does not need one, and
most of this history has one because most changes are not self-evident.

### Using the template

The template lives at [`.gitmessage`](.gitmessage). Git cannot enable it for
you — `commit.template` is local configuration, not something a repository can
set on a clone — so opt in once per clone:

```bash
git config commit.template .gitmessage
```

It then appears as commented guidance in your editor on every `git commit`, and
git strips those lines before saving. Nothing breaks if you skip this step; the
convention above is the thing that matters, and the template is a reminder of
it at the moment you need it.

Note that `git commit -m "..."` bypasses the template entirely, which is fine
for a one-line change and is why the subject-line rule is stated separately
above.

### Not enforced, on purpose

There is no `commit-msg` hook validating any of this. The mechanically checked
rules in this repo (`docs/ARCHITECTURE.md` §8) all guard things that would
otherwise rot silently and that a machine can judge without argument. Message
quality is not that: a regex can confirm a subject is under 65 characters and
imperative-ish, and still pass `Update stuff`. Review is the check here.
