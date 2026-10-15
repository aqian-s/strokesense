import type { Session } from "./storage";

// Two illustrative reviews shown on first visit so the app isn't empty for a new
// viewer. They are clearly labeled as samples, have no video attached, and are
// removed from the list for good if the viewer deletes them.

export const EXAMPLES_SEEDED_KEY = "strokesense.examples.v1";

const day = 24 * 60 * 60 * 1000;

export const EXAMPLE_SESSIONS: Session[] = [
  {
    id: "example-freestyle",
    title: "Sample · Freestyle, 25 m",
    createdAt: Date.now() - 9 * day,
    fileName: "sample-freestyle.mp4",
    fileUri: "",
    mimeType: "video/mp4",
    prompt: "Why does my freestyle feel slow?",
    strokeHint: "Freestyle",
    example: true,
    analysis: {
      stroke: "Freestyle",
      summary:
        "A capable, relaxed freestyle with a steady six-beat kick and good breathing rhythm to the right. The stroke loses most of its speed in the front half: the lead hand enters and then slides forward with a dropped elbow, so the pull starts late and pushes water down instead of back.",
      noMajorIssues: false,
      strengths: [
        "Consistent, narrow kick with pointed feet — no knee-driven splashing",
        "Breath is taken low, with one goggle staying in the water on the right side",
        "Good body rotation that stays connected to the hips rather than the shoulders alone",
      ],
      issues: [
        {
          title: "Dropped elbow in the catch",
          severity: "high",
          timestamp: "0:03–0:06",
          whatWeSee: "After entry the right forearm sinks toward the pool floor and the elbow leads the hand into the pull.",
          whyItMatters: "A dropped elbow means the first third of every stroke is spent pushing water down, not back. It is the single biggest speed leak in the clip.",
          fix: "Keep the elbow high and wide after entry and tip the fingertips toward the bottom first, so the forearm becomes a paddle before the arm pulls.",
        },
        {
          title: "Crossover at hand entry",
          severity: "medium",
          timestamp: "0:08, 0:14",
          whatWeSee: "The left hand enters in front of the head rather than in line with the shoulder, especially after a breath.",
          whyItMatters: "Crossing the midline makes the hips snake side to side, which costs streamline and over time strains the shoulder.",
          fix: "Enter at eleven o'clock, not twelve. Picture the hand sliding into a track directly in front of the shoulder.",
        },
        {
          title: "Head lifts slightly to breathe",
          severity: "low",
          timestamp: "0:11",
          whatWeSee: "On the third breath the chin rises and the hips drop for one stroke cycle.",
          whyItMatters: "Minor, but each lift adds a little drag and breaks the rhythm of the rotation.",
          fix: "Turn to breathe as the body rotates rather than lifting; the bow wave makes a pocket of air lower than you think.",
        },
      ],
      drills: [
        { name: "Sculling — front position", targets: "Dropped elbow in the catch", how: "Face down with arms extended, scull the hands in and out while keeping the elbows high and the forearms angled down. Feel the pressure on the palm and forearm, not the shoulder.", sets: "4 × 25 m, 20 s rest" },
        { name: "Fingertip drag", targets: "Crossover at hand entry", how: "Swim normal freestyle but drag the fingertips along the surface during recovery. The high elbow it forces lines the hand up for an entry in front of the shoulder.", sets: "6 × 25 m, 15 s rest" },
        { name: "Single-arm freestyle, other arm at side", targets: "Dropped elbow in the catch", how: "One arm strokes while the other rests at the hip. With nothing to hide behind, the catch has to be made correctly to move forward. Breathe to the side of the resting arm.", sets: "4 × 25 m each arm, 20 s rest" },
        { name: "Side-kick with rotation", targets: "Head lifts slightly to breathe", how: "Kick on the side with the lower arm extended, face in the water. Every six kicks, rotate the head to breathe without lifting it, then return.", sets: "4 × 25 m, 20 s rest" },
      ],
      plan: [
        { week: "Week 1", focus: "Sculling and single-arm every session; no concern for speed. The goal is to feel the forearm catch water early." },
        { week: "Week 2", focus: "Fingertip drag into 50s of full stroke, counting strokes per length. Aim to hold the same count as the week-1 baseline, minus one." },
        { week: "Week 3", focus: "Full stroke with one technical focus per length, alternating catch and entry. Film again from the same angle." },
      ],
    },
    messages: [
      { role: "user", text: "Which drill should I start with?", at: Date.now() - 9 * day + 60000 },
      { role: "assistant", text: "Start with front sculling. Everything else in the plan depends on feeling the catch — once you can feel pressure on the forearm during sculling, single-arm freestyle will make sense immediately. Do it first in every session this week, before you are tired, four lengths with real rest between them.", at: Date.now() - 9 * day + 90000 },
    ],
  },
  {
    id: "example-breaststroke",
    title: "Sample · Breaststroke pull-outs",
    createdAt: Date.now() - 3 * day,
    fileName: "sample-breaststroke.mp4",
    fileUri: "",
    mimeType: "video/mp4",
    prompt: "General technique review",
    strokeHint: "Breaststroke",
    example: true,
    analysis: {
      stroke: "Breaststroke",
      summary:
        "Clean, well-timed breaststroke with a strong, narrow kick and a quiet recovery. There is nothing significant to fix at this level; the refinements below are the small things that separate a good stroke from a fast one.",
      noMajorIssues: true,
      strengths: [
        "Kick finishes with the feet together and toes pointed — the glide is long and flat",
        "Head stays neutral during the breath; the shoulders rise, the chin does not reach",
        "Pull is compact and does not go wider than the shoulders",
      ],
      issues: [
        {
          title: "Slightly early kick",
          severity: "low",
          timestamp: "0:05, 0:12",
          whatWeSee: "The heels begin to draw up a fraction before the hands have finished shooting forward.",
          whyItMatters: "A small timing overlap costs a little glide on each cycle. It is subtle and only worth adjusting once everything else is automatic.",
          fix: "Think 'hands away, then heels up' — the arms should be nearly straight before the feet start to load.",
        },
      ],
      drills: [
        { name: "Two kicks, one pull", targets: "Slightly early kick", how: "Take one pull, then two full kicks with a long glide after each. The extra kick exaggerates the gap between arms and legs so the timing becomes obvious.", sets: "4 × 50 m, 20 s rest" },
        { name: "Pull-out practice from the wall", targets: "Maintenance and speed", how: "Push off, one underwater pull with a dolphin kick, one breaststroke kick, then surface. Count how far the first stroke starts from the wall and try to add a metre.", sets: "8 × 15 m, walk back" },
        { name: "Breaststroke with a pull buoy", targets: "Maintenance and speed", how: "Pull only, with the buoy between the thighs. Keep the pull narrow and quick and the glide long; the stroke rate will feel slow — that is the point.", sets: "4 × 50 m, 20 s rest" },
      ],
      plan: [
        { week: "Week 1", focus: "Timing drill on easy days; pull-outs at the start of every main set." },
        { week: "Week 2", focus: "Race-pace 50s with a stroke count target. Film from the side again to confirm the timing change held." },
      ],
    },
    messages: [],
  },
];
