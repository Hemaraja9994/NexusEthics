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

// --- 4. PARSER ---
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
            aggregatedText += `\n[DOC: ${file.name}]\n${text}\n`;
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

// --- 5. THE ROBUST AUDIT ENGINE ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Upload protocols first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true; btn.innerText = "80-POINT AUDIT IN PROGRESS...";

    const prompt = `Act as an Indian Ethics Committee Auditor. Perform a MANDATORY item-by-item audit of the provided protocol. 
    1. EXTRACT: Metadata (Study Title, PI Name, Dept).
    2. AUDIT: Every detail of Scientific Issues, Ethical Issues, Risk:Benefit Matrix, Legal Aspects, and the PIS/ICF Checklist (23+ items).
    3. Output MUST be this JSON structure:
    {
      "metadata": {"title": "...", "pi": "...", "dept": "..."},
      "audit": {
         "summary": "Detailed overall critique",
         "score": 85,
         "checks": [{"item": "Exact Criteria", "status": "Yes/No/NF", "note": "...", "part": "A"}]
      }
    }
    TEXT: ${aggregatedText.substring(0, 18000)}`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        const rawData = await res.json();
        let parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // --- DATA REPAIR LOGIC ---
        // If AI returns 'audit' key, map it to personas. If it returns 'consensus' directly, keep it.
        const baseAudit = parsed.audit || parsed.consensus || parsed;
        
        auditData = {
            metadata: parsed.metadata || { title: "Detected from text", pi: "Detected", dept: "Detected" },
            consensus: baseAudit,
            chairperson: baseAudit,
            secretary: baseAudit,
            lawyer: baseAudit,
            clinician: baseAudit,
            layperson: baseAudit
        };
        
        // Final fallback for missing keys inside the audit object
        Object.keys(auditData).forEach(key => {
            if (key === 'metadata') return;
            if (!auditData[key].analysis) auditData[key].analysis = auditData[key].summary || "Audit complete.";
            if (!auditData[key].score) auditData[key].score = 0;
            if (!auditData[key].checks) auditData[key].checks = [];
        });

        protocolMetadata = auditData.metadata;
        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        renderResult();
    } catch (e) { 
        alert("System Error: " + e.message); 
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
        const s = (c.status || "").toLowerCase();
        const type = s.includes('yes') || s.includes('pass') ? 'success' : s.includes('no') ? 'scrutinize' : 'modify';
        html += `<div class="${type} shadow-sm border border-navy/5">
            <p class="text-[7px] font-black uppercase opacity-40">Part ${c.part || 'Audit'}</p>
            <p class="text-[9px] font-black uppercase text-navy">${c.item}</p>
            <p class="text-xs font-bold mt-1 text-slate-600">${c.note}</p>
        </div>`;
    });
    document.getElementById('checklistItems').innerHTML = html || "No items found.";
    
    // Update Chart
    const ctx = document.getElementById('scoreChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [data.score, 100-data.score], backgroundColor: ['#F97316', '#F1F5F9'], borderWidth: 0, cutout: '82%' }] }
    });
}

// --- 6. EXPORT PDF ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona];

    const header = () => {
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255); doc.setFontSize(22); doc.text("NEXUS ETHICS AI", 105, 20, { align: "center" });
    };

    header();
    doc.setTextColor(0); doc.setFontSize(10);
    doc.text(`Title: ${protocolMetadata.title}`, 14, 50);
    
    doc.autoTable({
        startY: 60,
        head: [['S.No', 'Criteria', 'Status', 'Observation']],
        body: data.checks.map((c, i) => [i + 1, c.item, c.status, c.note]),
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 7 }
    });

    doc.save("Nexus_Ethics_Audit.pdf");
}
