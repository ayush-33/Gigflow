import { generateDescription, generateSuggestedSkills } from "../services/aiService.js";

// In-memory rate limiting map
// key: `${userId}:${type}` -> value: array of timestamp numbers
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in ms
const MAX_REQUESTS = 5;

const isRateLimited = (userId, type) => {
  const key = `${userId}:${type}`;
  const now = Date.now();
  let userTimestamps = rateLimits.get(key) || [];
  // Filter timestamps within the last 1 hour
  userTimestamps = userTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);

  if (userTimestamps.length >= MAX_REQUESTS) {
    return true;
  }

  userTimestamps.push(now);
  rateLimits.set(key, userTimestamps);
  return false;
};

/**
 * Handles incoming request to generate a gig description using AI.
 * Validates request data, checks rate limits, and triggers AI service.
 */
export const generateGigDescription = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Please log in to use AI generation." });
    }

    // 1. In-Memory Rate Limiting Check
    if (isRateLimited(userId, "description")) {
      return res.status(429).json({
        message: "You've reached the AI generation limit. Try again later."
      });
    }

    // 2. Request Validation
    const { title, category, tags, price, deliveryTime } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Gig Title is required." });
    }
    if (title.trim().length < 5) {
      return res.status(400).json({ message: "Title must be at least 5 characters." });
    }
    if (title.length > 200) {
      return res.status(400).json({ message: "Title is too long." });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ message: "Category is required." });
    }

    if (tags && (!Array.isArray(tags) || tags.length > 5)) {
      return res.status(400).json({ message: "Tags must be an array of at most 5 items." });
    }

    if (price !== undefined && price !== null && price !== "") {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 5) {
        return res.status(400).json({ message: "Price must be at least $5." });
      }
    }

    if (deliveryTime !== undefined && deliveryTime !== null && deliveryTime !== "") {
      const numDelivery = Number(deliveryTime);
      if (isNaN(numDelivery) || numDelivery < 1 || numDelivery > 60) {
        return res.status(400).json({ message: "Delivery must be between 1 and 60 days." });
      }
    }

    // 3. API Key check (Fail early before calling the service)
    if (!process.env.GEMINI_API_KEY) {
      console.error("AI Generation Error: GEMINI_API_KEY environment variable is missing.");
      return res.status(500).json({ message: "AI description generation is currently misconfigured." });
    }

    // 4. Invoke AI Generation Service
    const cleanTags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [];
    const result = await generateDescription({
      title: title.trim(),
      category: category.trim(),
      tags: cleanTags,
      price: price ? Number(price) : "",
      deliveryTime: deliveryTime ? Number(deliveryTime) : ""
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI Generation Error details:", error.message);
    
    // Check if it's a config issue
    if (error.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ message: "AI description generation is currently misconfigured." });
    }

    // Return friendly status 502 for provider failures, timeouts, etc.
    return res.status(502).json({
      message: "AI description generation failed. You can try again or write manually."
    });
  }
};

/**
 * Handles incoming request to suggest skills using AI.
 * Validates request data, checks rate limits, and triggers AI service.
 */
export const suggestSkills = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Please log in to use AI suggestions." });
    }

    // 1. In-Memory Rate Limiting Check
    if (isRateLimited(userId, "skills")) {
      return res.status(429).json({
        message: "You've reached the AI skill suggestion limit. Try again later."
      });
    }

    // 2. Request Validation
    const { title, category, existingSkills } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Gig Title is required to suggest skills." });
    }
    if (title.trim().length < 5) {
      return res.status(400).json({ message: "Title must be at least 5 characters to suggest skills." });
    }
    if (title.length > 200) {
      return res.status(400).json({ message: "Title is too long." });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ message: "Category is required to suggest skills." });
    }

    if (existingSkills && !Array.isArray(existingSkills)) {
      return res.status(400).json({ message: "existingSkills must be an array." });
    }

    // 3. API Key check
    if (!process.env.GEMINI_API_KEY) {
      console.error("AI Skill Suggestion Error: GEMINI_API_KEY environment variable is missing.");
      return res.status(500).json({ message: "AI skill suggestion is currently misconfigured." });
    }

    // 4. Invoke AI Generation Service
    const cleanExisting = Array.isArray(existingSkills)
      ? existingSkills.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const result = await generateSuggestedSkills({
      title: title.trim(),
      category: category.trim(),
      existingSkills: cleanExisting
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Skill Suggestion Error details:", error.message);
    if (error.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ message: "AI skill suggestion is currently misconfigured." });
    }
    return res.status(502).json({
      message: "AI skill suggestion failed. You can add skills manually."
    });
  }
};
