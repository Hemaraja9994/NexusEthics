// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let aggregatedText = "";
let auditData = null;
let protocolMetadata = { number: "Not Detected", title: "Not Detected", pi: "Not Detected", dept: "Not Detected" };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GOOGLE DRIVE ENGINE ---
function gapiLoaded() { gapi.load('client', async () => { await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }); }); }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '', }); }
window.onload = () => { gapiLoaded(); gisLoaded(); };
function handleAuthClick() {
    tokenClient.callback = async (resp) => { if (resp.error) return; document.getElementById('driveBtn').innerText = "Drive Active"; saveToDrive(); };
    tokenClient.requestAccessToken({prompt: 'consent'});
}

// --- 3. UI HANDLERS ---
function setPersona(p) {
    currentPersona = p;
    document.querySelectorAll('.role-link').forEach(b => b.classList.remove('role-active'));
    document.getElementById(`p-${p}`).classList.add('role-active');
    if (auditData) renderResult();
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
        div.innerText = `⏳ Parsing ${file.name}`;
        document.getElementById('fileStatus').appendChild(div);
        try {
            let text = "";
            if (file.type === "application/pdf") text = await parsePDF(file);
            else if (file.type.includes("word") || file.name.endsWith('.docx')) text = await parseWord(file);
            else if (file.type.startsWith("image/")) text = await parseImage(file);
            aggregatedText += `\n[FILE: ${file.name}]\n${text}\n`;
            div.innerText = `✅ Loaded: ${file.name}`;
            div.className = "text-[9px] font-bold text-emerald-600";
        } catch (err) { div.innerText = `❌ Error: ${file.name}`; }
    }
};

async function parsePDF(f) {
    const buf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let t = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        t += content.items.map(s => s.str).join(" ") + " ";
    }
    return t;
}
async function parseWord(f) { const buf = await f.arrayBuffer(); const res = await mammoth.extractRawText({ arrayBuffer: buf }); return res.value; }
async function parseImage(f) { const res = await Tesseract.recognize(f, 'eng'); return res.data.text; }

// --- 5. COMPREHENSIVE AI AUDIT LOGIC ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Upload protocols first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true; btn.innerText = "FULL SYSTEM AUDIT IN PROGRESS...";

    const prompt = `Act as an Indian Ethics Committee Auditor. Perform a MANDATORY 80-item point-by-point audit. DO NOT SUMMARIZE. 
    1. EXTRACT: Protocol Number, Title, PI Name, Dept. 
    2. AUDIT EVERY ITEM:
    PART A (Scientific): Background, Aims, Design, Sample Size, Stats, Inclusion/Exclusion, Discontinuation, Tools, Team Expertise, Infrastructure, Injury Management.
    PART B (Ethical): Sampling Fairness, Vulnerable (Justification, Safeguards, Autonomy), Voluntary Nature, Standard of Care, Placebo, Inducements, Privacy, COI, SAE Compensation.
    PART C/D (Legal): Social Value, Community, Clinical Trial Agreement, MTA, Insurance, Regulatory, Budget.
    PART E/F (PIS/ICF Checklist - 40+ items): Simple language (8th std), PI/Title match, Research vs Therapy, Recruitment reason, Duration, Risks/Benefits, Storage/Disposal, SAE handling, Contact details for PI & Member-Secretary YEC-4, Signature provisions.

    Output ONLY valid JSON:
    {
      "metadata": {"number": "...", "title": "...", "pi": "...", "dept": "..."},
      "consensus": {"analysis": "...", "score": 85, "checks": [{"item": "...", "status": "Yes/No/Not Found", "note": "...", "part": "A"}]},
      "chairperson": {"analysis": "...", "score": 85, "checks": []},
      "secretary": {"analysis": "...", "score": 85, "checks": []},
      "lawyer": {"analysis": "...", "score": 85, "checks": []},
      "clinician": {"analysis": "...", "score": 85, "checks": []},
      "layperson": {"analysis": "...", "score": 85, "checks": []}
    }
    
    TEXT: ${aggregatedText.substring(0, 18000)}`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        const rawData = await res.json();
        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // --- DEFENSIVE FALLBACK ---
        if (parsed.consensus && !parsed.chairperson) {
            parsed.chairperson = parsed.secretary = parsed.lawyer = parsed.clinician = parsed.layperson = parsed.consensus;
        }

        auditData = parsed;
        protocolMetadata = parsed.metadata || protocolMetadata;
        
        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        renderResult();
    } catch (e) { 
        alert("AI Processing Error: " + e.message); 
    } finally { 
        btn.disabled = false; btn.innerText = "Run War Room Audit"; 
    }
}

