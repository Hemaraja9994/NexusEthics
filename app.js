// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let aggregatedText = "";
let auditData = null;
let protocolMetadata = { number: "N/A", title: "Not Detected", pi: "Not Detected", dept: "Not Detected" };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GAPI & GIS INITIALIZATION ---
function gapiLoaded() { gapi.load('client', async () => { await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }); }); }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '', }); }
window.onload = () => { gapiLoaded(); gisLoaded(); };

function setPersona(p) {
    currentPersona = p;
    document.querySelectorAll('.role-link').forEach(b => b.classList.remove('role-active'));
    document.getElementById(`p-${p}`).classList.add('role-active');
    if (auditData) renderResult();
}

// --- 3. MULTI-FORMAT PARSER ---
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
            aggregatedText += `\n[DOCUMENT: ${file.name}]\n${text}\n`;
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

// --- 4. THE COMPREHENSIVE AUDIT ENGINE ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Please upload a protocol first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true; btn.innerText = "BOARD DELIBERATING (FULL AUDIT)...";

    const prompt = `Act as an Indian Ethics Committee Auditor. You MUST perform a 100% item-by-item audit. DO NOT SUMMARIZE.
    For every item listed below, you must return a status (Yes / No / Not Found) and a specific observation.

    1. EXTRACT METADATA: Protocol Number, Study Title, PI Name, Department.
    
    2. AUDIT CHECKLIST:
    PART A (Scientific): 1.Background/Need, 2.Aims/Objectives, 3.Study Design, 4.Sample Size Justification, 5.Statistical Tests, 6.Inclusion Criteria, 7.Exclusion Criteria, 8.Discontinuation Criteria, 9.Validated Tools, 10.Team Expertise, 11.Infrastructure, 12.Injury Management, 13.Intervention Methodology, 14.Data Collection Methodology, 15.Form Appropriateness, 16.Informed Consent Process.

    PART B (Ethical): 1.Fair Sampling, 2.Vulnerable Populations (check for justification, safeguards, autonomy, and items a-k), 3.Withdrawal Criteria, 4.Voluntary Participation, 5.Standard of Care (Intervention), 6.Standard of Care (Control), 7.Placebo Justification, 8.Inducements/Compensation, 9.Privacy, 10.Confidentiality, 11.Sample Storage/Disposal, 12.Conflict of Interest, 13.AE/SAE Compensation.

    RISK ANALYSIS: Magnitude of harm (Negligible/Small/Significant/Serious) and Type of Harm (Physical, Psychological, Social, etc.).

    PART C/D (Legal): 1.Social Value, 2.Community Involvement, 3.Cultural/Religious issues, 4.Clinical Trial Agreement, 5.Compensation Plan, 6.MTA, 7.Insurance, 8.Regulatory Approvals, 9.Budget.

    PART E (PIS Checklist - 23 items): check language level, PI name, Research vs Therapy, Recruitment reason, Duration, Voluntary nature, Benefits, Storage/Sharing, SAE Handling, Contact details for PI and Member-Secretary YEC-4.

    PART F (ICF Checklist - 20 items): Language, Time to understand, Opportunity to ask, AV Consent provision, Signatures, Thumb impressions, Translation.

    Output ONLY pure JSON.
    {
        "metadata": {"number": "...", "title": "...", "pi": "...", "dept": "..."},
        "consensus": {
            "analysis": "Executive summary of audit", 
            "score": 0, 
            "checks": [{"item": "Exact Criteria Name", "status": "Yes/No/Not Found", "note": "Observation text", "part": "A/B/C/D/E/F"}]
        },
        "chairperson": {...}, "secretary": {...}, "lawyer": {...}, "clinician": {...}, "layperson": {...}
    }

    TEXT: ${aggregatedText.substring(0, 18000)}`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        const data = await res.json();
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        auditData = parsed;
        protocolMetadata = parsed.metadata || protocolMetadata;
        
        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        renderResult();
    } catch (e) { 
        alert("AI Error: " + e.message); 
    } finally { 
        btn.disabled = false; btn.innerText = "Run War Room Audit"; 
    }
}

