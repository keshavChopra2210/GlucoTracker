// ── GlucoPulse AI — Analytics (Pima Indians Dataset) ──────────────────────
let analyticsData = null;
let rawRecords    = [];
const charts = {};

const ACCENT = {
    diabetic:    "rgba(239,68,68,0.85)",
    nonDiabetic: "rgba(16,185,129,0.85)",
    primary:     "rgba(99,102,241,0.85)",
    amber:       "rgba(245,158,11,0.85)",
    sky:         "rgba(56,189,248,0.85)",
    grid:        "rgba(255,255,255,0.06)",
    gridLine:    "rgba(255,255,255,0.08)"
};

Chart.defaults.color = "#94a3b8";
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

document.addEventListener("DOMContentLoaded", initAnalytics);

async function initAnalytics() {
    try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
            analyticsData = await res.json();
            rawRecords = analyticsData.records || [];
        }
    } catch (e) {
        console.warn("API unavailable, loading CSV…");
    }

    if (!analyticsData || !analyticsData.kpis) {
        await loadFromCSV();
    }

    if (!analyticsData) return;
    updateKPIs();
    renderOutcomeChart();
    renderGlucoseDistChart();
    renderBMIChart();
    renderAgeChart();
    renderPregChart();
    renderScatterChart();
    buildStatsTable();
}

// ── CSV Fallback ─────────────────────────────────────────────────────────────
async function loadFromCSV() {
    try {
        const res  = await fetch("diabetes_data.csv");
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        rawRecords = [];
        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(",").map(s => s.trim());
            if (c.length < 9) continue;
            rawRecords.push({
                patientId:     c[0],
                pregnancies:   parseFloat(c[1]) || 0,
                glucose:       parseFloat(c[2]) || 0,
                bloodPressure: parseFloat(c[3]) || 0,
                skinThickness: parseFloat(c[4]) || 0,
                insulin:       parseFloat(c[5]) || 0,
                bmi:           parseFloat(c[6]) || 0,
                pedigree:      parseFloat(c[7]) || 0,
                age:           parseInt(c[8])   || 0,
                outcome:       parseInt(c[9])   || 0
            });
        }
        computeAnalyticsLocally();
    } catch (e) { console.error(e); }
}

function computeAnalyticsLocally() {
    const n = rawRecords.length;
    if (!n) return;

    const avg  = f => rawRecords.reduce((s, r) => s + r[f], 0) / n;
    const avgG = parseFloat(avg("glucose").toFixed(2));
    const diabeticCount    = rawRecords.filter(r => r.outcome === 1).length;
    const nonDiabeticCount = n - diabeticCount;

    analyticsData = {
        kpis: {
            totalCount: n, diabeticCount, nonDiabeticCount,
            diabeticRate: parseFloat((diabeticCount / n * 100).toFixed(1)),
            avgGlucose: avgG,
            avgBMI:     parseFloat(avg("bmi").toFixed(2)),
            avgAge:     parseFloat(avg("age").toFixed(1)),
            avgInsulin: parseFloat(avg("insulin").toFixed(1)),
            avgBP:      parseFloat(avg("bloodPressure").toFixed(1)),
            stdGlucose: 0
        },
        glucoseDistribution: {
            normalCount:    rawRecords.filter(r => r.glucose < 100).length,
            preDiabCount:   rawRecords.filter(r => r.glucose >= 100 && r.glucose < 126).length,
            diabRangeCount: rawRecords.filter(r => r.glucose >= 126).length
        },
        bmiGroups: {
            underweight: rawRecords.filter(r => r.bmi < 18.5).length,
            normal:      rawRecords.filter(r => r.bmi >= 18.5 && r.bmi < 25).length,
            overweight:  rawRecords.filter(r => r.bmi >= 25 && r.bmi < 30).length,
            obese:       rawRecords.filter(r => r.bmi >= 30).length
        },
        ageGroups: {
            "21-30": rawRecords.filter(r => r.age >= 21 && r.age <= 30).length,
            "31-40": rawRecords.filter(r => r.age >= 31 && r.age <= 40).length,
            "41-50": rawRecords.filter(r => r.age >= 41 && r.age <= 50).length,
            "51-60": rawRecords.filter(r => r.age >= 51 && r.age <= 60).length,
            "61+":   rawRecords.filter(r => r.age >= 61).length
        },
        pregCohorts: buildPregCohorts(),
        records: rawRecords
    };
}

