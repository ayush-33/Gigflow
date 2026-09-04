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