function renderResult() {
    const data = auditData[currentPersona];
    document.getElementById('viewLabel').innerText = currentPersona;
    document.getElementById('roleTitle').innerText = currentPersona.toUpperCase() + " PERSPECTIVE";
    document.getElementById('roleAnalysis').innerText = data.analysis;
    document.getElementById('totalScore').innerText = data.score + "%";

    let html = "";
    data.checks.forEach(c => {
        const status = c.status.toLowerCase();
        const type = (status === 'yes' || status === 'pass') ? 'success' : (status === 'not found' || status === 'not mentioned') ? 'modify' : 'scrutinize';
        html += `<div class="${type} shadow-sm border border-navy/5">
            <p class="text-[7px] font-black uppercase opacity-40">Part ${c.part}</p>
            <p class="text-[9px] font-black uppercase text-navy">${c.item}</p>
            <p class="text-xs font-medium leading-tight mt-1 text-slate-600">${c.note}</p>
            <p class="text-[8px] mt-1 font-bold">Status: ${c.status}</p>
        </div>`;
    });
    document.getElementById('checklistItems').innerHTML = html;
    updateChart(data.score);
}

function updateChart(score) {
    const canvas = document.getElementById('scoreChart');
    const ctx = canvas.getContext('2d');
    if(window.chartInstance) window.chartInstance.destroy();
    window.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [score, 100-score], backgroundColor: ['#F97316', '#F1F5F9'], borderWidth: 0, cutout: '82%' }] }
    });
}

// --- 5. COMPREHENSIVE PDF EXPORT ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona];

    const drawHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("NEXUS ETHICS AI", 105, 18, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Professional Reviewer Assessment Form (Comprehensive Audit)", 105, 26, { align: "center" });
        doc.setFontSize(7);
        doc.text("Conceptualized by Mr. Hemaraja Nayaka.S", 105, 33, { align: "center" });
    };

    drawHeader();
    let finalY = 50;

    // Metadata Table
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text("SECTION 1: PROTOCOL IDENTIFICATION", 14, finalY);
    doc.autoTable({
        startY: finalY + 4,
        body: [
            ["Protocol Number", protocolMetadata.number],
            ["Study Title", protocolMetadata.title],
            ["Principal Investigator", protocolMetadata.pi],
            ["Department", protocolMetadata.dept],
            ["Reviewer Persona", currentPersona.toUpperCase()]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    finalY = doc.lastAutoTable.finalY + 10;

    const renderAuditPart = (partCode, partTitle) => {
        const rows = data.checks.filter(c => c.part === partCode);
        if (rows.length === 0) return;

        if (finalY > 240) { doc.addPage(); drawHeader(); finalY = 50; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(partTitle, 14, finalY);

        doc.autoTable({
            startY: finalY + 4,
            head: [['S.No', 'Criteria', 'Yes/No/NF', 'Observation']],
            body: rows.map((c, i) => [i + 1, c.item, c.status, c.note]),
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 20 } }
        });
        finalY = doc.lastAutoTable.finalY + 10;
    };

    renderAuditPart("A", "PART A: SCIENTIFIC ISSUES");
    renderAuditPart("B", "PART B: ETHICAL ISSUES");
    renderAuditPart("C", "PART C: SOCIAL / CULTURAL ISSUES");
    renderAuditPart("D", "PART D: LEGAL ASPECTS");
    renderAuditPart("E", "PART E: PIS CHECKLIST");
    renderAuditPart("F", "PART F: INFORMED CONSENT FORM (ICF) CHECKLIST");

    // Footer and Numbers
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pages} | Nexus Ethics AI System Audit`, 105, 290, { align: "center" });
    }

    doc.save(`Nexus_Ethics_Report_${Date.now()}.pdf`);
}
