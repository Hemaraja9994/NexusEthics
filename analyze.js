export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt, part } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured in Vercel environment variables' });
    }

    const systemPrompt = part === 'metadata'
        ? "You are an Indian Ethics Committee Auditor. Extract protocol metadata from the given text. Output ONLY valid JSON with no markdown formatting."
        : "You are an Indian Ethics Committee Auditor performing a point-by-point audit per ICMR guidelines. For each checklist item, give status 'Yes', 'No', or 'Not Found' and a brief observation (max 15 words). Output ONLY valid JSON with no markdown formatting.";

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 4096,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Groq API error:", JSON.stringify(data));
            return res.status(response.status).json({
                error: data.error?.message || 'Groq API Error',
                details: data.error
            });
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'Empty response from AI model' });
        }

        // Parse and validate JSON
        let parsed;
        try {
            // Strip markdown code fences if present
            const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error("JSON parse error:", parseErr.message, "Raw:", content.substring(0, 500));
            return res.status(500).json({
                error: 'AI returned invalid JSON',
                raw: content.substring(0, 1000)
            });
        }

        return res.status(200).json(parsed);
    } catch (error) {
        console.error("Server error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
