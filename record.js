// ── GlucoPulse AI — Patient Records (Pima Indians Dataset) ──────────────────
let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
let pageSize = 15;

document.addEventListener("DOMContentLoaded", () => {
    loadRecords();

    document.getElementById("searchInput").addEventListener("input", () => {
        currentPage = 1;
        filterTable();
    });

    document.getElementById("addEntryForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await submitNewPatient();
    });

    document.getElementById("editEntryForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await submitEditPatient();
    });
});

// ── Load records from API ────────────────────────────────────────────────────
async function loadRecords() {
    try {
        const res = await fetch("/api/records");
        if (res.ok) {
            const data = await res.json();
            if (data.records && data.records.length > 0) {
                allRecords = data.records;
                updateKPIs();
                filterTable();
                return;
            }
        }
    } catch (err) {
        console.warn("API not reachable, trying direct CSV…", err);
    }

    // Fallback: parse CSV directly
    try {
        const res = await fetch("diabetes_data.csv");
        if (res.ok) {
            const text = await res.text();
            parseRawCSV(text);
            updateKPIs();
            filterTable();
        }
    } catch (err) {
        console.error("Failed to load records:", err);
    }
}

// ── Parse CSV ────────────────────────────────────────────────────────────────
function parseRawCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

    allRecords = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        if (cols.length < 9) continue;

        const glucose = parseFloat(cols[2]) || 0;
        const bmi     = parseFloat(cols[6]) || 0;
        const outcome = parseInt(cols[9]) || 0;

        let glucoseStatus, glucoseClass;
        if (glucose < 100)        { glucoseStatus = "Normal";         glucoseClass = "status-normal"; }
        else if (glucose < 126)   { glucoseStatus = "Pre-Diabetic";   glucoseClass = "status-elevated"; }
        else                      { glucoseStatus = "Diabetic Range"; glucoseClass = "status-high"; }

        let bmiClass;
        if (bmi < 18.5) bmiClass = "Underweight";
        else if (bmi < 25) bmiClass = "Normal";
        else if (bmi < 30) bmiClass = "Overweight";
        else bmiClass = "Obese";

        allRecords.push({
            patientId:     cols[0],
            pregnancies:   parseFloat(cols[1]) || 0,
            glucose,
            bloodPressure: parseFloat(cols[3]) || 0,
            skinThickness: parseFloat(cols[4]) || 0,
            insulin:       parseFloat(cols[5]) || 0,
            bmi,
            pedigree:      parseFloat(cols[7]) || 0,
            age:           parseInt(cols[8]) || 0,
            outcome,
            label:         cols[10] || (outcome === 1 ? "Diabetic" : "Non-Diabetic"),
            glucoseStatus, glucoseClass, bmiClass
        });
    }
}

// ── KPI updates ──────────────────────────────────────────────────────────────
function updateKPIs() {
    const n = allRecords.length;
    if (!n) return;

    const diabetic = allRecords.filter(r => r.outcome === 1).length;
    const avgGlucose = (allRecords.reduce((s, r) => s + r.glucose, 0) / n).toFixed(1);
    const avgBMI     = (allRecords.reduce((s, r) => s + r.bmi, 0) / n).toFixed(2);
    const rate       = ((diabetic / n) * 100).toFixed(1);

    document.getElementById("kpiTotalEntries").textContent = n;
    document.getElementById("kpiDiabeticCount").textContent = diabetic;
    document.getElementById("kpiDiabeticRate").textContent  = `${rate}% Prevalence Rate`;
    document.getElementById("kpiAvgGlucose").textContent    = avgGlucose;
    document.getElementById("kpiAvgBMI").textContent        = avgBMI;

    const gEl = document.getElementById("kpiGlucoseStatus");
    const avg = parseFloat(avgGlucose);
    if (avg < 100) { gEl.textContent = "Normal Range"; gEl.className = "kpi-badge badge-success"; }
    else if (avg < 126) { gEl.textContent = "Pre-Diabetic Range"; gEl.className = "kpi-badge badge-warning"; }
    else { gEl.textContent = "Diabetic Range"; gEl.className = "kpi-badge badge-danger"; }
}

// ── Filter + render ──────────────────────────────────────────────────────────
function filterTable() {
    const query   = (document.getElementById("searchInput").value || "").toLowerCase();
    const outcome = document.getElementById("outcomeFilter")?.value || "all";

    filteredRecords = allRecords.filter(r => {
        const matchOutcome = outcome === "all" || r.outcome === parseInt(outcome);
        const matchSearch  = !query
            || r.patientId.toLowerCase().includes(query)
            || String(r.glucose).includes(query)
            || r.label.toLowerCase().includes(query)
            || r.bmiClass.toLowerCase().includes(query);
        return matchOutcome && matchSearch;
    });

    currentPage = 1;
    renderTable();
}

function changePageSize(size) {
    pageSize = parseInt(size);
    currentPage = 1;
    renderTable();
}

function prevPage() {
    if (currentPage > 1) { currentPage--; renderTable(); }
}

function nextPage() {
    const total = Math.ceil(filteredRecords.length / pageSize);
    if (currentPage < total) { currentPage++; renderTable(); }
}

