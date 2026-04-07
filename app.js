// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, aggregatedText = "", auditData = null;
let protocolMetadata = { number: "Not Detected", title: "Not Detected", pi: "Not Detected", coInvestigators: "Not Detected", dept: "Not Detected", studyType: "Not Detected", sites: "Not Detected", sampleSize: "Not Detected" };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GOOGLE DRIVE ---
function gapiLoaded() { gapi.load('client', async () => { await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }); }); }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '' }); }
window.onload = () => { gapiLoaded(); gisLoaded(); };
function handleAuthClick() {
    tokenClient.callback = async (resp) => { if (resp.error) return; document.getElementById('driveBtn').innerText = "Drive Active"; saveToDrive(); };
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

// --- 3. UI HANDLERS ---
function setPersona(p) {
    currentPersona = p;
    document.querySelectorAll('.role-link').forEach(b => b.classList.remove('role-active'));
    const el = document.getElementById(`p-${p}`);
    if (el) el.classList.add('role-active');
    if (auditData) renderResult();
}

function setCategory(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    const el = document.getElementById(`cat-${cat}`);
    if (el) el.classList.add('cat-active');
}

// --- 4. MULTI-FORMAT PARSER ---
const fileInput = document.getElementById('fileInput');
document.getElementById('dropZone').onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    aggregatedText = "";
    document.getElementById('fileStatus').innerHTML = "";
    for (const file of files) {
        const div = document.createElement('div');
        div.className = "text-[9px] font-bold text-orange-600";
        div.innerText = `Parsing ${file.name}...`;
        document.getElementById('fileStatus').appendChild(div);
        try {
            let text = "";
            if (file.type === "application/pdf") text = await parsePDF(file);
            else if (file.type.includes("word") || file.name.endsWith('.docx')) text = await parseWord(file);
            else if (file.type.startsWith("image/")) text = await parseImage(file);
            else text = await file.text();
            aggregatedText += `\n[FILE: ${file.name}]\n${text}\n`;
            div.innerText = `Loaded: ${file.name}`;
            div.className = "text-[9px] font-bold text-emerald-600";
        } catch (err) {
            div.innerText = `Error: ${file.name} - ${err.message}`;
            div.className = "text-[9px] font-bold text-red-600";
        }
    }
};

async function parsePDF(f) {
    const buf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let t = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        t += content.items.map(s => s.str).join(" ") + "\n";
    }
    return t;
}
async function parseWord(f) { const buf = await f.arrayBuffer(); const res = await mammoth.extractRawText({ arrayBuffer: buf }); return res.value; }
async function parseImage(f) { const res = await Tesseract.recognize(f, 'eng'); return res.data.text; }

// --- 5. CHUNKED AUDIT ENGINE ---
// Splits the 80-item audit into focused API calls for reliable complete output

async function callAPI(prompt, part) {
    const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, part })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API error ${res.status}`);
    }
    return await res.json();
}

function updateProgress(msg) {
    const el = document.getElementById('progressStatus');
    if (el) el.innerText = msg;
}

async function executeAnalysis() {
    if (!aggregatedText) return alert("Upload protocol documents first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true;
    btn.innerText = "FULL AUDIT IN PROGRESS...";
    document.getElementById('progressBar')?.classList.remove('hidden');

    const docText = aggregatedText.substring(0, 20000);

    try {
        // STEP 1: Extract metadata
        updateProgress("Step 1/5: Extracting protocol metadata...");
        const metaPrompt = `Extract protocol identification details from this text. Output JSON:
{
  "number": "protocol number or Not Found",
  "title": "full study title",
  "pi": "principal investigator name",
  "coInvestigators": "co-investigator names or Not Found",
  "dept": "department and institution",
  "studyType": "type of study (clinical trial, PhD, PG, etc.)",
  "sites": "number of sites or Not Found",
  "sampleSize": "planned sample size or Not Found"
}