function renderResult() {
    if (!auditData) return;
    const data = auditData[currentPersona] || auditData.consensus;
    
    document.getElementById('viewLabel').innerText = currentPersona;
    document.getElementById('roleTitle').innerText = currentPersona.toUpperCase() + " PERSPECTIVE";
    document.getElementById('roleAnalysis').innerText = data.analysis || "Audit summary not available.";
    document.getElementById('totalScore').innerText = (data.score || 0) + "%";

    let html = "";
    if (data.checks) {
        data.checks.forEach(c => {
            const status = (c.status || "").toLowerCase();
            const type = (status.includes('yes') || status.includes('pass')) ? 'success' : (status.includes('not')) ? 'modify' : 'scrutinize';
            html += `<div class="${type} shadow-sm border border-navy/5">
                <p class="text-[7px] font-black uppercase opacity-40">Part ${c.part || 'Audit'}</p>
                <p class="text-[9px] font-black uppercase text-navy">${c.item}</p>
                <p class="text-xs font-bold leading-tight mt-1 text-slate-600">${c.note}</p>
            </div>`;
        });
    }
    document.getElementById('checklistItems').innerHTML = html;
    updateChart(data.score || 0);
}

let chart;
function updateChart(score) {
    const canvas = document.getElementById('scoreChart');
    const ctx = canvas.getContext('2d');
    if(chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [score, 100-score], backgroundColor: ['#F97316', '#F1F5F9'], borderWidth: 0, cutout: '82%' }] }
    });
}

// --- 6. EXPORT ENGINE (MULTI-PAGE) ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona] || auditData.consensus;

    const drawHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255);
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.text("NEXUS ETHICS AI", 105, 18, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Professional Reviewer Assessment Form (Full Audit)", 105, 26, { align: "center" });
        doc.setFontSize(8); doc.text("Conceptualized by Mr. Hemaraja Nayaka.S", 105, 33, { align: "center" });
    };

    drawHeader();
    let finalY = 50;

    doc.setTextColor(0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("SECTION 1: PROTOCOL IDENTIFICATION", 14, finalY);
    
    doc.autoTable({
        startY: finalY + 4,
        body: [
            ["Title", protocolMetadata.title],
            ["PI", protocolMetadata.pi],
            ["Dept", protocolMetadata.dept],
            ["Compliance", data.score + "%"]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
    });

    finalY = doc.lastAutoTable.finalY + 12;

    const renderAuditPart = (partCode, partTitle) => {
        const filtered = data.checks.filter(c => c.part === partCode);
        if (filtered.length === 0) return;
        if (finalY > 240) { doc.addPage(); drawHeader(); finalY = 50; }
        
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(partTitle, 14, finalY);
        doc.autoTable({
            startY: finalY + 4,
            head: [['S.No', 'Assessment Criteria', 'Status', 'Observations']],
            body: filtered.map((c, i) => [i + 1, c.item, c.status, c.note]),
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 20 } }
        });
        finalY = doc.lastAutoTable.finalY + 12;
    };

    renderAuditPart("A", "PART A: SCIENTIFIC ISSUES");
    renderAuditPart("B", "PART B: ETHICAL ISSUES & VULNERABILITY");
    renderAuditPart("C", "PART C: SOCIAL & CULTURAL ISSUES");
    renderAuditPart("D", "PART D: LEGAL ASPECTS");
    renderAuditPart("E", "PART E: PIS CHECKLIST");
    renderAuditPart("F", "PART F: INFORMED CONSENT CHECKLIST");

    if (finalY > 240) { doc.addPage(); drawHeader(); finalY = 50; }
    doc.setFontSize(11); doc.text("FINAL CRITIQUE:", 14, finalY);
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(data.analysis, 180);
    doc.text(splitText, 14, finalY + 8);

    doc.save(`Nexus_Ethics_Report_${Date.now()}.pdf`);
}

async function saveToDrive() {
    const token = gapi.client.getToken();
    if (!token) return handleAuthClick();
    const file = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: `Nexus_Report_${Date.now()}.json`, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', file);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: new Headers({ 'Authorization': 'Bearer ' + token.access_token }), body: form });
    alert("Audit Saved to Google Drive.");
}