function buildPregCohorts() {
    const def = { "0": r => r.pregnancies === 0, "1-3": r => r.pregnancies >= 1 && r.pregnancies <= 3,
                  "4-6": r => r.pregnancies >= 4 && r.pregnancies <= 6, "7+": r => r.pregnancies >= 7 };
    const out = {};
    for (const [k, fn] of Object.entries(def)) {
        const grp = rawRecords.filter(fn);
        const d   = grp.filter(r => r.outcome === 1).length;
        out[k] = { count: grp.length, diabeticRate: grp.length ? parseFloat((d / grp.length * 100).toFixed(1)) : 0 };
    }
    return out;
}

// ── KPI update ───────────────────────────────────────────────────────────────
function updateKPIs() {
    const k = analyticsData.kpis;
    setEl("aKpiDiabeticRate", k.diabeticRate);
    setEl("aKpiAvgGlucose",   k.avgGlucose);
    setEl("aKpiAvgBMI",       k.avgBMI);
    setEl("aKpiAvgAge",       k.avgAge);
    setEl("aKpiAvgInsulin",   k.avgInsulin);

    // Dynamically update the diabetic count badge (e.g. "268 / 768")
    const diabeticBadge = document.querySelector("#aKpiDiabeticRate")?.closest(".kpi-card")?.querySelector(".kpi-badge");
    if (diabeticBadge) diabeticBadge.textContent = `${k.diabeticCount} / ${k.totalCount}`;

    // Glucose status badge
    const glucoseBadge = document.querySelector("#aKpiAvgGlucose")?.closest(".kpi-card")?.querySelector(".kpi-badge");
    if (glucoseBadge) {
        const g = k.avgGlucose;
        if (g < 100)       { glucoseBadge.textContent = "Normal Range";      glucoseBadge.className = "kpi-badge badge-success"; }
        else if (g < 126)  { glucoseBadge.textContent = "Pre-Diabetic Range"; glucoseBadge.className = "kpi-badge badge-warning"; }
        else               { glucoseBadge.textContent = "Diabetic Range";     glucoseBadge.className = "kpi-badge badge-danger"; }
    }
}
function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function chartOpts(extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { labels: { color: "#94a3b8", padding: 16, font: { size: 12 } } }, tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8" } },
        ...extra
    };
}

// 1. Outcome Donut
function renderOutcomeChart() {
    const { diabeticCount, nonDiabeticCount } = analyticsData.kpis;
    charts.outcome = new Chart(document.getElementById("outcomeChart"), {
        type: "doughnut",
        data: {
            labels: ["Diabetic (1)", "Non-Diabetic (0)"],
            datasets: [{ data: [diabeticCount, nonDiabeticCount],
                         backgroundColor: [ACCENT.diabetic, ACCENT.nonDiabetic],
                         borderColor: ["#ef4444","#10b981"], borderWidth: 2, hoverOffset: 8 }]
        },
        options: chartOpts({ cutout: "62%", plugins: {
            legend: { position: "bottom", labels: { color: "#94a3b8" } },
            tooltip: { backgroundColor: "#1e293b" }
        }})
    });
}

// 2. Glucose distribution bar
function renderGlucoseDistChart() {
    const { normalCount, preDiabCount, diabRangeCount } = analyticsData.glucoseDistribution;
    charts.glucoseDist = new Chart(document.getElementById("glucoseDistChart"), {
        type: "bar",
        data: {
            labels: ["Normal\n(<100 mg/dL)", "Pre-Diabetic\n(100–125)", "Diabetic Range\n(≥126)"],
            datasets: [{ label: "Patients", data: [normalCount, preDiabCount, diabRangeCount],
                backgroundColor: [ACCENT.nonDiabetic, ACCENT.amber, ACCENT.diabetic],
                borderRadius: 8, borderSkipped: false }]
        },
        options: chartOpts({ scales: {
            x: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" } },
            y: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" }, beginAtZero: true }
        }, plugins: { legend: { display: false } } })
    });
}

// 3. BMI groups
function renderBMIChart() {
    const bmi = analyticsData.bmiGroups;
    charts.bmi = new Chart(document.getElementById("bmiChart"), {
        type: "bar",
        data: {
            labels: ["Underweight\n(<18.5)", "Normal\n(18.5–24.9)", "Overweight\n(25–29.9)", "Obese\n(≥30)"],
            datasets: [{ label: "Patients", data: [bmi.underweight, bmi.normal, bmi.overweight, bmi.obese],
                backgroundColor: [ACCENT.sky, ACCENT.nonDiabetic, ACCENT.amber, ACCENT.diabetic],
                borderRadius: 8, borderSkipped: false }]
        },
        options: chartOpts({ scales: {
            x: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" } },
            y: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" }, beginAtZero: true }
        }, plugins: { legend: { display: false } } })
    });
}

