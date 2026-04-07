// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let aggregatedText = "";
let auditData = null;
let protocolMetadata = { title: "Not Detected", pi: "Not Detected", dept: "Not Detected" };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GOOGLE DRIVE & UI ---
function gapiLoaded() { gapi.load('client', async () => { await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }); }); }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '', }); }
window.onload = () => { gapiLoaded(); gisLoaded(); };

function setCategory(cat) {} // UI placeholder
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
            aggregatedText += `\n[FILE CONTENT: ${file.name}]\n${text}\n`;
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
    btn.disabled = true; btn.innerText = "AUDITING EVERY ITEM...";

    // This prompt lists EVERY specific item from the 8-page form to prevent summarization.
    const prompt = `Act as an Indian Ethics Committee Auditor. Perform a MANDATORY item-by-item audit. 
    DO NOT SUMMARIZE. If a detail is missing, state "Not Mentioned".
    
    1. EXTRACT: Title, PI Name, Department.
    2. AUDIT THE FOLLOWING 60+ ITEMS:
    
    PART A (Scientific): Background sufficiency, Aims/Objectives, Study design, Sample size justification, Statistical tests, Inclusion criteria, Exclusion criteria, Discontinuation criteria, Research tool validation, Team expertise, Infrastructure, Medical management of injury, Methodology description, Data collection forms.
    
    PART B (Ethical): Sampling fairness, Vulnerable populations inclusion/justification, Safeguards for vulnerable, Autonomy protection, Voluntary participation, Standard of care (Intervention vs Control), Placebo justification, Inducements/Benefits, Compensation for AE/SAE, Privacy of participants, Confidentiality of genomic/data, Conflict of Interest declaration.
    
    PART C/D (Social/Legal): Social value, Community involvement, Cultural/Religious issues, Clinical trial agreement, Compensation plan, MTA for samples, Insurance policies, Regulatory approvals (DCGI/HMSC), Budget.
    
    PART E (PIS/ICF Checklist - 23 ITEMS): Simple language (8th std level), Study title/PI names, Research vs Therapy, Recruitment reason, Screening eligibility, Duration/Responsibilities, Voluntary nature/Withdrawal right, Intervention details, Direct/Indirect benefits, Lab tests/Storage/Disposal of samples, Privacy assurance, Sharing results, SAE risks, PI contact for injury, Reimbursement for time, SAE compensation (including death), Nominee for compensation, Photograph/Privacy statement, Comprehension time, Contact details of Member-Secretary YEC-4, Copy given to participant, Signature/Thumb impression provision.

    Output ONLY pure JSON. 
    Format: {
        "metadata": {"title": "...", "pi": "...", "dept": "..."},
        "consensus": {
            "analysis": "...", 
            "score": 85, 
            "checks": [{"item": "Exact Criteria Name", "status": "Yes/No/Not Mentioned", "note": "Detailed observation", "part": "A/B/C/D/E"}]
        },
        "chairperson": {...}, "secretary": {...}, "lawyer": {...}, "clinician": {...}, "layperson": {...}
    }
    
    TEXT: ${aggregatedText.substring(0, 20000)}`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        const data = await res.json();
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        auditData = parsed;
        protocolMetadata = parsed.metadata || { title: "Unknown", pi: "Unknown", dept: "Unknown" };
        
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
    if (!auditData) return;
    const data = auditData[currentPersona];
    document.getElementById('viewLabel').innerText = currentPersona;
    document.getElementById('roleTitle').innerText = currentPersona.toUpperCase() + " PERSPECTIVE";
    document.getElementById('roleAnalysis').innerText = data.analysis;
    document.getElementById('totalScore').innerText = data.score + "%";

    let html = "";
    data.checks.forEach(c => {
        const status = c.status.toLowerCase();
        const type = (status.includes('yes') || status.includes('pass')) ? 'success' : (status.includes('not mentioned') ? 'modify' : 'scrutinize');
        html += `<div class="${type} shadow-sm border border-navy/5">
            <p class="text-[8px] font-black uppercase opacity-40">Part ${c.part}</p>
            <p class="text-[9px] font-black uppercase text-navy">${c.item}</p>
            <p class="text-xs font-bold leading-tight mt-1 text-slate-600">${c.note}</p>
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

// --- 5. DETAILED PDF EXPORT (THE 8-PAGE FORM REPLICA) ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona];

    const drawHeader = (title) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("NEXUS ETHICS AI", 105, 18, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(title, 105, 28, { align: "center" });
        doc.setFontSize(7);
        doc.text("Conceptualized and Academic Designed by Mr. Hemaraja Nayaka.S", 105, 35, { align: "center" });
    };

    drawHeader("Formal Reviewer Assessment Form (Comprehensive Audit)");

    let finalY = 50;

    // Cover Info
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("SECTION 1: PROTOCOL IDENTIFICATION", 14, finalY);
    
    doc.autoTable({
        startY: finalY + 4,
        body: [
            ["Title of Study", protocolMetadata.title],
            ["Principal Investigator", protocolMetadata.pi],
            ["Department", protocolMetadata.dept],
            ["Reviewer Persona", currentPersona.toUpperCase()],
            ["Compliance Score", data.score + "%"]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    finalY = doc.lastAutoTable.finalY + 12;

    const renderTablePart = (code, title) => {
        const rows = data.checks.filter(c => c.part === code);
        if (rows.length === 0) return;

        if (finalY > 240) { doc.addPage(); finalY = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, finalY);

        doc.autoTable({
            startY: finalY + 4,
            head: [['S.No', 'Assessment Criteria', 'Status', 'Reviewer Observations']],
            body: rows.map((c, i) => [i + 1, c.item, c.status, c.note]),
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 25 } }
        });
        finalY = doc.lastAutoTable.finalY + 12;
    };

    renderTablePart("A", "PART A: SCIENTIFIC ISSUES");
    renderTablePart("B", "PART B: ETHICAL ISSUES & RISK-BENEFIT ANALYSIS");
    
    // Risk Matrix
    if (finalY > 230) { doc.addPage(); finalY = 20; }
    doc.text("RISK MAGNITUDE MATRIX", 14, finalY);
    doc.autoTable({
        startY: finalY + 4,
        head: [['Magnitude of Harm', 'Less than Minimal', 'Minimal', 'Minor Increase', 'Major Increase']],
        body: [
            ['Negligible', 'Detected', '-', '-', '-'],
            ['Small', '-', '-', '-', '-'],
            ['Significant', '-', '-', '-', '-'],
            ['Serious', '-', '-', '-', '-']
        ],
        theme: 'grid',
        styles: { fontSize: 7, halign: 'center' },
        headStyles: { fillColor: [100, 116, 139] }
    });
    finalY = doc.lastAutoTable.finalY + 12;

    renderTablePart("C", "PART C: SOCIAL & CULTURAL ISSUES");
    renderTablePart("D", "PART D: LEGAL ASPECTS");
    renderTablePart("E", "PART E: PIS & INFORMED CONSENT CHECKLIST (23 ITEMS)");

    // Critique
    if (finalY > 240) { doc.addPage(); finalY = 20; }
    doc.setFontSize(11);
    doc.text("EXECUTIVE SUMMARY & FINAL DELIBERATION:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const splitText = doc.splitTextToSize(data.analysis, 180);
    doc.text(splitText, 14, finalY + 8);

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages} | Nexus Ethics AI - System Generated Formal Audit | Confidential`, 105, 292, { align: "center" });
    }

    doc.save(`Nexus_Ethics_Detailed_Audit_${Date.now()}.pdf`);
}

function exportWord() {}
async function saveToDrive() {}
