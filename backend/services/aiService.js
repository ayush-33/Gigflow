import dotenv from "dotenv";
dotenv.config();

/**
 * Generates a professional freelance gig description based on user inputs.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.category
 * @param {Array<string>} params.tags
 * @param {number|string} params.price
 * @param {number|string} params.deliveryTime
 * @returns {Promise<{ description: string }>}
 */
export const generateDescription = async ({
  title,
  category,
  tags,
  price,
  deliveryTime
}) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not defined in the backend environment"
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const systemInstruction = `
You are an AI description writer for a freelance marketplace.

Write a complete, professional, natural Gig description based only on
the seller-provided Gig information.

SERVICE UNDERSTANDING:

- The Gig Title and Category define the actual service being offered.
- Seller-approved Skills provide additional capabilities or
  technologies that the seller has selected.
- Understand the actual service before writing.
- Skills are supporting context, not a keyword list.
- Use relevant skills naturally when they help explain the service.
- Do not force every skill into the description.
- Do not change the type of service because of a technology mentioned
  in the title or skills.

Example:

Title:
"Professional Logo Design for React Applications"

Category:
"Graphic Design"

Skills:
Logo Design, React, Brand Identity

This is a Graphic Design service. React describes the target environment.
Do not turn it into a React development service.

ACCURACY:

Only describe capabilities that are reasonably supported by the
Title, Category, or selected Skills.

Do not invent specific:
- features
- integrations
- databases
- APIs
- payment providers
- platforms
- hosting
- deployment
- revisions
- source code
- scripts
- files
- trained models
- documentation
- certifications
- experience
- testimonials
- guarantees
- statistics

A skill such as Python, React, WordPress, Speech-to-Text, or Machine
Learning allows you to mention that capability, but it does not
automatically mean that specific files, source code, trained models,
scripts, or other deliverables will be provided.

If a specific deliverable is not explicitly supported, describe the
service capability or intended use instead.

Do not describe the service as:
- "fully functional"
- "production-ready"
- "complete"
- "ready to deploy"

unless the provided Gig information explicitly supports that claim.

Do not claim "seamless integration", "guaranteed results",
"reliable performance", or similar outcomes unless explicitly
supported.

PRICE AND DELIVERY:

Price and delivery time are contextual information only.

Do not automatically mention them.

Do not infer service scope, complexity, guarantees, or deliverables
from the price or delivery time.

DESCRIPTION FORMAT:

The final description MUST contain between 120 and 150 words.

Use exactly this structure:

1. Opening paragraph:
Write 2-3 natural sentences explaining the actual service,
its purpose, and the type of buyer or project it is intended for.

2. Write this exact heading:

What this service includes:

3. Write 3-5 concise bullet points using the "•" character.

Each bullet must describe a relevant capability, service aspect,
or explicitly supported deliverable.

4. Closing paragraph:
Write 1-2 natural sentences summarizing the service,
its purpose, or its intended use.

Do not invent a specific deliverable in the closing.

COMPLETENESS:

The description MUST contain all sections.

Never stop after the opening paragraph.

Never return a partial description.

Never end in the middle of a sentence.

Keep the description between 120 and 150 words.

Do not add unnecessary filler simply to reach the word count.

WRITING STYLE:

Use professional, natural, buyer-friendly freelance marketplace
language.

Do not simply repeat the Gig title.

Do not mechanically list all skills.

Do not keyword-stuff.

Do not repeatedly begin sentences with "I will".

Avoid exaggerated marketing language such as:
- world-class
- best
- amazing
- unparalleled
- guaranteed
- 100% satisfaction

unless explicitly supported by the provided information.

OUTPUT:

Return ONLY the completed description.

Do not return:
- JSON
- analysis
- explanations
- notes
- conversational introductions
- Markdown code fences
- "Here is your description:"
- "Sure!"

The response must be ready to place directly into the Gig
description textarea.
`;

  const promptText = `
Write the complete Gig description now.

The final description MUST contain between 120 and 150 words.

It MUST contain:

1. An opening paragraph
2. The exact heading:
   What this service includes:
3. 3-5 bullet points
4. A closing paragraph

Use the seller-provided information as the source of truth.

Gig Information:

Title:
"${title}"

Category:
"${category}"

Seller-approved Skills:
${tags && tags.length ? tags.join(", ") : "None"}

Price:
${price || "Not specified"}

Delivery Time:
${deliveryTime || "Not specified"} days

Remember:
- Title and Category define the actual service.
- Skills provide supported capabilities.
- Use relevant skills naturally.
- Do not invent unsupported capabilities or deliverables.
- Complete every required section.
- Return only the final description.
`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      thinkingConfig: {
        thinkingLevel: "minimal"
      }

    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Gemini API error: ${response.status} - ${errorBody}`
    );
  }

  const data = await response.json();

  const candidate = data.candidates?.[0];

  const finishReason = candidate?.finishReason;

  const generatedText =
    candidate?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(
      `Gemini API response did not contain generated text${finishReason
        ? ` (finishReason: ${finishReason})`
        : ""
      }`
    );
  }

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini description generation was incomplete because the output token limit was reached."
    );
  }

  if (finishReason === "SAFETY") {
    throw new Error(
      "Gemini description generation was stopped by the safety system."
    );
  }

  const sanitized = sanitizeText(generatedText);

  if (!sanitized) {
    throw new Error(
      "Gemini API response did not contain valid text after sanitization"
    );
  }

  return {
    description: sanitized
  };
};

/**
 * Conservatively sanitizes model output.
 * Removes only outer markdown fences and common conversational prefixes.
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  let clean = text.trim();

  // Remove outer Markdown code fences.
  clean = clean.replace(/^```(?:markdown|text)?\s*/i, "");
  clean = clean.replace(/\s*```$/i, "");
  clean = clean.trim();

  // Remove common conversational prefixes.
  const prefixes = [
    /^sure,\s*(here's|here\s+is)\s*the\s*description:?\s*/i,
    /^here\s*is\s*(your|the|a|a\s+professional)?\s*description:?\s*/i,
    /^here\s*is\s*(your|the)\s*generated\s*description:?\s*/i,
    /^description:\s*/i
  ];

  for (const prefix of prefixes) {
    if (prefix.test(clean)) {
      clean = clean.replace(prefix, "");
      break;
    }
  }

  return clean.trim();
};

/**
 * Recommends highly relevant skills based on the Gig title,
 * category and existing skills.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.category
 * @param {Array<string>} params.existingSkills
 * @returns {Promise<{ skills: Array<string> }>}
 */
export const generateSuggestedSkills = async ({
  title,
  category,
  existingSkills
}) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not defined in the backend environment"
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const systemInstruction = `You are an AI skill recommendation assistant for a freelance marketplace.

Your task is to recommend relevant skills, technologies, tools, or techniques for a Freelance Gig based on its Title and Category.

Inputs:
- Gig Title
- Gig Category
- Existing Skills (which are already selected by the user)

Rules:

1. Understand the service described by the Title.
2. Use the Category as contextual information.
3. Recommend only highly relevant skills, technologies, tools, or techniques.
4. Avoid unrelated skills, random popular technologies, or overly broad terms.
5. Do NOT invent requirements that are not reasonably implied by the title or category.
6. Do NOT recommend seller credentials, experience, or personal qualities.
7. Do NOT duplicate or include any skills already present in the Existing Skills list.
8. Focus on relevance over quantity.
9. Return UP TO 8 highly relevant suggestions. If fewer than 8 skills are genuinely relevant, return only those.
10. Return the output strictly as a JSON object containing a "skills" array of strings.

Example:

{
  "skills": ["React", "JavaScript", "Responsive Web Design"]
}`;

  const promptText = `Inputs:
- Title: "${title}"
- Category: "${category}"
- Existing Skills: ${JSON.stringify(existingSkills)}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Gemini API error: ${response.status} - ${errorBody}`
    );
  }

  const data = await response.json();

  const generatedText =
    data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(
      "Gemini API response did not contain generated text"
    );
  }

  let parsed;

  try {
    const cleanJsonText = generatedText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();

    parsed = JSON.parse(cleanJsonText);
  } catch (err) {
    throw new Error(
      "Failed to parse Gemini API JSON response: " +
      err.message
    );
  }

  if (!parsed || !Array.isArray(parsed.skills)) {
    throw new Error(
      "Gemini API response did not contain an array of skills"
    );
  }

  const skills = parsed.skills
    .map((skill) =>
      typeof skill === "string"
        ? skill.trim()
        : ""
    )
    .filter(Boolean);

  // Remove duplicate suggestions case-insensitively.
  const uniqueSkills = [];
  const seen = new Set();

  for (const skill of skills) {
    const normalized = skill.toLowerCase();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueSkills.push(skill);
    }
  }

  // Remove skills that are already selected.
  const existingSet = new Set(
    existingSkills.map((skill) =>
      skill.toLowerCase()
    )
  );

  const finalSkills = uniqueSkills.filter(
    (skill) =>
      !existingSet.has(skill.toLowerCase())
  );

  return {
    skills: finalSkills.slice(0, 8)
  };
};

/**
 * Conservatively sanitizes model output for proposals.
 * Removes outer markdown fences and common conversational prefixes.
 */
export const sanitizeProposalText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  let clean = text.trim();

  // Remove outer Markdown code fences
  clean = clean.replace(/^```(?:markdown|text)?\s*/i, "");
  clean = clean.replace(/\s*```$/i, "");
  clean = clean.trim();

  // Remove common conversational and labeling prefixes
  const prefixes = [
    /^sure[!,\.]?\s*(here's|here\s+is)\s*(your|the|a|a\s+custom|a\s+tailored)?\s*proposal:?\s*/i,
    /^here\s*is\s*(your|the|a|a\s+custom|a\s+tailored)?\s*proposal:?\s*/i,
    /^here\s*is\s*(your|the)\s*generated\s*proposal:?\s*/i,
    /^proposal:\s*/i,
    /^subject:\s*proposal\s*for\s*.*?\n+/i
  ];

  for (const prefix of prefixes) {
    if (prefix.test(clean)) {
      clean = clean.replace(prefix, "");
      break;
    }
  }

  return clean.trim();
};

/**
 * Generates an AI-tailored proposal for a freelancer placing a bid on a gig.
 * Uses GEMINI_PROPOSAL_API_KEY completely separately from GEMINI_API_KEY.
 *
 * Experience rule:
 * - If the backend provides relevant completed projects, the proposal MUST
 *   mention at least one of them.
 * - Relevance is based on matching skills/tags or category.
 * - If no relevant completed projects exist, no previous experience is claimed.
 *
 * @param {Object} params
 * @param {Object} params.gig - Current gig details
 * @param {Array<Object>} params.completedProjects - Relevant completed projects
 * @param {string} [params.bio] - Freelancer bio
 * @param {string} [params.freelancerName] - Freelancer name
 * @returns {Promise<{ proposal: string }>}
 */
/**
 * Generates an AI-tailored proposal for a freelancer placing a bid on a gig.
 *
 * Experience rules:
 * - Relevant completed projects are supplied by the controller.
 * - If relevant projects exist, AI MUST mention at least one.
 * - Relevance can be based on matching skills/tags OR category.
 * - If no relevant projects exist, AI MUST NOT mention previous experience.
 *
 * AI proposal limit:
 * - Target: 1000–1150 characters
 * - Hard limit: 1200 characters
 * - Frontend can still allow up to 1500 characters.
 *
 * Uses GEMINI_PROPOSAL_API_KEY separately from GEMINI_API_KEY.
 */
export const generateProposal = async ({
  gig,
  completedProjects = [],
  freelancerName = ""
}) => {
  // Proposal AI uses ONLY the proposal-specific API key.
  const apiKey = process.env.GEMINI_PROPOSAL_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_PROPOSAL_API_KEY is not defined in the backend environment"
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const hasRelevantExperience =
    Array.isArray(completedProjects) &&
    completedProjects.length > 0;

  // Normalize values only for displaying the matching evidence
  // to Gemini. The controller is responsible for selecting
  // relevant completed projects.
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const currentTags = new Set(
    (Array.isArray(gig?.tags) ? gig.tags : [])
      .map(normalize)
      .filter(Boolean)
  );

  const currentCategory = normalize(gig?.category);

  const completedProjectsText = hasRelevantExperience
    ? completedProjects
      .slice(0, 2)
      .map((project, index) => {
        const projectTags = Array.isArray(project?.tags)
          ? project.tags.map(normalize).filter(Boolean)
          : [];

        const sharedSkills = projectTags.filter((tag) =>
          currentTags.has(tag)
        );

        const categoryMatches =
          currentCategory &&
          normalize(project?.category) === currentCategory;

        return `PROJECT ${index + 1}
Title: ${project?.title || "Not provided"}
Category: ${project?.category || "Not provided"}
Description: ${project?.description || "Not provided"}
Skills/Tags: ${Array.isArray(project?.tags) && project.tags.length
            ? project.tags.join(", ")
            : "None"
          }
MATCHED SKILLS/TAGS: ${sharedSkills.length ? sharedSkills.join(", ") : "None"
          }
MATCHED CATEGORY: ${categoryMatches ? "Yes" : "No"}`;
      })
      .join("\n\n")
    : "NONE";

  const systemInstruction = `
You are an expert freelance proposal writer for the GigFlow marketplace.

Write ONE professional, natural and personalized proposal for a
freelancer applying to the CURRENT GIG.

The CURRENT GIG is always the primary focus.

EXPERIENCE RULE — CRITICAL:

If RELEVANT COMPLETED PROJECTS are provided:

- You MUST mention at least ONE relevant completed project.
- Prefer the strongest relevant project.
- Mention its actual project title or accurately describe its actual type.
- Explain briefly why that project is relevant to the CURRENT GIG.
- Use the matched skills/tags or category when useful.
- The previous project must remain factually accurate.
- NEVER change the previous project's actual type.
- NEVER claim the freelancer completed the current gig previously unless
  the provided project actually was that type.
- Do not simply list the project. Connect the experience to the current gig.

Example:

Previous project:
Weather Website
Skills: React, Node.js, Responsive Design
Category: Web Development

Current gig:
Portfolio Website
Skills: React, Node.js, Responsive Design
Category: Web Development

Good:
"I recently built a weather website using React, Node.js and responsive
design, giving me relevant experience for your portfolio project."

Bad:
"I have previously built portfolio websites."

If NO RELEVANT COMPLETED PROJECTS are provided:

- Do NOT mention previous projects.
- Do NOT claim previous experience.
- Do NOT say the freelancer has completed similar work.
- Do NOT imply experience that was not provided.
- Focus only on the CURRENT GIG, its requirements and the approach.

ANTI-HALLUCINATION:

Never invent:
- previous projects
- clients
- years of experience
- certifications
- degrees
- awards
- achievements
- technologies
- skills
- tools
- deliverables
- results
- guarantees

Only mention previous experience using information explicitly provided
in RELEVANT COMPLETED PROJECTS.

WRITING STYLE:

- First person.
- Professional and confident.
- Natural and client-focused.
- Show clear understanding of the CURRENT GIG.
- Avoid generic filler.
- Avoid keyword stuffing.
- Do not copy the gig description word-for-word.
- Do not overuse "I will".
- Use 2–3 short paragraphs.
- End with a natural call to action.

LENGTH RULE — CRITICAL:

- Maximum 1200 characters INCLUDING spaces and punctuation.
- Aim for approximately 1000–1150 characters.
- Do not try to fill the full 1500-character frontend limit.
- Always finish complete sentences.
- Never intentionally exceed 1200 characters.

OUTPUT:

Return ONLY the final proposal text.

Do NOT include:
- "Sure! Here is your proposal"
- "Here is your proposal"
- "Proposal:"
- Markdown code fences
- Explanations
- Notes
- Analysis
`;

  const promptText = `
Create the final proposal now.

CURRENT GIG:
Title: "${gig?.title || ""}"
Category: "${gig?.category || ""}"
Description: "${gig?.description || ""}"
Skills/Tags: ${Array.isArray(gig?.tags) && gig.tags.length
      ? gig.tags.join(", ")
      : "None"
    }

FREELANCER:
Name: "${freelancerName || "Freelancer"}"

RELEVANT COMPLETED PROJECTS:
${completedProjectsText}

GENERATION RULE:

${hasRelevantExperience
      ? `Relevant previous work IS available.

You MUST mention at least ONE of the provided projects.
Choose the strongest match and naturally explain how its actual
skills, technologies, category, or transferable experience applies
to the CURRENT GIG.

Do not invent anything about the previous project.`
      : `NO relevant previous work is available.

Do NOT mention previous projects or previous experience.
Focus entirely on the CURRENT GIG and explain how the freelancer
would approach the requested work.`
    }

The proposal should be approximately 1000–1150 characters and MUST
NEVER exceed 1200 characters.

Return ONLY the proposal text.
`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],

    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },

    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      thinkingConfig: {
        thinkingLevel: "minimal"
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  console.log("Gemini status:", response.status);

  const responseBody = await response.text();

  console.log("Gemini response:", responseBody);
  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${response.status} - ${responseBody}`
    );
  }

  const data = JSON.parse(responseBody);

  const finishReason = data.candidates?.[0]?.finishReason;

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini proposal generation was truncated. Please try again."
    );
  }

  const generatedText =
    data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(
      "Gemini API response did not contain generated proposal text"
    );
  }

  const sanitized = sanitizeProposalText(generatedText);

  if (!sanitized) {
    throw new Error(
      "Gemini API response did not contain valid proposal text after sanitization"
    );
  }

  // AI-specific hard limit.
  // Frontend may still allow 1500 characters.
  if (sanitized.length > 1200) {
    throw new Error(
      "Generated proposal exceeds the 1200-character AI limit."
    );
  }

  return {
    proposal: sanitized
  };
};