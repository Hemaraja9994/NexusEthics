// api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

    if (!GROQ_API_KEY) return res.status(500).json({ error: 'API Key missing.' });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-70b-versatile", // Powerful model for deep auditing
                messages: [
                    {
                        role: "system",
                        content: "You are a Senior Indian Ethics Auditor. Audit every item. Output ONLY valid JSON."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 8000, 
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Groq Error');

        return res.status(200).json(data.choices[0].message.content);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
