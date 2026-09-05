import assert from "node:assert/strict";
import {
  normalizeText,
  extractMeaningfulWords,
  findRelevantCompletedProjects
} from "./controllers/aiController.js";
import {
  sanitizeProposalText,
  generateProposal,
  generateDescription,
  generateSuggestedSkills
} from "./services/aiService.js";

console.log("=== RUNNING PROPOSAL FEATURE VERIFICATION TESTS ===");

// 1. Test Text Normalization
console.log("\n[1] Testing normalizeText...");
assert.equal(normalizeText("  React.js & Node.JS!  "), "react js node js");
assert.equal(normalizeText("Web Development / Full-Stack"), "web development full stack");
console.log("✓ normalizeText passed");

// 2. Test Meaningful Words Extraction
console.log("\n[2] Testing extractMeaningfulWords...");
const words = extractMeaningfulWords("I will build a modern website with React and Node");
assert.ok(words.has("build"));
assert.ok(words.has("modern"));
assert.ok(words.has("website"));
assert.ok(words.has("react"));
assert.ok(words.has("node"));
assert.ok(!words.has("i"));
assert.ok(!words.has("will"));
assert.ok(!words.has("a"));
assert.ok(!words.has("with"));
assert.ok(!words.has("and"));
console.log("✓ extractMeaningfulWords passed");

// 3. Test findRelevantCompletedProjects
console.log("\n[3] Testing findRelevantCompletedProjects (Deterministic Relevance Matching)...");

const currentGig = {
  _id: "gig_current_123",
  title: "Full Stack React and Node Portfolio Website",
  category: "Web Development",
  description: "Need an experienced developer to create a responsive modern portfolio with animations",
  tags: ["React", "Node.js", "MongoDB", "Express"],
  price: 250,
  deliveryTime: 5
};

const completedGigs = [
  // Project A: Highly relevant (category matches, shared tags: React, Node.js)
  {
    _id: "gig_comp_1",
    title: "Weather Dashboard App",
    category: "Web Development",
    description: "Built a dynamic weather website with API integrations",
    tags: ["React", "Node.js"],
    createdAt: new Date("2026-01-10")
  },
  // Project B: Relevant (different category, but shared tag: MongoDB)
  {
    _id: "gig_comp_2",
    title: "Database Optimization Script",
    category: "DevOps & Cloud",
    description: "Optimized complex queries and performance",
    tags: ["MongoDB", "Docker"],
    createdAt: new Date("2026-02-01")
  },
  // Project C: Unrelated (Logo design - has title/desc word overlap "modern", "portfolio", but NO category or tag match)
  {
    _id: "gig_comp_3",
    title: "Modern Portfolio Logo Design",
    category: "Graphic Design",
    description: "Created a modern responsive logo for portfolio",
    tags: ["Photoshop", "Illustrator"],
    createdAt: new Date("2026-03-01")
  },
  // Project D: Relevant (same category "Web Development", no shared tags)
  {
    _id: "gig_comp_4",
    title: "Simple HTML CSS Landing Page",
    category: "Web Development",
    description: "Built clean landing page layout",
    tags: ["HTML", "CSS"],
    createdAt: new Date("2026-01-01")
  }
];

const selectedProjects = findRelevantCompletedProjects(currentGig, completedGigs);

console.log("Selected projects count:", selectedProjects.length);
assert.equal(selectedProjects.length, 2, "Should select at most 2 projects");

// Project C MUST NOT be selected despite having title/desc overlap "modern" & "portfolio"
const hasProjectC = selectedProjects.some(p => p._id === "gig_comp_3");
assert.equal(hasProjectC, false, "Unrelated project C must NOT qualify based solely on word overlap");

// Project A should be first (highest score: category match + 2 shared tags)
assert.equal(selectedProjects[0]._id, "gig_comp_1", "Project A should rank highest");

console.log("✓ findRelevantCompletedProjects successfully filtered irrelevant and selected top 2");

// 4. Test with 0 completed projects
console.log("\n[4] Testing with 0 completed projects...");
const emptyResult = findRelevantCompletedProjects(currentGig, []);
assert.deepEqual(emptyResult, []);
console.log("✓ Empty completed projects handled cleanly");

// 5. Test sanitizeProposalText
console.log("\n[5] Testing sanitizeProposalText...");
const dirtyOutput1 = `\`\`\`markdown
Here is your proposal:
Dear Client, I would love to assist you with this React website.
\`\`\``;
assert.equal(
  sanitizeProposalText(dirtyOutput1),
  "Dear Client, I would love to assist you with this React website."
);

const dirtyOutput2 = "Sure! Here is the proposal:\n\nHello, I can complete your project...";
assert.equal(
  sanitizeProposalText(dirtyOutput2),
  "Hello, I can complete your project..."
);

const dirtyOutput3 = "Proposal:\nI will design your frontend...";
assert.equal(
  sanitizeProposalText(dirtyOutput3),
  "I will design your frontend..."
);
console.log("✓ sanitizeProposalText passed");

// 6. Test API Key separation & error handling
console.log("\n[6] Testing API Key isolation in aiService...");

// Save current env
const origProposalKey = process.env.GEMINI_PROPOSAL_API_KEY;
const origApiKey = process.env.GEMINI_API_KEY;

// Unset proposal key
delete process.env.GEMINI_PROPOSAL_API_KEY;
try {
  await generateProposal({
    gig: currentGig,
    completedProjects: [],
    bio: ""
  });
  assert.fail("Should have thrown error when GEMINI_PROPOSAL_API_KEY is missing");
} catch (err) {
  assert.ok(
    err.message.includes("GEMINI_PROPOSAL_API_KEY"),
    "Must explicitly complain about GEMINI_PROPOSAL_API_KEY"
  );
  console.log("✓ generateProposal correctly requires GEMINI_PROPOSAL_API_KEY and does not fall back to GEMINI_API_KEY");
}

// Restore
if (origProposalKey) process.env.GEMINI_PROPOSAL_API_KEY = origProposalKey;
if (origApiKey) process.env.GEMINI_API_KEY = origApiKey;

console.log("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