TEXT: ${docText.substring(0, 5000)}`;

        const meta = await callAPI(metaPrompt, 'metadata');
        protocolMetadata = { ...protocolMetadata, ...meta };

        // STEP 2: Part A - Scientific Issues (16 items)
        updateProgress("Step 2/5: Auditing Part A - Scientific Issues...");
        const partAPrompt = `Audit Part A: Scientific Issues for this ethics protocol. Check ALL 16 items:
1. Background and need sufficient
2. Aims/objectives clear and well-defined
3. Study design appropriate
4. Sample size adequate and justified
5. Statistical tests described
6. Inclusion criteria appropriate
7. Exclusion criteria appropriate
8. Discontinuation criteria appropriate
9. Research tool is validated
10. Team qualification and expertise adequate
11. Infrastructure adequate
12. Plan for medical management of study-related injury
13. Methodology for intervention adequately described
14. Methodology for data collection provided
15. Data collection form appropriate
16. Informed consent process details (who, where, how long, privacy)

For EACH item output: {"item": "...", "status": "Yes/No/Not Found", "note": "brief observation max 15 words", "part": "A"}

Output JSON: {"checks": [...all 16 items...]}

PROTOCOL TEXT: ${docText}`;

        const partA = await callAPI(partAPrompt, 'partA');

        // STEP 3: Part B - Ethical Issues (15 items + vulnerability sub-items)
        updateProgress("Step 3/5: Auditing Part B - Ethical Issues & Risk-Benefit...");
        const partBPrompt = `Audit Part B: Ethical Issues for this ethics protocol. Check ALL items:
1. Method of sampling is fair
2. Inclusion of vulnerable populations (with justification)
3. Safeguards for vulnerable population protection
4. Autonomy measures for vulnerable population
5. Exclusion criteria justified
6. Discontinuation criteria justified
7. Withdrawal criteria clear
8. Voluntary non-coercive participation ensured
9. Standard of care - intervention group
10. Standard of care - control group
11. Placebo justification (if applicable)
12. Inducements, financial benefits, compensation to participants
13. Protection of privacy of participants
14. Confidentiality of data/samples/genomic data
15. Disposal, storing, sharing, reuse of samples/data
16. Declaration of conflict of interest
17. Compensation for AE/SAE

For EACH item: {"item": "...", "status": "Yes/No/Not Found", "note": "brief observation max 15 words", "part": "B"}

Output JSON: {"checks": [...all items...], "riskMatrix": {"magnitude": "Negligible/Small/Significant/Serious", "risk": "Less than minimal/Minimal/Minor increase/Major increase"}}

PROTOCOL TEXT: ${docText}`;

        const partB = await callAPI(partBPrompt, 'partB');

        // STEP 4: Parts C & D - Social/Cultural & Legal
        updateProgress("Step 4/5: Auditing Parts C & D - Social/Legal Issues...");
        const partCDPrompt = `Audit Parts C and D for this ethics protocol.

PART C - Social, Cultural, Religious Issues:
1. Social value of the study
2. Community involvement from the start
3. Cultural issues identified
4. Religious issues identified
5. Any other social issues

PART D - Legal Aspects:
1. Clinical trial agreement
2. Compensation plan
3. Permission letters for transport of samples (MTA)
4. Insurance policies
5. Insurance certificate
6. Regulatory approval (DCGI/HMSC)
7. Budget
8. Any other legal issues

For EACH item: {"item": "...", "status": "Yes/No/Not Found", "note": "brief observation max 15 words", "part": "C" or "D"}

Output JSON: {"checks": [...all items...]}

PROTOCOL TEXT: ${docText}`;

        const partCD = await callAPI(partCDPrompt, 'partCD');

        // STEP 5: Part E & F - PIS (23 items) + ICF (20 items)
        updateProgress("Step 5/5: Auditing Parts E & F - PIS & ICF Checklist...");
        const partEFPrompt = `Audit Parts E and F: PIS and ICF Checklist for this ethics protocol.

