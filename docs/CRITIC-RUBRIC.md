# Critic Protocol

## Standing rules

1. **Builders never grade their own work.** A critic for system X must not have
   written system X. Critics receive artifacts — screenshots, code, generated
   data — and never the builder's own self-assessment.
2. **Grade artifacts, not intentions.** A design document promising recoil
   depth scores nothing. Read the actual numbers, run the actual capture, look
   at the actual frame.
3. **Be ruthless.** The default posture is that the system loses to its
   reference title, and the builder must prove otherwise. A score of 7 is a
   real criticism, not a pass.
4. **Name the single largest gap.** Every critique ends with one specific,
   actionable, highest-leverage fix. Not a list of ten nice-to-haves.
5. **No score inflation across rounds.** If round 3 scores higher than round 2,
   the artifacts must visibly justify it.

## On "blind side-by-side"

An honest note about method, because it affects how much these scores are worth.

Critics **cannot** view live screenshots of Ready or Not, Tarkov, Ground Branch
or Wildlands inside this environment. What they can do, and what the protocol
requires:

- Grade our real rendered frames and real source code — never a description.
- Compare against a **written specification of the reference title's behaviour**
  in that category, fixed in this document *before* the work is graded, so the
  bar cannot drift to meet whatever we happened to build.
- Judge **blind to authorship**: the critic is not told who built it or what
  they claimed.

So "blind" here means *blind to the builder*, and the comparison is against a
pre-registered standard rather than a live image. Where a critic's knowledge of
a reference title is the only evidence, they must say so explicitly rather than
implying they compared pixels.

## Scoring

Each category scores **0–10** against a pre-registered bar, where:

- **10** — indistinguishable from the reference title, or better.
- **8–9** — clearly competitive; a player would not call it a weak point.
- **6–7** — competent but the reference wins; the gap is nameable.
- **4–5** — obviously worse; a player would notice immediately.
- **0–3** — missing, broken, or placeholder.

**A system is not done until it scores ≥8 and the critic names no obvious
weakness.** The run continues while any system sits below that.

## Pre-registered bars

### Gunplay & weapon depth — ref: Escape From Tarkov
- Recoil is a *learnable pattern*, not random spray. Mastery is possible.
- Attachments produce felt, not just numeric, differences.
- Ammo type matters as much as weapon choice; penetration vs armour is legible.
- Malfunctions exist, have distinct clearing actions, and cost real time.
- Reloads distinguish tactical (+1 chambered) from empty; the animation and the
  data agree.
- Ballistics have travel time and drop the player must learn.

### Tactical gameplay — ref: Ready or Not
- Every door is a decision: open, mirror under, breach, or avoid.
- Rooms have real geometry — corners, cover, sightlines worth clearing slowly.
- Enemies react to sound, light, bodies and open doors, not just line of sight.
- Non-lethal, surrender and arrest are viable, not decorative.
- Being shot is fast and punishing; caution is rewarded over reflexes.

### Realism & handling — ref: Ground Branch
- Weight and momentum are felt; no instant direction changes.
- Stance transitions cost time; prone/crouch/lean are tactically distinct.
- No arcade concessions: no hit markers on kills by default, no regenerating
  health, no magic ammo counter.
- Leaning exposes less of the body and the geometry reflects it.

### Mission freedom — ref: Ghost Recon Wildlands
- At least three genuinely different approaches to a given objective.
- Recon before commitment is rewarded (drone, optics, patrol observation).
- The site reads at a glance: the player can form a plan by looking.
- Failure states are interesting, not just restarts.

### Presentation — ref: Modern Warfare
- Correct exposure and believable light at every hour of day.
- Audio locates threats accurately by ear alone.
- UI is legible, diegetic where possible, and never cluttered.
- Camera restraint: no gratuitous shake; motion communicates state.

### Enemy AI — ref: Ready or Not / F.E.A.R.
- Uses cover with intent, not as scenery.
- Suppression changes behaviour, not just accuracy numbers.
- Squads coordinate: one moves while another watches.
- Search behaviour is believable — checks likely hiding spots, gives up
  plausibly, does not gain omniscience.
- Never psychic: reaction times, perception cones and light levels are honest.

### Environment & art — ref: Wildlands / Ready or Not
- Readable silhouettes; the player can parse cover and route instantly.
- Interiors feel inhabited, not generated.
- Weather and time of day change how a site plays, not just how it looks.

### Progression — ref: Tarkov / Wildlands
- Rewards deepen options rather than inflating numbers.
- Reputation has consequences the player can feel.
- Unlocks are legible and worth pursuing.

## Output format

Every critique returns:

```
SYSTEM:   <name>
ROUND:    <n>
SCORES:   <category>: <n>/10  (one line per category)
OVERALL:  <n>/10
VERDICT:  win | competitive | reference wins
LARGEST GAP: <one specific, actionable fix>
EVIDENCE: <what you actually looked at — files, screenshots, numbers>
NOT VERIFIED: <what you could not check, and why>
```

The `NOT VERIFIED` field is mandatory. A critic who claims to have checked
something they could not check has failed at their only job.
