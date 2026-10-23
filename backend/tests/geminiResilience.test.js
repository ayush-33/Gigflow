import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  callGemini,
  GeminiError,
  isRetryableStatus,
  calculateBackoff,
  parseRetryAfter,
  mapStatusToErrorCode
} from "../services/geminiClient.js";

// Helper to create an ephemeral HTTP server for deterministic mocking
const createMockServer = (handler) => {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}/models`;
      const close = () => new Promise((res) => server.close(res));
      resolve({ server, baseUrl, close });
    });
  });
};

describe("Gemini Resilience & Retry Layer Unit Tests", () => {
  describe("Helper Functions", () => {
    it("correctly identifies retryable vs non-retryable status codes", () => {
      // Retryable
      assert.equal(isRetryableStatus(408), true);
      assert.equal(isRetryableStatus(429), true);
      assert.equal(isRetryableStatus(500), true);
      assert.equal(isRetryableStatus(502), true);
      assert.equal(isRetryableStatus(503), true);
      assert.equal(isRetryableStatus(504), true);

      // Non-retryable
      assert.equal(isRetryableStatus(400), false);
      assert.equal(isRetryableStatus(401), false);
      assert.equal(isRetryableStatus(403), false);
      assert.equal(isRetryableStatus(404), false);
      assert.equal(isRetryableStatus(200), false);
    });

    it("calculates exponential backoff with jitter and bounding", () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = calculateBackoff(attempt);
        const minExpected = Math.min(1000 * Math.pow(2, attempt), 8000);
        const maxExpected = minExpected + 500;
        assert.ok(
          delay >= minExpected && delay <= maxExpected,
          `Attempt ${attempt} delay ${delay} outside [${minExpected}, ${maxExpected}]`
        );
      }
    });

    it("parses Retry-After header properly", () => {
      // Seconds
      const res1 = parseRetryAfter("3", 10000);
      assert.equal(res1.delayMs, 3000);
      assert.equal(res1.exceedsLimit, false);

      // Exceeds max limit
      const res2 = parseRetryAfter("60", 10000);
      assert.equal(res2.delayMs, 60000);
      assert.equal(res2.exceedsLimit, true);

      // Null or invalid
      assert.equal(parseRetryAfter(null), null);
      assert.equal(parseRetryAfter("invalid-date-string"), null);
    });

    it("maps status codes to standard error codes", () => {
      assert.equal(mapStatusToErrorCode(400), "AI_BAD_REQUEST");
      assert.equal(mapStatusToErrorCode(401), "AI_CONFIGURATION_ERROR");
      assert.equal(mapStatusToErrorCode(408), "AI_TIMEOUT");
      assert.equal(mapStatusToErrorCode(429), "AI_RATE_LIMITED");
      assert.equal(mapStatusToErrorCode(503), "AI_TEMPORARILY_UNAVAILABLE");
      assert.equal(mapStatusToErrorCode(500), "AI_TEMPORARILY_UNAVAILABLE");
    });
  });

  describe("API Call Scenarios", () => {
    it("TEST 1: Normal Success (200) - succeeds on first attempt without retrying", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Success output" }] } }] }));
      });

      try {
        const result = await callGemini({
          apiKey: "test-api-key",
          model: "gemini-3.5-flash",
          payload: { prompt: "hello" },
          feature: "test-feature",
          baseUrl
        });

        assert.equal(requestCount, 1);
        assert.ok(result.candidates);
        assert.equal(result.candidates[0].content.parts[0].text, "Success output");
      } finally {
        await close();
      }
    });

    it("TEST 2: 503 Then Success - retries once and returns successful result", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        if (requestCount === 1) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "Model is overloaded" } }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Recovered output" }] } }] }));
        }
      });

      try {
        const result = await callGemini({
          apiKey: "test-api-key",
          model: "gemini-3.5-flash",
          payload: { prompt: "hello" },
          feature: "test-503-retry",
          maxRetries: 3,
          baseUrl
        });

        assert.equal(requestCount, 2);
        assert.equal(result.candidates[0].content.parts[0].text, "Recovered output");
      } finally {
        await close();
      }
    });

    it("TEST 3: 503 Three Times Then Success - retries 3 times with backoff then succeeds", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        if (requestCount <= 3) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "Temporary unavailable" } }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Fourth attempt success" }] } }] }));
        }
      });

      try {
        const result = await callGemini({
          apiKey: "test-api-key",
          model: "gemini-3.5-flash",
          payload: { prompt: "hello" },
          feature: "test-multi-retry",
          maxRetries: 3,
          baseUrl
        });

        assert.equal(requestCount, 4);
        assert.equal(result.candidates[0].content.parts[0].text, "Fourth attempt success");
      } finally {
        await close();
      }
    });

    it("TEST 4: Permanent 503 - stops after maxRetries and throws structured 503 error", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Service Unavailable" } }));
      });

      try {
        await assert.rejects(
          async () => {
            await callGemini({
              apiKey: "test-api-key",
              model: "gemini-3.5-flash",
              payload: { prompt: "hello" },
              feature: "test-perm-503",
              maxRetries: 2,
              baseUrl
            });
          },
          (err) => {
            assert.ok(err instanceof GeminiError);
            assert.equal(err.status, 503);
            assert.equal(err.code, "AI_TEMPORARILY_UNAVAILABLE");
            assert.equal(err.attempts, 3); // initial + 2 retries = 3
            assert.equal(err.feature, "test-perm-503");
            return true;
          }
        );

        assert.equal(requestCount, 3);
      } finally {
        await close();
      }
    });

    it("TEST 5: 429 Rate Limit - handles rate limiting and Retry-After header", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        if (requestCount === 1) {
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": "1"
          });
          res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Rate limit recovered" }] } }] }));
        }
      });

      try {
        const result = await callGemini({
          apiKey: "test-api-key",
          model: "gemini-3.5-flash",
          payload: { prompt: "hello" },
          feature: "test-429",
          maxRetries: 2,
          baseUrl
        });

        assert.equal(requestCount, 2);
        assert.equal(result.candidates[0].content.parts[0].text, "Rate limit recovered");
      } finally {
        await close();
      }
    });

    it("TEST 6: 401 Unauthorized - does NOT retry, returns AI_CONFIGURATION_ERROR", async () => {
      let requestCount = 0;
      const testSecretKey = "my-secret-gemini-key-12345";
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "API_KEY_INVALID" } }));
      });

      try {
        await assert.rejects(
          async () => {
            await callGemini({
              apiKey: testSecretKey,
              model: "gemini-3.5-flash",
              payload: { prompt: "hello" },
              feature: "test-401",
              maxRetries: 3,
              baseUrl
            });
          },
          (err) => {
            assert.ok(err instanceof GeminiError);
            assert.equal(err.status, 500); // 401 mapped to 500 configuration error
            assert.equal(err.code, "AI_CONFIGURATION_ERROR");
            assert.equal(err.retryable, false);
            assert.equal(err.attempts, 1); // exactly 1 attempt, NO retries
            // Crucial security check: API key must NOT be in error message
            assert.ok(!err.message.includes(testSecretKey));
            return true;
          }
        );

        assert.equal(requestCount, 1);
      } finally {
        await close();
      }
    });

    it("TEST 7: 400 Bad Request - does NOT retry, returns AI_BAD_REQUEST with status 400", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Invalid argument: contents is required" } }));
      });

      try {
        await assert.rejects(
          async () => {
            await callGemini({
              apiKey: "test-api-key",
              model: "gemini-3.5-flash",
              payload: { invalid: true },
              feature: "test-400",
              maxRetries: 3,
              baseUrl
            });
          },
          (err) => {
            assert.ok(err instanceof GeminiError);
            assert.equal(err.status, 400);
            assert.equal(err.code, "AI_BAD_REQUEST");
            assert.equal(err.retryable, false);
            assert.equal(err.attempts, 1); // NO retries
            return true;
          }
        );

        assert.equal(requestCount, 1);
      } finally {
        await close();
      }
    });

    it("TEST 8: Request Timeout - triggers abort, retries, and returns structured temporary unavailable", async () => {
      let requestCount = 0;
      const { baseUrl, close } = await createMockServer((req, res) => {
        requestCount++;
        // Intentionally hang without sending headers or body
      });

      try {
        await assert.rejects(
          async () => {
            await callGemini({
              apiKey: "test-api-key",
              model: "gemini-3.5-flash",
              payload: { prompt: "hello" },
              feature: "test-timeout",
              maxRetries: 1,
              timeoutMs: 150, // 150ms timeout for fast deterministic test
              baseUrl
            });
          },
          (err) => {
            assert.ok(err instanceof GeminiError);
            assert.equal(err.status, 503);
            assert.equal(err.code, "AI_TEMPORARILY_UNAVAILABLE");
            assert.equal(err.attempts, 2); // 1 initial + 1 retry
            return true;
          }
        );

        assert.ok(requestCount >= 2);
      } finally {
        await close();
      }
    });
  });
});