PART E - Participant Information Sheet (23 items):
1. PIS written in simple language (8th standard level, no jargon)
2. Study title, investigator names, total participants, number of sites match protocol
3. Information that this is research and not therapy
4. Statement on why participant is being recruited
5. Details on eligibility during screening
6. Duration of study and participant responsibilities
7. Voluntary enrollment; right to refuse; right to withdraw without prejudice
8. Details on intervention in simple, clear, non-misleading language
9. Benefits to participant (direct) or community (indirect)
10. Lab tests, storage of tissues/samples, sharing, disposal details
11. Assurance of participant privacy and data confidentiality
12. Sharing of research results with participant
13. Risks of adverse events from intervention/procedure
14. How PI will handle research-related injuries
15. Reimbursement for time spent and trouble taken
16. Cost and compensation in case of SAE (including death)
17. Nominee details in case of compensation payment
18. Privacy protection in presentation, publication, photographs
19. Adequacy of time for comprehension; assessment of comprehension; liberty to ask questions
20. Contact details of responsible research team member trained in biomedical research/GCP
21. Research team members' conflict of interest or receipt of funds
22. Contact details of Member-Secretary YEC-4 for participant rights queries
23. Statement that copy of PIS and ICF will be given to participant

PART F - Informed Consent Form (20 items):
1. Participant provided enough information (study title, PI name)
2. ICF written in language local communities are conversant with
3. Adequate time to understand implications of consenting
4. Opportunity to ask questions to PI/study team (contact details)
5. Assessment of comprehension of participant
6. Voluntary nature of consent, free of coercion
7. Option to refuse without compromising patient rights
8. Option to voluntarily withdraw at any stage without prejudice
9. Option to retain one copy of consent form
10. Assurance of privacy and confidentiality and who can access
11. Consent to publish data anonymously
12. Consent to take photographs while protecting privacy
13. Provision for signatures of participant and researcher; thumb impression for illiterate
14. English version of ICF with version number
15. Local language translation and back-translation with version number
16. Certificates of translation and back-translation
17. Provision for informed assent (minor 12-18 written, 7-12 oral) with parental/LAR consent
18. Provision for audio-visual consent for vulnerable populations
19. Provision for audio recording of consent for HIV/leprosy populations
20. Provision for online/telephonic/oral consent in relevant situations

For EACH item: {"item": "...", "status": "Yes/No/Not Found", "note": "brief observation max 15 words", "part": "E" or "F"}

Output JSON: {"checks": [...all 43 items...]}

