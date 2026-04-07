// api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are an Indian Ethics Auditor. Audit every item using extremely short, telegraphic notes (max 10 words per note). Output ONLY valid JSON." 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'AI Error');

        return res.status(200).json(data.choices[0].message.content);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
