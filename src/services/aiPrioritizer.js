export async function evaluateTicketUrgency(category, description) {
  const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

  if (!API_KEY) {
    console.warn('REACT_APP_GEMINI_API_KEY is missing!');
    return {
      urgencyScore: 3,
      urgencyLabel: 'Medium',
      aiReasoning: 'API Key missing in environment'
    };
  }

  // Updated to gemini-2.5-flash model endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const prompt = `You are a strict campus maintenance and emergency dispatch supervisor. 
Evaluate the urgency of the following student complaint on a scale from 1 (Lowest) to 5 (Critical Emergency).

Category: ${category}
Description: ${description}

STRICT EVALUATION RULES:
- Score 5 (Critical): ANY mention of sparks, smoke, fire, burning smells, active electrical short circuits, gas leaks, or major flooding near outlets. Output urgencyLabel as "Critical".
- Score 4 (High): Leaking pipes, door lockouts, total loss of power in room without sparks/smoke, no running water. Output urgencyLabel as "High".
- Score 3 (Medium): Broken study lamp, fan speed issue, minor tap dripping, broken chair/furniture. Output urgencyLabel as "Medium".
- Score 2 (Low): Slow internet, minor scratches on desk, dirty mirror, non-urgent routine maintenance. Output urgencyLabel as "Low".
- Score 1 (Very Low): General cosmetic feedback or non-essential requests. Output urgencyLabel as "Very Low".`;

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
      const errText = await response.text();
      console.error('Gemini API Error details:', errText);
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const textOutput = data.candidates[0].content.parts[0].text;
    return JSON.parse(textOutput);

  } catch (error) {
    console.error('Gemini REST API error:', error);
    return {
      urgencyScore: 3,
      urgencyLabel: 'Medium',
      aiReasoning: 'Default fallback (AI network request failed)'
    };
  }
}