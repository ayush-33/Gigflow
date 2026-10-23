import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  generateDescription,
  generateSuggestedSkills,
  generateProposal,
  sanitizeText,
  sanitizeProposalText
} from "../services/aiService.js";
import {
  findRelevantCompletedProjects,
  normalizeText,
  extractMeaningfulWords
} from "../controllers/aiController.js";

// Helper to create an ephemeral HTTP server
const createMockGeminiApi = (responseBody, statusCode = 200) => {
  return new Promise((resolve) => {
    let receivedApiKey = null;
    let receivedModel = null;
    let receivedPayload = null;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      receivedApiKey = url.searchParams.get("key");
      const match = url.pathname.match(/\/models\/([^:]+):generateContent/);
      if (match) receivedModel = match[1];

      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try { receivedPayload = JSON.parse(body); } catch {}
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}/models`;
      const close = () => new Promise((r) => server.close(r));
      resolve({
        baseUrl,
        close,
        getCaptured: () => ({ receivedApiKey, receivedModel, receivedPayload })
      });
    });
  });
};

describe("AI Service & Features Integration Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-standard-key-abc";
    process.env.GEMINI_PROPOSAL_API_KEY = "test-proposal-key-xyz";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_PROPOSAL_MODEL = "gemini-3.5-flash";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Sanitization & Relevance Helpers", () => {
    it("sanitizeText removes markdown fences and conversational prefixes", () => {
      const input = "```markdown\nSure, here is the description:\nThis is a clean description.\n```";
      const output = sanitizeText(input);
      assert.equal(output, "This is a clean description.");
    });

    it("sanitizeProposalText removes prefixes and markdown fences", () => {
      const input = "```text\nHere is your proposal:\nI am excited to apply for your gig.\n```";
      const output = sanitizeProposalText(input);
      assert.equal(output, "I am excited to apply for your gig.");
    });

    it("findRelevantCompletedProjects matches based on tags and category", () => {
      const currentGig = {
        title: "React Web Application",
        category: "Web Development",
        description: "Build a high performance web app with React",
        tags: ["React", "JavaScript", "Frontend"]
      };

      const completedGigs = [
        {
          _id: "1",
          title: "Logo Design for Bakery",
          category: "Graphic Design",
          description: "Created vintage bakery logo",
          tags: ["Logo", "Illustrator"],
          createdAt: new Date("2025-01-01")
        },
        {
          _id: "2",
          title: "Full Stack Dashboard",
          category: "Web Development",
          description: "React dashboard with NodeJS backend",
          tags: ["React", "NodeJS"],
          createdAt: new Date("2025-02-01")
        },
        {
          _id: "3",
          title: "Python Data Analysis",
          category: "Data Science",
          description: "Pandas and NumPy analysis",
          tags: ["Python", "Pandas"],
          createdAt: new Date("2025-03-01")
        }
      ];

      const matches = findRelevantCompletedProjects(currentGig, completedGigs);
      assert.equal(matches.length, 1);
      assert.equal(matches[0]._id, "2");
    });
  });

  describe("API Key Separation", () => {
    it("generateDescription uses process.env.GEMINI_API_KEY", async () => {
      // Mock global fetch temporarily to inspect the key and verify separation
      const originalFetch = globalThis.fetch;
      let usedKey = null;

      globalThis.fetch = async (url) => {
        const u = new URL(url);
        usedKey = u.searchParams.get("key");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              finishReason: "STOP",
              content: { parts: [{ text: "Opening para.\n\nWhat this service includes:\n• Feature 1\n• Feature 2\n• Feature 3\n\nClosing para." }] }
            }]
          })
        };
      };

      try {
        const result = await generateDescription({
          title: "Full Stack Web Development",
          category: "Web Development",
          tags: ["React", "Node.js"],
          price: 150,
          deliveryTime: 5
        });

        assert.equal(usedKey, "test-standard-key-abc");
        assert.ok(result.description);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("generateSuggestedSkills uses process.env.GEMINI_API_KEY", async () => {
      const originalFetch = globalThis.fetch;
      let usedKey = null;

      globalThis.fetch = async (url) => {
        const u = new URL(url);
        usedKey = u.searchParams.get("key");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    skills: ["React", "TypeScript", "Tailwind CSS", "ExistingSkill"]
                  })
                }]
              }
            }]
          })
        };
      };

      try {
        const result = await generateSuggestedSkills({
          title: "Frontend React Developer",
          category: "Web Development",
          existingSkills: ["existingskill"]
        });

        assert.equal(usedKey, "test-standard-key-abc");
        assert.ok(Array.isArray(result.skills));
        // Verify existing skills are excluded
        assert.ok(!result.skills.map((s) => s.toLowerCase()).includes("existingskill"));
        assert.ok(result.skills.includes("React"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("generateProposal uses process.env.GEMINI_PROPOSAL_API_KEY", async () => {
      const originalFetch = globalThis.fetch;
      let usedKey = null;

      globalThis.fetch = async (url) => {
        const u = new URL(url);
        usedKey = u.searchParams.get("key");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              finishReason: "STOP",
              content: {
                parts: [{
                  text: "Hi, I noticed your React website gig and would love to help. Having built similar web dashboards, I have the required expertise."
                }]
              }
            }]
          })
        };
      };

      try {
        const result = await generateProposal({
          gig: {
            title: "Build Responsive Website",
            category: "Web Development",
            description: "Need a modern responsive website",
            tags: ["React"]
          },
          completedProjects: [],
          freelancerName: "John"
        });

        // Crucial: Must use GEMINI_PROPOSAL_API_KEY, NOT GEMINI_API_KEY
        assert.equal(usedKey, "test-proposal-key-xyz");
        assert.ok(result.proposal);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("throws an error if GEMINI_PROPOSAL_API_KEY is missing", async () => {
      delete process.env.GEMINI_PROPOSAL_API_KEY;

      await assert.rejects(
        async () => {
          await generateProposal({
            gig: { title: "Test Gig" },
            completedProjects: [],
            freelancerName: "Tester"
          });
        },
        /GEMINI_PROPOSAL_API_KEY/
      );
    });
  });
});
