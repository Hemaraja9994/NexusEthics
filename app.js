// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, aggregatedText = "", auditData = null;
let protocolMetadata = { title: "Not Found", pi: "Not Found", dept: "Not Found" };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GAPI LOADERS ---
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
    const el = document.getElementById(`p-${p}`);
    if (el) el.classList.add('role-active');
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

// --- 5. ULTRA-FAST AUDIT ENGINE ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Upload protocols first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true; 
    btn.innerText = "80-POINT AUDIT IN PROGRESS...";

    const prompt = `Perform a rapid item-by-item Ethics Audit. 
    1. Extract: {"title": "..", "pi": "..", "dept": ".."}.
    2. Check Parts A-F (80 items). Use status: "Yes" or "NF". Keep notes very short.
    3. Output JSON format: 
    {
      "metadata": {"title":"..", "pi":"..", "dept":".."},
      "summary": "Short critique",
      "score": 80,
      "checks": [{"item":"..", "status":"..", "note":"..", "part":"A"}]
    }
    TEXT: ${aggregatedText.substring(0, 15000)}`;

    try {
        const res = await fetch(`/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt })
        });

        const rawData = await res.json();
        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // Single Audit mapped to all personas for speed
        auditData = {
            metadata: parsed.metadata || protocolMetadata,
            consensus: parsed, chairperson: parsed, secretary: parsed, lawyer: parsed, clinician: parsed, layperson: parsed
        };

        protocolMetadata = auditData.metadata;
        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        renderResult();
    } catch (e) { 
        alert("Server limit reached. Please try a smaller portion of the document."); 
    } finally { 
        btn.disabled = false; btn.innerText = "Run War Room Audit"; 
    }
}

function renderResult() {
    const data = auditData[currentPersona] || auditData.consensus;
    document.getElementById('viewLabel').innerText = currentPersona;
    document.getElementById('roleTitle').innerText = currentPersona.toUpperCase() + " PERSPECTIVE";
    document.getElementById('roleAnalysis').innerText = data.summary || "Audit complete.";
    document.getElementById('totalScore').innerText = (data.score || 0) + "%";

    let html = "";
    if (data.checks) {
        data.checks.forEach(c => {
            const s = (c.status || "").toLowerCase();
            const type = s.includes('yes') || s.includes('pass') ? 'success' : 'scrutinize';
            html += `<div class="${type} shadow-sm border border-navy/5 p-3 rounded-lg mb-2">
                <p class="text-[7px] font-bold uppercase opacity-40">Part ${c.part}</p>
                <p class="text-[9px] font-bold text-navy">${c.item}</p>
                <p class="text-[10px] mt-1 text-slate-600">${c.note}</p>
            </div>`;
        });
    }
    document.getElementById('checklistItems').innerHTML = html;
    
    const ctx = document.getElementById('scoreChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [data.score || 0, 100-(data.score||0)], backgroundColor: ['#F97316', '#F1F5F9'], borderWidth: 0, cutout: '82%' }] }
    });
}

// --- 6. EXPORT PDF ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = auditData[currentPersona];
    doc.text("Nexus Ethics Audit Report", 14, 15);
    doc.autoTable({
        startY: 25,
        head: [['Criteria', 'Status', 'Observation']],
        body: data.checks.map(c => [c.item, c.status, c.note]),
        styles: { fontSize: 7 }
    });
    doc.save(`Nexus_Report_${Date.now()}.pdf`);
}

async function saveToDrive() {
    const token = gapi.client.getToken();
    if (!token) return handleAuthClick();
    const content = { metadata: protocolMetadata, audit: auditData };
    const file = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: `Nexus_Report_${Date.now()}.json`, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', file);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: new Headers({ 'Authorization': 'Bearer ' + token.access_token }), body: form });
    alert("Audit Saved to Google Drive.");
}
