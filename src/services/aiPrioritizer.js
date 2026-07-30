/**
 * Evaluates a complaint description using standard HTTP fetch (Zero NPM dependencies).
 */
export async function evaluateTicketUrgency(category, description) {
  const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

  // Use Gemini REST endpoint directly
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const prompt = `You are a campus maintenance supervisor. Analyze the following complaint and assign an urgency level from 1 (Lowest) to 5 (Critical Emergency).

Category: ${category}
Description: ${description}

Urgency Rules:
- Score 5 (Critical): Immediate health/safety hazards, active water flooding near electronics, total power outages, fire hazards.
- Score 4 (High): Sparks, leaking pipes, lockouts, no water supply.
- Score 3 (Medium): Broken furniture, minor plumbing leaks, broken study light.
- Score 2 (Low): Slow internet, minor scratches, non-essential repairs.
- Score 1 (Very Low): Cosmetic complaints, routine general feedback.`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          urgencyScore: {
            type: "INTEGER",
            description: "Urgency score from 1 (lowest) to 5 (highest emergency)"
          },
          urgencyLabel: {
            type: "STRING",
            description: "One of: Critical, High, Medium, Low, Very Low"
          },
          aiReasoning: {
            type: "STRING",
            description: "Brief 1-sentence justification for the score"
          }
        },
        required: ["urgencyScore", "urgencyLabel", "aiReasoning"]
      }
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract JSON response string parsed by Gemini
    const textOutput = data.candidates[0].content.parts[0].text;
    return JSON.parse(textOutput);

  } catch (error) {
    console.error('Gemini REST API error:', error);
    // Safe fallback if network drops or request fails
    return {
      urgencyScore: 3,
      urgencyLabel: 'Medium',
      aiReasoning: 'Default fallback (AI network request failed)'
    };
  }
}