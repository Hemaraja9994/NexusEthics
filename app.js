// --- 1. CONFIGURATION ---
const CLIENT_ID = "881373992475-pdlivcbo8eem8k5sivhh6i2riv06fqav.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, aggregatedText = "", auditData = null;
let protocolMetadata = { title: "Detecting...", pi: "Detecting...", dept: "Detecting..." };
let currentPersona = "consensus";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- 2. GAPI ---
function gapiLoaded() { gapi.load('client', async () => { await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }); }); }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '', }); }
window.onload = () => { gapiLoaded(); gisLoaded(); };

// --- 3. UI ---
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

// --- 5. PARALLEL INSTANT AUDIT ENGINE ---
async function executeAnalysis() {
    if(!aggregatedText) return alert("Upload protocols first.");
    const btn = document.getElementById('runBtn');
    btn.disabled = true;
    btn.innerText = "STARTING INSTANT PARALLEL AUDIT...";

    const context = aggregatedText.substring(0, 15000);

    // We define 3 distinct tasks to run in parallel
    const task1 = `Audit Part A (Scientific) and Part B (Ethical). Extract Metadata (Title, PI, Dept). Output JSON: {"metadata": {"title":"..","pi":"..","dept":".."}, "checks": [{"item":"..","status":"..","note":"..","part":"A/B"}]}`;
    const task2 = `Audit Part C (Social) and Part D (Legal Aspects). Output JSON: {"checks": [{"item":"..","status":"..","note":"..","part":"C/D"}]}`;
    const task3 = `Audit Part E & F (Full PIS/ICF Checklist - 40 items). Provide summary. Output JSON: {"summary":"..", "checks": [{"item":"..","status":"..","note":"..","part":"E/F"}]}`;

    try {
        btn.innerText = "ANALYZING ALL SECTIONS SIMULTANEOUSLY...";

        // FIRE ALL 3 REQUESTS AT ONCE
        const [r1, r2, r3] = await Promise.all([
            fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt: task1 + " TEXT: " + context }) }),
            fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt: task2 + " TEXT: " + context }) }),
            fetch('/api/analyze', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt: task3 + " TEXT: " + context }) })
        ]);

        const [d1, d2, d3] = await Promise.all([r1.json().then(JSON.parse), r2.json().then(JSON.parse), r3.json().then(JSON.parse)]);

        // COMBINE RESULTS
        const combinedChecks = [...(d1.checks || []), ...(d2.checks || []), ...(d3.checks || [])];
        protocolMetadata = d1.metadata || protocolMetadata;

        const finalResult = {
            analysis: d3.summary || "Audit Complete.",
            score: Math.round((combinedChecks.filter(c => c.status.toLowerCase().includes('yes') || c.status.toLowerCase().includes('pass')).length / combinedChecks.length) * 100) || 0,
            checks: combinedChecks
        };

        auditData = { consensus: finalResult, chairperson: finalResult, secretary: finalResult, lawyer: finalResult, clinician: finalResult, layperson: finalResult };
        
        document.getElementById('welcome').classList.add('hidden');
        document.getElementById('resultsUI').classList.remove('hidden');
        renderResult();
    } catch (e) {
        alert("Instant Audit failed. Please try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Run War Room Audit";
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
        const type = s.includes('yes') || s.includes('pass') ? 'success' : s.includes('not') ? 'modify' : 'scrutinize';
        html += `<div class="${type} shadow-sm border border-navy/5 p-4 rounded-xl mb-3">
            <p class="text-[7px] font-black uppercase opacity-40">Part ${c.part}</p>
            <p class="text-[10px] font-black uppercase text-navy">${c.item}</p>
            <p class="text-xs font-bold leading-tight mt-1 text-slate-600">${c.note}</p>
        </div>`;
    });
    document.getElementById('checklistItems').innerHTML = html;
    
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
    doc.text("Nexus Ethics Audit", 14, 15);
    doc.autoTable({
        startY: 25,
        head: [['Part', 'Criteria', 'Status', 'Observation']],
        body: data.checks.map(c => [c.part, c.item, c.status, c.note]),
        styles: { fontSize: 7 }
    });
    doc.save(`Audit_Report_${Date.now()}.pdf`);
}
