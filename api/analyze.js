// api/analyze.js

export const config = {
    maxDuration: 60, // Extension for Pro users, but helps stability on Hobby
};

export default async function handler(req, res) {
    // 1. Basic Safety Checks
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server Setup Error: GROQ_API_KEY is missing.' });
    }

    if (!prompt || prompt.length < 10) {
        return res.status(400).json({ error: 'Protocol text is too short to analyze.' });
    }

    try {
        // 2. Call Groq with Optimized Settings
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-70b-versatile", // Upgraded to 70B for much higher accuracy in medical ethics
                messages: [
                    {
                        role: "system",
                        content: `You are a Senior Indian Ethics Committee Auditor. 
                        STRICT RULES:
                        1. You must evaluate EVERY SINGLE item in the provided checklist.
                        2. Do not group items. 
                        3. If info is missing, status MUST be "Not Found".
                        4. Output ONLY valid JSON. No conversational text.`
                    },
                    { 
                        role: "user", 
                        content: prompt 
                    }
                ],
                temperature: 0.1, // Keep it factual and consistent
                max_tokens: 6000,  // High limit to prevent the checklist from cutting off
                response_format: { type: "json_object" }
            })
        });

        // 3. Handle API Failures (Rate limits, etc)
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Groq API Error:", errorData);
            
            if (response.status === 429) {
                return res.status(429).json({ error: "Rate limit reached. Please wait 1 minute." });
            }
            return res.status(response.status).json({ error: errorData.error?.message || "AI service error." });
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content;

        if (!content) {
            return res.status(500).json({ error: "AI returned an empty response." });
        }

        // 4. Robust JSON Parsing
        try {
            // Remove any potential accidental markdown if the model hallucinates it
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                content = content.substring(jsonStart, jsonEnd + 1);
            }
            
            const finalResult = JSON.parse(content);
            return res.status(200).json(finalResult);

        } catch (parseError) {
            console.error("JSON Parse Error. Raw content:", content);
            return res.status(500).json({ error: "AI response was not in valid JSON format. Try a smaller file." });
        }

    } catch (error) {
        console.error("Fetch/Network Error:", error);
        return res.status(500).json({ error: "Server connection timed out. Try again." });
    }
}
