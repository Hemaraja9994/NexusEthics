// api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'API Key missing in Vercel settings.' });
    }

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", // High speed to prevent Vercel Timeouts
                messages: [
                    {
                        role: "system",
                        content: "You are a Senior Indian Ethics Auditor. Audit every single item in the checklist provided. Output valid JSON only."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 8000, // High token count for the 80-item checklist
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Groq API Error' });
        }

        // Return the content string
        return res.status(200).json(data.choices[0].message.content);
    } catch (error) {
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
}