// ── Render table rows ─────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.querySelector("#trackerTable tbody");
    const start = (currentPage - 1) * pageSize;
    const end   = Math.min(start + pageSize, filteredRecords.length);
    const page  = filteredRecords.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text-dim);">No matching patient records found.</td></tr>`;
        document.getElementById("paginationInfo").textContent = "0 results";
        document.getElementById("prevPageBtn").disabled = true;
        document.getElementById("nextPageBtn").disabled = true;
        return;
    }

    tbody.innerHTML = page.map(r => `
        <tr>
            <td><code style="font-size:12px;color:var(--accent-primary)">${r.patientId}</code></td>
            <td>${r.pregnancies}</td>
            <td><strong>${r.glucose}</strong></td>
            <td>${r.bloodPressure}</td>
            <td>${r.skinThickness}</td>
            <td>${r.insulin}</td>
            <td>${r.bmi.toFixed(1)} <small style="color:var(--text-dim)">(${r.bmiClass})</small></td>
            <td>${r.pedigree.toFixed(3)}</td>
            <td>${r.age}</td>
            <td><span class="status-badge ${r.glucoseClass}">${r.glucoseStatus}</span></td>
            <td><span class="status-badge ${r.outcome === 1 ? 'status-high' : 'status-normal'}">${r.label}</span></td>
            <td style="display:flex;gap:6px;align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal(${JSON.stringify(r).replace(/"/g, '&quot;')})" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="deleteRecord('${r.patientId}')" title="Delete" style="color:#f87171;border-color:rgba(239,68,68,0.3);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>
                </button>
            </td>
        </tr>
    `).join("");

    const total = Math.ceil(filteredRecords.length / pageSize);
    document.getElementById("paginationInfo").textContent =
        `Showing ${start + 1}–${end} of ${filteredRecords.length} patients`;
    document.getElementById("prevPageBtn").disabled = currentPage <= 1;
    document.getElementById("nextPageBtn").disabled = currentPage >= total;
}

// ── Add patient ───────────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById("addEntryModal").style.display = "flex";
}

function closeAddModal() {
    document.getElementById("addEntryModal").style.display = "none";
    document.getElementById("addEntryForm").reset();
}

async function submitNewPatient() {
    const payload = {
        pregnancies:   document.getElementById("entryPregnancies").value,
        glucose:       document.getElementById("entryGlucose").value,
        bloodPressure: document.getElementById("entryBP").value,
        skinThickness: document.getElementById("entrySkin").value,
        insulin:       document.getElementById("entryInsulin").value,
        bmi:           document.getElementById("entryBMI").value,
        pedigree:      document.getElementById("entryPedigree").value,
        age:           document.getElementById("entryAge").value,
        outcome:       document.getElementById("entryOutcome").value
    };

    try {
        const res = await fetch("/api/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeAddModal();
            await loadRecords();
            showToast("Patient record added successfully!", "success");
        } else {
            showToast(data.error || "Failed to save.", "error");
        }
    } catch (err) {
        showToast("Server error. Please try again.", "error");
    }
}

// ── Edit patient ──────────────────────────────────────────────────────────────
function openEditModal(record) {
    // record may come as a JSON string from the onclick attribute or as an object
    const r = typeof record === "string" ? JSON.parse(record) : record;
    document.getElementById("editPatientId").value    = r.patientId;
    document.getElementById("editPregnancies").value  = r.pregnancies;
    document.getElementById("editGlucose").value      = r.glucose;
    document.getElementById("editBP").value           = r.bloodPressure;
    document.getElementById("editSkin").value         = r.skinThickness;
    document.getElementById("editInsulin").value      = r.insulin;
    document.getElementById("editBMI").value          = r.bmi;
    document.getElementById("editPedigree").value     = r.pedigree;
    document.getElementById("editAge").value          = r.age;
    document.getElementById("editOutcome").value      = r.outcome;
    document.getElementById("editEntryModal").style.display = "flex";
}

function closeEditModal() {
    document.getElementById("editEntryModal").style.display = "none";
    document.getElementById("editEntryForm").reset();
}

async function submitEditPatient() {
    const patientId = document.getElementById("editPatientId").value;
    const payload = {
        pregnancies:   document.getElementById("editPregnancies").value,
        glucose:       document.getElementById("editGlucose").value,
        bloodPressure: document.getElementById("editBP").value,
        skinThickness: document.getElementById("editSkin").value,
        insulin:       document.getElementById("editInsulin").value,
        bmi:           document.getElementById("editBMI").value,
        pedigree:      document.getElementById("editPedigree").value,
        age:           document.getElementById("editAge").value,
        outcome:       document.getElementById("editOutcome").value
    };

    try {
        const res = await fetch(`/api/records/${encodeURIComponent(patientId)}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeEditModal();
            await loadRecords();
            showToast("Patient record updated!", "success");
        } else {
            showToast(data.error || "Update failed.", "error");
        }
    } catch (err) {
        showToast("Server error. Please try again.", "error");
    }
}

// ── Delete patient ────────────────────────────────────────────────────────────
async function deleteRecord(patientId) {
    if (!confirm(`Delete patient ${patientId}?`)) return;
    try {
        const res = await fetch(`/api/records/${encodeURIComponent(patientId)}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            await loadRecords();
            showToast("Patient deleted.", "success");
        } else {
            showToast(data.error || "Delete failed.", "error");
        }
    } catch (err) {
        showToast("Server error.", "error");
    }
}

// ── Download CSV ──────────────────────────────────────────────────────────────
function downloadCSV() {
    window.location.href = "/download-csv";
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("toast-show"), 10);
    setTimeout(() => { t.classList.remove("toast-show"); setTimeout(() => t.remove(), 400); }, 3000);
}