// 4. Age groups
function renderAgeChart() {
    const ag = analyticsData.ageGroups;
    charts.age = new Chart(document.getElementById("ageChart"), {
        type: "bar",
        data: {
            labels: Object.keys(ag),
            datasets: [{ label: "Patients", data: Object.values(ag),
                backgroundColor: ACCENT.primary, borderRadius: 8, borderSkipped: false }]
        },
        options: chartOpts({ scales: {
            x: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" } },
            y: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" }, beginAtZero: true }
        }, plugins: { legend: { display: false } } })
    });
}

// 5. Pregnancy cohort diabetic rate
function renderPregChart() {
    const pc = analyticsData.pregCohorts;
    charts.preg = new Chart(document.getElementById("pregChart"), {
        type: "bar",
        data: {
            labels: Object.keys(pc).map(k => `${k} pregnancies\n(n=${pc[k].count})`),
            datasets: [{ label: "Diabetic Rate (%)", data: Object.values(pc).map(v => v.diabeticRate),
                backgroundColor: [ACCENT.nonDiabetic, ACCENT.amber, ACCENT.primary, ACCENT.diabetic],
                borderRadius: 8, borderSkipped: false }]
        },
        options: chartOpts({ scales: {
            x: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" } },
            y: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" }, beginAtZero: true, max: 80,
                 title: { display: true, text: "Diabetic Rate (%)", color: "#94a3b8" } }
        }, plugins: { legend: { display: false } } })
    });
}

// 6. Scatter: Glucose vs BMI
function renderScatterChart() {
    const records = analyticsData.records || rawRecords;
    const diabetic    = records.filter(r => r.outcome === 1)
                               .map(r => ({ x: r.glucose, y: r.bmi }));
    const nonDiabetic = records.filter(r => r.outcome === 0)
                               .map(r => ({ x: r.glucose, y: r.bmi }));

    charts.scatter = new Chart(document.getElementById("scatterChart"), {
        type: "scatter",
        data: {
            datasets: [
                { label: "Diabetic", data: diabetic,
                  backgroundColor: "rgba(239,68,68,0.45)", pointRadius: 4, pointHoverRadius: 6 },
                { label: "Non-Diabetic", data: nonDiabetic,
                  backgroundColor: "rgba(16,185,129,0.35)", pointRadius: 3.5, pointHoverRadius: 5.5 }
            ]
        },
        options: chartOpts({ scales: {
            x: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" },
                 title: { display: true, text: "Fasting Glucose (mg/dL)", color: "#94a3b8" } },
            y: { grid: { color: ACCENT.gridLine }, ticks: { color: "#94a3b8" },
                 title: { display: true, text: "BMI (kg/m²)", color: "#94a3b8" } }
        }})
    });
}

// ── Stats table ───────────────────────────────────────────────────────────────
function buildStatsTable() {
    const records = analyticsData.records || rawRecords;
    if (!records.length) return;

    const d  = records.filter(r => r.outcome === 1);
    const nd = records.filter(r => r.outcome === 0);

    const fields = [
        ["glucose",       "Fasting Glucose (mg/dL)"],
        ["bmi",           "BMI (kg/m²)"],
        ["age",           "Age (years)"],
        ["insulin",       "Insulin (μU/mL)"],
        ["bloodPressure", "Blood Pressure (mmHg)"],
        ["pregnancies",   "Pregnancies"],
        ["pedigree",      "Diabetes Pedigree Function"],
        ["skinThickness", "Skin Thickness (mm)"]
    ];

    const avg = (arr, f) => arr.length ? (arr.reduce((s, r) => s + r[f], 0) / arr.length) : 0;

    const rows = fields.map(([f, label]) => {
        const dm  = avg(d, f);
        const ndm = avg(nd, f);
        const all = avg(records, f);
        const diff = dm - ndm;
        const diffColor = diff > 0 ? "#ef4444" : "#10b981";
        return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px 16px; font-weight:500; color:var(--text-primary)">${label}</td>
            <td style="padding:10px 16px; text-align:center; color:#ef4444">${dm.toFixed(2)}</td>
            <td style="padding:10px 16px; text-align:center; color:#10b981">${ndm.toFixed(2)}</td>
            <td style="padding:10px 16px; text-align:center; color:var(--text-secondary)">${all.toFixed(2)}</td>
            <td style="padding:10px 16px; text-align:center; color:${diffColor}; font-weight:600">${diff > 0 ? "+" : ""}${diff.toFixed(2)}</td>
        </tr>`;
    });

    document.getElementById("statsTableBody").innerHTML = rows.join("");
}
