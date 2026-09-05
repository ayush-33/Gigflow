import mongoose from "mongoose";
import {
  generateDescription,
  generateSuggestedSkills,
  generateProposal as generateProposalAI
} from "../services/aiService.js";
import Gig from "../models/gig.js";
import User from "../models/user.js";
import Bid from "../models/bid.js";

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

// Common stop words for relevance filtering
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its",
  "itself", "let's", "me", "more", "most", "my", "myself", "no", "nor", "not",
  "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "shouldn't", "so",
  "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't",
  "what", "when", "where", "which", "while", "who", "whom", "why", "with",
  "won't", "would", "wouldn't", "you", "your", "yours", "yourself", "yourselves",
  "will", "just", "also", "want", "need", "looking", "get", "make", "work"
]);

/**
 * Normalizes text: lowercase, replace punctuation with spaces, collapse spaces, trim.
 */
export const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Extracts meaningful normalized words (filtering out stop words and short tokens).
 */
export const extractMeaningfulWords = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return new Set();
  const words = normalized
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
};

/**
 * Deterministically finds the top relevant completed projects using JavaScript only.
 * Hard rule: A completed project qualifies as relevant ONLY when:
 * - at least one normalized skill/tag matches the current gig
 * OR
 * - the category matches.
 * Title/description word overlap alone NEVER qualifies an unrelated project.
 *
 * Scoring:
 * - shared skill/tag = 10 points per match
 * - matching category = 5 points
 * - meaningful title overlap = 1 point per word
 * - meaningful description overlap = 0.2 points per word
 *
 * Selects max 2 projects, breaking ties by most recently created.
 */
export const findRelevantCompletedProjects = (currentGig, completedGigs) => {
  if (!completedGigs || completedGigs.length === 0) return [];

  const currentCategoryNorm = normalizeText(currentGig.category);
  const currentTagsNorm = new Set(
    (currentGig.tags || [])
      .map((t) => normalizeText(t))
      .filter(Boolean)
  );

  const currentTitleWords = extractMeaningfulWords(currentGig.title);
  const currentDescWords = extractMeaningfulWords(currentGig.description);

  const scoredProjects = [];

  for (const completed of completedGigs) {
    if (!completed) continue;

    const completedCategoryNorm = normalizeText(completed.category);
    const categoryMatches = Boolean(
      currentCategoryNorm &&
      completedCategoryNorm &&
      currentCategoryNorm === completedCategoryNorm
    );

    const completedTagsNorm = (completed.tags || [])
      .map((t) => normalizeText(t))
      .filter(Boolean);

    let sharedTagCount = 0;
    for (const tag of completedTagsNorm) {
      if (currentTagsNorm.has(tag)) {
        sharedTagCount++;
      }
    }

    // Qualification check
    const qualifies = sharedTagCount > 0 || categoryMatches;
    if (!qualifies) {
      continue;
    }

    // Scoring
    let score = 0;
    score += sharedTagCount * 10;
    if (categoryMatches) {
      score += 5;
    }

    const completedTitleWords = extractMeaningfulWords(completed.title);
    for (const word of completedTitleWords) {
      if (currentTitleWords.has(word)) {
        score += 1.0;
      }
    }

    const completedDescWords = extractMeaningfulWords(completed.description);
    for (const word of completedDescWords) {
      if (currentDescWords.has(word)) {
        score += 0.2;
      }
    }

    scoredProjects.push({
      project: completed,
      score,
      createdAt: completed.createdAt ? new Date(completed.createdAt).getTime() : 0
    });
  }

  // Sort descending by score, tie-break by more recently created
  scoredProjects.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.createdAt - a.createdAt;
  });

  return scoredProjects.slice(0, 2).map((item) => item.project);
};

/**
 * Handles incoming request to generate a tailored proposal using AI.
 * Authenticated via protect middleware (req.userId).
 * Rate limit: 5 requests per hour per user.
 * Exactly ONE Gemini API call using GEMINI_PROPOSAL_API_KEY.
 */
export const generateProposal = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Please log in to generate proposals." });
    }

    // 1. In-Memory Rate Limiting Check (5 per hour per user)
    if (isRateLimited(userId, "proposal")) {
      return res.status(429).json({
        message: "You've reached the AI proposal generation limit (5 per hour). Try again later."
      });
    }

    // 2. Request Validation
    const { gigId } = req.body;
    if (!gigId || !mongoose.Types.ObjectId.isValid(gigId)) {
      return res.status(400).json({ message: "A valid Gig ID is required." });
    }

    // 3. API Key check (Fail early before external calls)
    if (!process.env.GEMINI_PROPOSAL_API_KEY) {
      console.error("AI Proposal Error: GEMINI_PROPOSAL_API_KEY environment variable is missing.");
      return res.status(500).json({
        message: "AI proposal generation is currently misconfigured."
      });
    }

    // 4. Load Current Gig
    const gig = await Gig.findById(gigId).lean();
    if (!gig) {
      return res.status(404).json({ message: "Gig not found." });
    }

    // 5. Load Freelancer Profile (only name, bio)
    const freelancer = await User.findById(userId).select("name bio").lean();
    const bio = freelancer?.bio || "";
    const freelancerName = freelancer?.name || "Freelancer";

    // 6. Load Freelancer's Completed Work
    const completedBids = await Bid.find({
      bidderId: userId,
      status: "completed"
    })
      .populate({
        path: "gigId",
        select: "title category description tags price deliveryTime createdAt"
      })
      .lean();

    // Deduplicate and filter out deleted/null gigs and the current gig
    const completedGigsMap = new Map();
    for (const bid of completedBids) {
      if (bid.gigId && bid.gigId._id) {
        const gIdStr = bid.gigId._id.toString();
        if (gIdStr !== gig._id.toString() && !completedGigsMap.has(gIdStr)) {
          completedGigsMap.set(gIdStr, bid.gigId);
        }
      }
    }
    const completedGigs = Array.from(completedGigsMap.values());

    // 7. Deterministic Relevance Matching in JavaScript (max 2)
    const relevantCompletedProjects = findRelevantCompletedProjects(gig, completedGigs);

    // 8. Make exactly ONE Gemini API call via service
    const result = await generateProposalAI({
      gig: {
        title: gig.title,
        category: gig.category,
        description: gig.description,
        tags: gig.tags || [],
        price: gig.price,
        deliveryTime: gig.deliveryTime
      },
      completedProjects: relevantCompletedProjects,
      bio,
      freelancerName
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI Proposal Generation Error details:", error.message);

    if (error.message.includes("GEMINI_PROPOSAL_API_KEY")) {
      return res.status(500).json({
        message: "AI proposal generation is currently misconfigured."
      });
    }

    return res.status(502).json({
      message: "AI proposal generation failed. You can write your proposal manually."
    });
  }
};

