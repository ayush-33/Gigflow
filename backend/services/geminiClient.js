/**
 * Reusable Gemini API Client with Production-Grade Resilience
 *
 * Provides:
 * - Dynamic API key & model support
 * - Request timeout via AbortController (default 30s)
 * - Transient error classification (408, 429, 500, 502, 503, 504, network errors)
 * - Exponential backoff with random jitter
 * - Retry-After header inspection for rate limits
 * - Bounded retry attempts (default max 3 retries)
 * - Structured GeminiError class
 * - Safe logging without sensitive credentials or prompts
 */

export class GeminiError extends Error {
  constructor({
    message,
    status = 500,
    code = "AI_REQUEST_FAILED",
    retryable = false,
    feature = "ai",
    attempts = 1,
    originalMessage = ""
  }) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.feature = feature;
    this.attempts = attempts;
    this.originalMessage = originalMessage;
  }
}

// Retryable HTTP status codes (transient errors)
export const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// Non-retryable HTTP status codes (client/auth/config errors)
export const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404]);

export const isRetryableStatus = (status) => RETRYABLE_STATUS_CODES.has(status);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates exponential backoff with random jitter.
 * Base delay: min(1000 * 2^attempt, 8000) ms
 * Jitter: random between 0 and 500 ms
 */
export const calculateBackoff = (attempt) => {
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 8000);
  const jitter = Math.random() * 500;
  return Math.round(baseDelay + jitter);
};

/**
 * Inspects Retry-After header if provided by Gemini.
 * Returns delay in ms if valid, or null.
 */
export const parseRetryAfter = (retryAfterHeader, maxAllowedMs = 10000) => {
  if (!retryAfterHeader) return null;

  let delayMs = null;

  // Check if it is a number of seconds
  const seconds = Number(retryAfterHeader);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    delayMs = seconds * 1000;
  } else {
    // Check if it is an HTTP date
    const dateMs = Date.parse(retryAfterHeader);
    if (!Number.isNaN(dateMs)) {
      const diff = dateMs - Date.now();
      if (diff > 0) delayMs = diff;
    }
  }

  if (delayMs === null) return null;

  // If delay is longer than max allowed, return special indicator or bound it
  return { delayMs, exceedsLimit: delayMs > maxAllowedMs };
};

/**
 * Maps HTTP status code or error state to a structured GeminiError code.
 */
export const mapStatusToErrorCode = (status) => {
  switch (status) {
    case 400:
      return "AI_BAD_REQUEST";
    case 401:
      return "AI_CONFIGURATION_ERROR";
    case 403:
      return "AI_CONFIGURATION_ERROR";
    case 404:
      return "AI_MODEL_NOT_FOUND";
    case 408:
      return "AI_TIMEOUT";
    case 429:
      return "AI_RATE_LIMITED";
    case 500:
    case 502:
    case 503:
    case 504:
      return "AI_TEMPORARILY_UNAVAILABLE";
    default:
      return "AI_REQUEST_FAILED";
  }
};

/**
 * Executes a call to the Gemini API with timeout, retry, exponential backoff,
 * jitter, and structured error handling.
 *
 * @param {Object} options
 * @param {string} options.apiKey - Gemini API key
 * @param {string} options.model - Gemini model name
 * @param {Object} options.payload - Request payload for generateContent
 * @param {string} [options.feature="ai"] - Feature name (description, skills, proposal)
 * @param {number} [options.maxRetries=3] - Maximum retry attempts (total attempts = 1 + maxRetries)
 * @param {number} [options.timeoutMs=30000] - Timeout per attempt in milliseconds
 * @param {string} [options.baseUrl] - Base URL for Gemini API (for testing/mocking)
 * @returns {Promise<Object>} Successful JSON response from Gemini
 */
