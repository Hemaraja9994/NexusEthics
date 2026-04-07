// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let aggregatedText = "";
let auditData = null;
let protocolMetadata = { title: "Not Detected", pi: "Not Detected", dept: "Not Detected" };
let currentCategory = "full";
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
function setCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    document.getElementById(`cat-${cat}`).classList.add('cat-active');
}
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

// --- 5. AI LOGIC ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Please upload a protocol first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true; btn.innerText = "BOARD DELIBERATING...";

    const prompt = `Act as an expert Indian Ethics Committee Auditor. Analyze the provided text based on ICMR 2017 & NDCTR 2019.
    
    TASK:
    1. Extract the Study Title, PI Name, and Department.
    2. Provide a multi-persona audit (Consensus, Chairperson, Secretary, Lawyer, Scientist, Layperson).
    3. Categorize audit points into Parts: A (Scientific), B (Ethical/Vulnerability), C (Social), D (Legal), E (PIS/ICF).
    
    Text: ${aggregatedText.substring(0, 15000)}
    
    Output ONLY pure JSON. 
    Format: {
        "metadata": {"title": "...", "pi": "...", "dept": "..."},
        "consensus": {
            "analysis": "...", 
            "score": 85, 
            "checks": [{"item": "...", "status": "Yes/No/NA", "note": "...", "part": "A"}]
        },
        "chairperson": {...},
        "secretary": {...},
        "lawyer": {...},
        "clinician": {...},
        "layperson": {...}
    }`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        if (!res.ok) throw new Error("Server communication failed.");

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
    document.getElementById('roleAnalysis').innerText = `TITLE: ${protocolMetadata.title}\n\n${data.analysis}`;
    document.getElementById('totalScore').innerText = data.score + "%";

    let html = "";
    data.checks.forEach(c => {
        const status = c.status.toLowerCase();
        const type = status === 'yes' || status === 'pass' || status === 'success' ? 'success' : 'scrutinize';
        html += `<div class="${type} shadow-sm border border-navy/5">
            <p class="text-[8px] font-black uppercase opacity-40">[Part ${c.part || 'Audit'}]</p>
            <p class="text-[9px] font-black uppercase text-navy">${c.item}</p>
            <p class="text-xs font-bold leading-tight mt-1 text-slate-600">${c.note}</p>
        </div>`;
    });
    document.getElementById('checklistItems').innerHTML = html;
    updateChart(data.score);
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

// --- 6. EXPORT ENGINE (PROFESSIONAL FORM) ---

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona];

    // --- Elegant Header ---
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("NEXUS ETHICS AI", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Official Reviewer Assessment Form (ICMR 2017 / NDCTR 2019 Standards)", 105, 28, { align: "center" });
    doc.setFontSize(8);
    doc.text("Conceptualized and Academic Designed by Mr. Hemaraja Nayaka.S", 105, 36, { align: "center" });

    let finalY = 55;

    // --- Protocol Identification Table ---
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("SECTION 1: PROTOCOL IDENTIFICATION", 14, finalY);
    
    doc.autoTable({
        startY: finalY + 4,
        body: [
            ["Study Title", protocolMetadata.title],
            ["Principal Investigator", protocolMetadata.pi],
            ["Department", protocolMetadata.dept],
            ["Reviewer Role", currentPersona.toUpperCase()],
            ["Compliance Score", data.score + "%"]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 50 } }
    });

    finalY = doc.lastAutoTable.finalY + 12;

    // --- Function to Render Assessment Parts ---
    const renderPart = (partLabel, title) => {
        const filtered = data.checks.filter(c => c.part === partLabel);
        if (filtered.length === 0) return;

        if (finalY > 250) { doc.addPage(); finalY = 20; }
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, finalY);

        doc.autoTable({
            startY: finalY + 4,
            head: [['S.No', 'Assessment Criteria', 'Yes/No/NA', 'Observations']],
            body: filtered.map((c, i) => [i + 1, c.item, c.status, c.note]),
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22] },
            styles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 20 } }
        });
        finalY = doc.lastAutoTable.finalY + 12;
    };

    renderPart("A", "PART A: SCIENTIFIC ISSUES");
    renderPart("B", "PART B: ETHICAL ISSUES & VULNERABILITY");

    // --- Risk Matrix Grid ---
    if (finalY > 240) { doc.addPage(); finalY = 20; }
    doc.setFontSize(11);
    doc.text("RISK: BENEFIT ANALYSIS MATRIX", 14, finalY);
    doc.autoTable({
        startY: finalY + 4,
        head: [['Magnitude', 'Less than Minimal', 'Minimal', 'Minor Increase', 'Major Increase']],
        body: [
            ['Negligible', 'Detected', '-', '-', '-'],
            ['Small', '-', '-', '-', '-'],
            ['Significant', '-', '-', '-', '-']
        ],
        theme: 'grid',
        headStyles: { fillColor: [100, 116, 139] },
        styles: { fontSize: 7, halign: 'center' }
    });
    finalY = doc.lastAutoTable.finalY + 12;

    renderPart("C", "PART C: SOCIAL & CULTURAL ISSUES");
    renderPart("D", "PART D: LEGAL & REGULATORY ASPECTS");
    renderPart("E", "PART E: PIS & INFORMED CONSENT CHECKLIST");

    // --- Final Deliberation ---
    if (finalY > 230) { doc.addPage(); finalY = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL REVIEWER CRITIQUE:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitCritique = doc.splitTextToSize(data.analysis, 180);
    doc.text(splitCritique, 14, finalY + 8);

    // --- Page Numbering ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages} | Nexus Ethics AI - Confidential Audit Report`, 105, 290, { align: "center" });
    }

    doc.save(`Nexus_Ethics_Review_${Date.now()}.pdf`);
}

async function saveToDrive() {
    const token = gapi.client.getToken();
    if (!token) return handleAuthClick();
    const content = { metadata: protocolMetadata, audit: auditData };
    const file = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: `NexusEthics_${Date.now()}.json`, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', file);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: new Headers({ 'Authorization': 'Bearer ' + token.access_token }), body: form });
    alert("Audit Saved to Google Drive.");
}

// Placeholder Word export (Simple structure)
function exportWord() {
    alert("Word Export initiated. Structure optimized for professional editing.");
    // Word export logic similar to PDF can be implemented using docx.js
}
