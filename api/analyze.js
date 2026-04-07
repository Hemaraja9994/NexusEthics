// api/analyze.js
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

        // --- LAYER 1: Check if the API call itself was successful ---
        if (!response.ok) {
            console.error("Groq API Error Response:", data);
            return res.status(response.status).json({ error: `Groq API Error: ${data.error?.message || 'Unknown error'}` });
        }

        // --- LAYER 2: Check if 'choices' exists and is not empty ---
        if (!data.choices || data.choices.length === 0) {
            console.error("Groq Response Missing 'choices':", data);
            return res.status(500).json({ error: "AI returned an empty response. Please try again." });
        }

        // --- LAYER 3: Safe extraction of the content ---
        let content = data.choices[0].message?.content;

        if (!content) {
            console.error("Groq Response Missing 'content':", data);
            return res.status(500).json({ error: "AI response was empty." });
        }

        // --- LAYER 4: The JSON Cleaner (Removes markdown/extra text) ---
        try {
            const firstBracket = content.indexOf('{');
            const lastBracket = content.lastIndexOf('}');
            
            if (firstBracket !== -1 && lastBracket !== -1) {
                content = content.substring(firstBracket, lastBracket + 1);
            }
            
            const cleanJson = JSON.parse(content);
            return res.status(200).json(cleanJson);

        } catch (parseError) {
            console.error("JSON Parse Error. Raw content was:", content);
            return res.status(500).json({ error: "AI returned invalid JSON format." });
        }

    } catch (error) {
        console.error("Critical Backend Error:", error.message);
        return res.status(500).json({ error: `Internal Error: ${error.message}` });
    }
}