PROTOCOL TEXT: ${docText}`;

        const partEF = await callAPI(partEFPrompt, 'partEF');

        // COMBINE ALL RESULTS
        const allChecks = [
            ...(partA.checks || []),
            ...(partB.checks || []),
            ...(partCD.checks || []),
            ...(partEF.checks || [])
        ];

        const yesCount = allChecks.filter(c => (c.status || "").toLowerCase().includes('yes')).length;
        const totalCount = allChecks.length || 1;
        const score = Math.round((yesCount / totalCount) * 100);

        const riskMatrix = partB.riskMatrix || { magnitude: "Not assessed", risk: "Not assessed" };

        // Build analysis summary
        const analysis = `COMPREHENSIVE ETHICS AUDIT SUMMARY\n\n` +
            `Protocol: ${protocolMetadata.title}\n` +
            `PI: ${protocolMetadata.pi}\n` +
            `Department: ${protocolMetadata.dept}\n\n` +
            `Total items audited: ${totalCount}\n` +
            `Compliant (Yes): ${yesCount}\n` +
            `Non-compliant/Not Found: ${totalCount - yesCount}\n` +
            `Compliance Score: ${score}%\n\n` +
            `Risk Assessment: ${riskMatrix.magnitude} magnitude, ${riskMatrix.risk} risk level.\n\n` +
            `Part A (Scientific): ${(partA.checks||[]).length} items checked\n` +
            `Part B (Ethical): ${(partB.checks||[]).length} items checked\n` +
            `Parts C/D (Social/Legal): ${(partCD.checks||[]).length} items checked\n` +
            `Parts E/F (PIS/ICF): ${(partEF.checks||[]).length} items checked`;

        const auditResult = {
            analysis,
            score,
            checks: allChecks,
            riskMatrix
        };

        // Map to all personas (same data, different labels)
        auditData = {
            metadata: protocolMetadata,
            consensus: auditResult,
            chairperson: { ...auditResult, analysis: "[CHAIRPERSON VIEW]\n" + auditResult.analysis },
            secretary: { ...auditResult, analysis: "[MEMBER SECRETARY VIEW]\n" + auditResult.analysis },
            lawyer: { ...auditResult, analysis: "[LEGAL EXPERT VIEW]\n" + auditResult.analysis },
            clinician: { ...auditResult, analysis: "[SCIENTIST/CLINICIAN VIEW]\n" + auditResult.analysis },
            layperson: { ...auditResult, analysis: "[LAYPERSON VIEW]\n" + auditResult.analysis }
        };

        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        document.getElementById('progressBar')?.classList.add('hidden');
        renderResult();

    } catch (e) {
        console.error("Audit error:", e);
        alert("Audit Error: " + e.message + "\n\nPlease check that GROQ_API_KEY is set in Vercel environment variables.");
        document.getElementById('progressBar')?.classList.add('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = "Begin Audit Session";
    }
}

// --- 6. RENDER RESULTS ---
function renderResult() {
    if (!auditData) return;
    const data = auditData[currentPersona] || auditData.consensus;

    document.getElementById('viewLabel').innerText = currentPersona;
    document.getElementById('roleTitle').innerText = currentPersona.toUpperCase() + " PERSPECTIVE";
    document.getElementById('roleAnalysis').innerText = data.analysis || "Audit summary not available.";
    document.getElementById('totalScore').innerText = (data.score || 0) + "%";

    // Stats
    const checks = data.checks || [];
    const yesCount = checks.filter(c => (c.status||"").toLowerCase().includes('yes')).length;
    const noCount = checks.filter(c => (c.status||"").toLowerCase() === 'no').length;
    const nfCount = checks.filter(c => (c.status||"").toLowerCase().includes('not')).length;

    const statsEl = document.getElementById('auditStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="text-emerald-600 font-bold">${yesCount} Compliant</span> |
            <span class="text-red-600 font-bold">${noCount} Non-compliant</span> |
            <span class="text-amber-600 font-bold">${nfCount} Not Found</span> |
            <span class="text-slate-600 font-bold">${checks.length} Total</span>
        `;
    }

    // Group by part
    const parts = { A: [], B: [], C: [], D: [], E: [], F: [] };
    checks.forEach(c => {
        const p = (c.part || "A").toUpperCase();
        if (parts[p]) parts[p].push(c);
    });

    let html = "";
    const partNames = {
        A: "PART A: SCIENTIFIC ISSUES",
        B: "PART B: ETHICAL ISSUES",
        C: "PART C: SOCIAL & CULTURAL ISSUES",
        D: "PART D: LEGAL ASPECTS",
        E: "PART E: PIS CHECKLIST",
        F: "PART F: ICF CHECKLIST"
    };

    for (const [key, items] of Object.entries(parts)) {
        if (items.length === 0) continue;
        html += `<div class="mb-4"><h4 class="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">${partNames[key]}</h4>`;
        items.forEach((c, i) => {
            const status = (c.status || "").toLowerCase();
            const type = (status.includes('yes') || status.includes('pass')) ? 'success' : status.includes('not') ? 'modify' : 'scrutinize';
            html += `<div class="${type} shadow-sm border border-navy/5 p-3 rounded-lg mb-2">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="text-[7px] font-bold uppercase opacity-40">Part ${c.part || key} - Item ${i + 1}</p>
                        <p class="text-[9px] font-bold text-navy">${c.item}</p>
                        <p class="text-[10px] mt-1 text-slate-600">${c.note || ''}</p>
                    </div>
                    <span class="text-[8px] font-black px-2 py-1 rounded ${type === 'success' ? 'bg-emerald-100 text-emerald-700' : type === 'modify' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}">${c.status}</span>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    document.getElementById('checklistItems').innerHTML = html;
    updateChart(data.score || 0);
}

let chart;
function updateChart(score) {
    const canvas = document.getElementById('scoreChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [score, 100 - score], backgroundColor: ['#F97316', '#F1F5F9'], borderWidth: 0, cutout: '82%' }] }
    });
}

// --- 7. EXPORT PDF (Multi-Page with Full Checklist) ---
function exportPDF() {
    if (!auditData) return alert("Run audit first.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona] || auditData.consensus;

    const drawHeader = (pageTitle) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255);
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.text("NEXUS ETHICS AI", 105, 16, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("Formal Reviewer Assessment Form (Comprehensive Audit)", 105, 24, { align: "center" });
        doc.setFontSize(7);
        doc.text("Conceptualized and Academic Designed by Mr. Hemaraja Nayaka.S", 105, 30, { align: "center" });
        if (pageTitle) {
            doc.setFontSize(8); doc.setFont("helvetica", "bold");
            doc.text(pageTitle, 105, 37, { align: "center" });
        }
    };

    // PAGE 1: Protocol Identification
    drawHeader();
    let y = 50;
    doc.setTextColor(0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("SECTION 1: PROTOCOL IDENTIFICATION", 14, y);

    doc.autoTable({
        startY: y + 4,
        body: [
            ["Protocol Number", protocolMetadata.number || "Not Found"],
            ["Title of Study", protocolMetadata.title || "Not Found"],
            ["Principal Investigator", protocolMetadata.pi || "Not Found"],
            ["Co-Investigators", protocolMetadata.coInvestigators || "Not Found"],
            ["Department", protocolMetadata.dept || "Not Found"],
            ["Type of Study", protocolMetadata.studyType || "Not Found"],
            ["Number of Sites", protocolMetadata.sites || "Not Found"],
            ["Sample Size", protocolMetadata.sampleSize || "Not Found"],
            ["Reviewer Persona", currentPersona.toUpperCase()],
            ["Compliance Score", data.score + "%"]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
    });

    y = doc.lastAutoTable.finalY + 12;

    // RENDER EACH PART
    const partNames = {
        A: "PART A: SCIENTIFIC ISSUES",
        B: "PART B: ETHICAL ISSUES & RISK-BENEFIT ANALYSIS",
        C: "PART C: SOCIAL & CULTURAL ISSUES",
        D: "PART D: LEGAL ASPECTS",
        E: "PART E: PIS CHECKLIST",
        F: "PART F: INFORMED CONSENT CHECKLIST"
    };

    const renderPart = (partCode, partTitle) => {
        const filtered = (data.checks || []).filter(c => (c.part || "").toUpperCase() === partCode);
        if (filtered.length === 0) return;

        if (y > 230) { doc.addPage(); drawHeader(partTitle); y = 50; }

        doc.setTextColor(0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(partTitle, 14, y);

        doc.autoTable({
            startY: y + 4,
            head: [['S.No', 'Assessment Criteria', 'Status', 'Reviewer Observations']],
            body: filtered.map((c, i) => [i + 1, c.item, c.status, c.note || '']),
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 7, fontStyle: 'bold' },
            styles: { fontSize: 7, cellPadding: 2.5, lineHeight: 1.2 },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 2: { cellWidth: 22 }, 3: { cellWidth: 88 } },
            didDrawPage: () => { drawHeader(partTitle); }
        });
        y = doc.lastAutoTable.finalY + 12;
    };

    for (const [code, title] of Object.entries(partNames)) {
        renderPart(code, title);
    }

    // RISK MATRIX
    if (data.riskMatrix) {
        if (y > 230) { doc.addPage(); drawHeader(); y = 50; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("RISK MAGNITUDE MATRIX", 14, y);
        doc.autoTable({
            startY: y + 4,
            head: [['Magnitude of Harm', 'Less than Minimal', 'Minimal', 'Minor Increase', 'Major Increase']],
            body: [
                ['Negligible', data.riskMatrix.magnitude === 'Negligible' ? 'Detected' : '-', '-', '-', '-'],
                ['Small', data.riskMatrix.magnitude === 'Small' ? 'Detected' : '-', '-', '-', '-'],
                ['Significant', '-', '-', data.riskMatrix.magnitude === 'Significant' ? 'Detected' : '-', '-'],
                ['Serious', '-', '-', '-', data.riskMatrix.magnitude === 'Serious' ? 'Detected' : '-']
            ],
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 7, cellPadding: 2 }
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    // EXECUTIVE SUMMARY
    if (y > 230) { doc.addPage(); drawHeader(); y = 50; }
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE SUMMARY & FINAL DELIBERATION:", 14, y);
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.analysis || "No summary available.", 180);
    doc.text(lines, 14, y + 8);

    // Footer on last page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(128);
        doc.text(`Page ${i} of ${pageCount} | Nexus Ethics AI - System Generated Formal Audit | Confidential`, 105, 290, { align: "center" });
    }

    doc.save(`Nexus_Ethics_Detailed_Audit_${Date.now()}.pdf`);
}

// --- 8. EXPORT WORD ---
function exportWord() {
    if (!auditData) return alert("Run audit first.");
    const data = auditData[currentPersona] || auditData.consensus;
    const checks = data.checks || [];

    const rows = [
        new docx.TableRow({
            children: ["S.No", "Assessment Criteria", "Part", "Status", "Observations"].map(text =>
                new docx.TableCell({
                    children: [new docx.Paragraph({ children: [new docx.TextRun({ text, bold: true, size: 18, color: "FFFFFF" })] })],
                    shading: { fill: "F97316" }
                })
            )
        })
    ];

    checks.forEach((c, i) => {
        rows.push(new docx.TableRow({
            children: [
                String(i + 1), c.item || '', c.part || '', c.status || '', c.note || ''
            ].map(text =>
                new docx.TableCell({
                    children: [new docx.Paragraph({ children: [new docx.TextRun({ text, size: 16 })] })]
                })
            )
        }));
    });

    const doc = new docx.Document({
        sections: [{
            children: [
                new docx.Paragraph({ children: [new docx.TextRun({ text: "NEXUS ETHICS AI", bold: true, size: 36 })] }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: "Formal Reviewer Assessment Form (Comprehensive Audit)", size: 20 })] }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: `Conceptualized by Mr. Hemaraja Nayaka.S`, size: 16, italics: true })] }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: `Protocol: ${protocolMetadata.title}`, bold: true, size: 20 })] }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: `PI: ${protocolMetadata.pi} | Dept: ${protocolMetadata.dept}`, size: 18 })] }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: `Score: ${data.score}% | Persona: ${currentPersona.toUpperCase()}`, size: 18 })] }),
                new docx.Paragraph({ text: "" }),
                new docx.Table({ rows }),
                new docx.Paragraph({ text: "" }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: "EXECUTIVE SUMMARY:", bold: true, size: 20 })] }),
                new docx.Paragraph({ children: [new docx.TextRun({ text: data.analysis || "No summary.", size: 18 })] })
            ]
        }]
    });

    docx.Packer.toBlob(doc).then(blob => {
        saveAs(blob, `Nexus_Ethics_Report_${Date.now()}.docx`);
    });
}

// --- 9. GOOGLE DRIVE SAVE ---
async function saveToDrive() {
    const token = gapi.client.getToken();
    if (!token) return handleAuthClick();
    const content = { metadata: protocolMetadata, audit: auditData, exportedAt: new Date().toISOString() };
    const file = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: `Nexus_Report_${Date.now()}.json`, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', file);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + token.access_token }),
        body: form
    });
    alert("Audit report saved to Google Drive.");
}
