// Diabetes Tracker & Record Management
let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
let pageSize = 15;

document.addEventListener("DOMContentLoaded", () => {
    loadRecords();
    setupEventListeners();
});

// Load records from backend API or fallback to CSV file directly
async function loadRecords() {
    try {
        const response = await fetch("/api/records");
        if (response.ok) {
            const data = await response.json();
            if (data.records && data.records.length > 0) {
                allRecords = data.records;
                initTable();
                return;
            }
        }
    } catch (err) {
        console.warn("Backend API not reachable, attempting direct CSV fetch...", err);
    }

    // Fallback: fetch CSV file directly
    try {
        const response = await fetch("diabetes_data.csv");
        if (response.ok) {
            const text = await response.text();
            parseRawCSV(text);
            initTable();
        } else {
            console.error("Could not fetch diabetes_data.csv directly");
        }
    } catch (err) {
        console.error("Failed to load records from CSV:", err);
    }
}

function parseRawCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) return;
    
    allRecords = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(",").map(c => c.trim());
        if (cols.length < 5) continue;

        const date = cols[0];
        const sleepHours = parseFloat(cols[1]) || 0;
        const morningSugar = parseFloat(cols[2]) || 0;
        const afternoonSugar = parseFloat(cols[3]) || 0;
        const eveningSugar = parseFloat(cols[4]) || 0;
        const meanSugar = parseFloat(((morningSugar + afternoonSugar + eveningSugar) / 3).toFixed(2));

        let status = "Normal";
        let statusClass = "status-normal";
        if (meanSugar < 70) {
            status = "Low (Hypo)";
            statusClass = "status-low";
        } else if (meanSugar > 180) {
            status = "High (Hyper)";
            statusClass = "status-high";
        } else if (meanSugar >= 140) {
            status = "Elevated";
            statusClass = "status-elevated";
        }

        allRecords.push({
            date,
            sleepHours,
            morningSugar,
            afternoonSugar,
            eveningSugar,
            meanSugar,
            status,
            statusClass
        });
    }
}

function initTable() {
    filteredRecords = [...allRecords].reverse(); // Show latest entries first
    updateKPIs();
    renderTable();
}

function updateKPIs() {
    if (allRecords.length === 0) return;
    
    const countEl = document.getElementById("kpiTotalEntries");
    const avgSugarEl = document.getElementById("kpiAvgSugar");
    const avgSleepEl = document.getElementById("kpiAvgSleep");
    const statusEl = document.getElementById("kpiHealthStatus");

    const totalSleep = allRecords.reduce((acc, r) => acc + r.sleepHours, 0);
    const totalSugar = allRecords.reduce((acc, r) => acc + r.meanSugar, 0);

    const avgSugar = (totalSugar / allRecords.length).toFixed(1);
    const avgSleep = (totalSleep / allRecords.length).toFixed(1);

    if (countEl) countEl.innerText = allRecords.length;
    if (avgSugarEl) avgSugarEl.innerText = avgSugar;
    if (avgSleepEl) avgSleepEl.innerText = avgSleep;

    if (statusEl) {
        if (avgSugar < 140) {
            statusEl.className = "kpi-badge badge-success";
            statusEl.innerText = "Optimal Control (<140)";
        } else if (avgSugar <= 180) {
            statusEl.className = "kpi-badge badge-warning";
            statusEl.innerText = "Elevated Control";
        } else {
            statusEl.className = "kpi-badge badge-danger";
            statusEl.innerText = "High Risk";
        }
    }
}

