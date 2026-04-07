export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: API Key missing.' });
    }

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert Indian Ethics Committee Auditor. You must output ONLY valid JSON. Do not include markdown formatting like ```json. Your JSON must follow this exact structure: {\"consensus\": {\"analysis\": \"...\", \"score\": 85, \"checks\": [{\"item\": \"...\", \"status\": \"success\", \"note\": \"...\"}]}, \"chairperson\": {\"analysis\": \"...\", \"score\": 80, \"checks\": []}, \"secretary\": {\"analysis\": \"...\", \"score\": 80, \"checks\": []}, \"lawyer\": {\"analysis\": \"...\", \"score\": 80, \"checks\": []}, \"clinician\": {\"analysis\": \"...\", \"score\": 80, \"checks\": []}, \"layperson\": {\"analysis\": \"...\", \"score\": 80, \"checks\": []}}"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;
        const cleanJson = JSON.parse(content);
        res.status(200).json(cleanJson);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Audit failed. Please try again." });
    }
}