export const callGemini = async ({
  apiKey,
  model,
  payload,
  feature = "ai",
  maxRetries = 3,
  timeoutMs = 30000,
  baseUrl = "https://generativelanguage.googleapis.com/v1beta/models"
}) => {
  if (!apiKey || typeof apiKey !== "string") {
    throw new GeminiError({
      message: "API key is missing or invalid for AI feature.",
      status: 500,
      code: "AI_CONFIGURATION_ERROR",
      retryable: false,
      feature,
      attempts: 0,
      originalMessage: "Missing API key"
    });
  }

  if (!model || typeof model !== "string") {
    throw new GeminiError({
      message: "Model configuration is missing.",
      status: 500,
      code: "AI_CONFIGURATION_ERROR",
      retryable: false,
      feature,
      attempts: 0,
      originalMessage: "Missing model name"
    });
  }

  const endpointUrl = `${baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const totalAllowedAttempts = maxRetries + 1;

  let lastStatus = 500;
  let lastErrorMsg = "";
  let lastErrorCode = "AI_REQUEST_FAILED";
  let lastRetryable = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptNumber = attempt + 1;
    const controller = new AbortController();
    let timeoutTriggered = false;

    const timeoutTimer = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      if (response.ok) {
        console.log(`[AI] feature=${feature} status=200 attempt=${attemptNumber}`);
        const data = await response.json();
        return data;
      }

      // Non-200 HTTP response
      lastStatus = response.status;
      lastRetryable = isRetryableStatus(lastStatus);
      lastErrorCode = mapStatusToErrorCode(lastStatus);

      let responseText = "";
      try {
        responseText = await response.text();
      } catch (readErr) {
        responseText = readErr.message || "";
      }
      lastErrorMsg = responseText;

      console.warn(
        `[AI] feature=${feature} model=${model} status=${lastStatus} attempt=${attemptNumber}/${totalAllowedAttempts}`
      );

      // Check if non-retryable (400, 401, 403, 404, etc.)
      if (!lastRetryable) {
        console.error(
          `[AI] feature=${feature} status=${lastStatus} attempts=${attemptNumber} final_failure=true (non-retryable)`
        );
        throw new GeminiError({
          message: `AI request failed with status ${lastStatus}`,
          status: lastStatus === 401 ? 500 : lastStatus,
          code: lastErrorCode,
          retryable: false,
          feature,
          attempts: attemptNumber,
          originalMessage: lastErrorMsg
        });
      }

      // If retryable but we have reached max retries
      if (attempt >= maxRetries) {
        console.error(
          `[AI] feature=${feature} status=${lastStatus} attempts=${attemptNumber} final_failure=true`
        );
        break;
      }

      // Determine retry delay
      let delayMs = calculateBackoff(attempt);

      // Inspect Retry-After header for 429/503
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader) {
        const parsed = parseRetryAfter(retryAfterHeader, 10000);
        if (parsed) {
          if (parsed.exceedsLimit) {
            console.warn(
              `[AI] feature=${feature} Retry-After (${parsed.delayMs}ms) exceeds limit, aborting further retries`
            );
            break;
          }
          delayMs = Math.round(parsed.delayMs + Math.random() * 200);
        }
      }

      console.log(`[AI] feature=${feature} retrying in ${delayMs}ms`);
      await sleep(delayMs);

    } catch (err) {
      clearTimeout(timeoutTimer);

      // If it's already a non-retryable GeminiError re-thrown above, rethrow immediately
      if (err instanceof GeminiError && !err.retryable) {
        throw err;
      }

      const isTimeout = timeoutTriggered || err.name === "AbortError";

      if (isTimeout) {
        lastStatus = 408;
        lastErrorCode = "AI_TIMEOUT";
        lastRetryable = true;
        lastErrorMsg = `Request timed out after ${timeoutMs}ms`;
        console.warn(
          `[AI] feature=${feature} model=${model} status=408 (timeout) attempt=${attemptNumber}/${totalAllowedAttempts}`
        );
      } else {
        // Network errors (e.g. fetch failed, ECONNRESET, ENOTFOUND)
        lastStatus = 503;
        lastErrorCode = "AI_TEMPORARILY_UNAVAILABLE";
        lastRetryable = true;
        lastErrorMsg = err.message || "Network error";
        console.warn(
          `[AI] feature=${feature} model=${model} status=network_error attempt=${attemptNumber}/${totalAllowedAttempts}: ${lastErrorMsg}`
        );
      }

      if (attempt >= maxRetries) {
        console.error(
          `[AI] feature=${feature} status=${lastStatus} attempts=${attemptNumber} final_failure=true`
        );
        break;
      }

      const delayMs = calculateBackoff(attempt);
      console.log(`[AI] feature=${feature} retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  const finalStatus = lastStatus === 429 ? 429 : 503;
  const finalCode = lastStatus === 429 ? "AI_RATE_LIMITED" : "AI_TEMPORARILY_UNAVAILABLE";

  throw new GeminiError({
    message:
      finalCode === "AI_RATE_LIMITED"
        ? "AI service is temporarily rate limited. Please try again shortly."
        : "AI service is temporarily unavailable. Please try again.",
    status: finalStatus,
    code: finalCode,
    retryable: true,
    feature,
    attempts: totalAllowedAttempts,
    originalMessage: lastErrorMsg
  });
};