function renderTable() {
    const tbody = document.querySelector("#trackerTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const total = filteredRecords.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const pageRecords = filteredRecords.slice(startIdx, startIdx + pageSize);

    if (pageRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-dim);">No matching records found.</td></tr>`;
        updatePaginationInfo(0, 0, 0);
        return;
    }

    pageRecords.forEach((r, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${r.date}</strong></td>
            <td>${r.sleepHours.toFixed(1)} hrs</td>
            <td>${r.morningSugar} mg/dL</td>
            <td>${r.afternoonSugar} mg/dL</td>
            <td>${r.eveningSugar} mg/dL</td>
            <td><strong>${r.meanSugar}</strong> mg/dL</td>
            <td><span class="status-pill ${r.statusClass}">${r.status}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteEntry('${r.date}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationInfo(startIdx + 1, Math.min(startIdx + pageSize, total), total);
}

function updatePaginationInfo(start, end, total) {
    const infoEl = document.getElementById("paginationInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (infoEl) infoEl.innerText = `Showing ${start} to ${end} of ${total} entries`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= Math.ceil(total / pageSize);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredRecords.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

function handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        filteredRecords = [...allRecords].reverse();
    } else {
        filteredRecords = allRecords.filter(r => 
            r.date.includes(q) || 
            r.status.toLowerCase().includes(q) ||
            r.meanSugar.toString().includes(q)
        ).reverse();
    }
    currentPage = 1;
    renderTable();
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1;
    renderTable();
}

// Delete entry
async function deleteEntry(date) {
    if (!confirm(`Are you sure you want to delete the record for ${date}?`)) return;

    allRecords = allRecords.filter(r => r.date !== date);
    handleSearch(document.getElementById("searchInput")?.value || "");
    updateKPIs();

    // Notify backend
    try {
        await fetch(`/api/records/${date}`, { method: "DELETE" });
    } catch (err) {
        console.warn("Could not sync delete with server, saved locally.");
    }
}

// Modal open/close for adding entry
function openAddModal() {
    const modal = document.getElementById("addEntryModal");
    if (modal) {
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("entryDate").value = today;
        document.getElementById("entrySleep").value = "7.5";
        document.getElementById("entryMorning").value = "115";
        document.getElementById("entryAfternoon").value = "125";
        document.getElementById("entryEvening").value = "120";
        modal.style.display = "flex";
    }
}

function closeAddModal() {
    const modal = document.getElementById("addEntryModal");
    if (modal) modal.style.display = "none";
}

// Save new entry from modal
async function submitNewEntry(e) {
    if (e) e.preventDefault();

    const date = document.getElementById("entryDate").value;
    const sleepHours = parseFloat(document.getElementById("entrySleep").value) || 0;
    const morningSugar = parseFloat(document.getElementById("entryMorning").value) || 0;
    const afternoonSugar = parseFloat(document.getElementById("entryAfternoon").value) || 0;
    const eveningSugar = parseFloat(document.getElementById("entryEvening").value) || 0;

    if (!date) {
        alert("Please select a date.");
        return;
    }

    const meanSugar = parseFloat(((morningSugar + afternoonSugar + eveningSugar) / 3).toFixed(2));
    let status = "Normal";
    let statusClass = "status-normal";
    if (meanSugar < 70) {
        status = "Low (Hypo)";
        statusClass = "status-low";
    } else if (meanSugar > 180) {
        status = "High (Hyper)";
        statusClass = "status-high";
    } else if (meanSugar >= 140) {
        status = "Elevated";
        statusClass = "status-elevated";
    }

    const newRec = {
        date,
        sleepHours,
        morningSugar,
        afternoonSugar,
        eveningSugar,
        meanSugar,
        status,
        statusClass,
        actions: "Delete"
    };

    // Update in-memory
    const existingIndex = allRecords.findIndex(r => r.date === date);
    if (existingIndex >= 0) {
        allRecords[existingIndex] = newRec;
    } else {
        allRecords.push(newRec);
    }

    allRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    handleSearch(document.getElementById("searchInput")?.value || "");
    updateKPIs();
    closeAddModal();

    // Sync to backend
    try {
        const res = await fetch("/api/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRec)
        });
        const data = await res.json();
        if (data.success) {
            showToast("Record successfully saved to server!");
        }
    } catch (err) {
        console.warn("Backend not available, changes preserved in local session.");
        showToast("Record saved locally.");
    }
}

// Save CSV to server (Compatibility endpoint)
function saveCSVToServer() {
    let csvData = "Date,Sleep Hours,Morning Sugar Level,Afternoon Sugar Level,Evening Sugar Level,Actions\n";
    allRecords.forEach(r => {
        csvData += `${r.date},${r.sleepHours},${r.morningSugar},${r.afternoonSugar},${r.eveningSugar},Delete\n`;
    });

    fetch("http://localhost:3000/save-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData })
    })
    .then(response => response.text())
    .then(message => showToast(message || "CSV updated successfully!"))
    .catch(error => {
        console.error("Error:", error);
        showToast("Saved locally (Server error: " + error.message + ")");
    });
}

// Download CSV file
function downloadCSV() {
    window.location.href = "/download-csv";
}

function showToast(msg) {
    let toast = document.getElementById("appToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        toast.style.cssText = "position: fixed; bottom: 24px; right: 24px; background: #06b6d4; color: white; padding: 12px 24px; border-radius: 9999px; font-weight: 600; box-shadow: 0 10px 25px rgba(6,182,212,0.4); z-index: 9999; transition: all 0.3s;";
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
    }, 3000);
}

function setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
    }
    const addForm = document.getElementById("addEntryForm");
    if (addForm) {
        addForm.addEventListener("submit", submitNewEntry);
    }
}
