// api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    // DIAGNOSTIC 1: Check if Key exists
    if (!GROQ_API_KEY) {
        console.error("!!! CRITICAL ERROR: GROQ_API_KEY is missing from Vercel Environment Variables !!!");
        return res.status(500).json({ error: 'Server configuration error: API Key missing.' });
    }

    try {
        console.log("Attempting to contact Groq API...");
        
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

        // DIAGNOSTIC 2: Check if Groq returned an error (like 401 or 429)
        if (!response.ok) {
            console.error("!!! GROQ API REJECTED THE REQUEST !!!");
            console.error("Status:", response.status);
            console.error("Groq Error Details:", JSON.stringify(data, null, 2));
            return res.status(response.status).json({ error: `Groq API Error: ${data.error?.message || 'Unknown error'}` });
        }

        // DIAGNOSTIC 3: Check if the response format is correct
        if (!data.choices || data.choices.length === 0) {
            console.error("!!! GROQ RETURNED EMPTY CHOICES !!!", JSON.stringify(data, null, 2));
            return res.status(500).json({ error: "AI returned an empty response." });
        }

        let content = data.choices[0].message?.content;
        if (!content) {
            console.error("!!! GROQ RESPONSE HAD NO CONTENT !!!", JSON.stringify(data, null, 2));
            return res.status(500).json({ error: "AI response content was empty." });
        }

        // CLEANER: Remove any markdown formatting
        try {
            const firstBracket = content.indexOf('{');
            const lastBracket = content.lastIndexOf('}');
            if (firstBracket !== -1 && lastBracket !== -1) {
                content = content.substring(firstBracket, lastBracket + 1);
            }
            const cleanJson = JSON.parse(content);
            console.log("✅ SUCCESS: AI returned valid JSON.");
            return res.status(200).json(clea
