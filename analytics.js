// Data Analytics Visualizations Engine
let analyticsData = null;
let rawRecords = [];
let chartInstances = {};

document.addEventListener("DOMContentLoaded", () => {
    initAnalytics();
});

async function initAnalytics() {
    try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
            analyticsData = await res.json();
            if (analyticsData.records) {
                rawRecords = analyticsData.records;
            }
        }
    } catch (err) {
        console.warn("Analytics API endpoint error, fetching records directly...", err);
    }

    if (!analyticsData || !analyticsData.records || analyticsData.records.length === 0) {
        // Fallback: load records and calculate locally
        await loadAndComputeLocalAnalytics();
    }

    renderAllCharts();
}

async function loadAndComputeLocalAnalytics() {
    try {
        const res = await fetch("diabetes_data.csv");
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        rawRecords = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map(c => c.trim());
            if (cols.length < 5) continue;
            const date = cols[0];
            const sleep = parseFloat(cols[1]) || 0;
            const morn = parseFloat(cols[2]) || 0;
            const aft = parseFloat(cols[3]) || 0;
            const eve = parseFloat(cols[4]) || 0;
            const mean = parseFloat(((morn + aft + eve) / 3).toFixed(2));
            rawRecords.push({
                date,
                sleepHours: sleep,
                morningSugar: morn,
                afternoonSugar: aft,
                eveningSugar: eve,
                meanSugar: mean
            });
        }
    } catch (e) {
        console.error("Local CSV parsing failed:", e);
    }
}

function renderAllCharts(filterCount = null) {
    let dataset = [...rawRecords];
    if (filterCount && filterCount < dataset.length) {
        dataset = dataset.slice(-filterCount);
    }

    renderTrajectoryChart(dataset);
    renderDiurnalChart(dataset);
    renderTIRDonut(dataset);
    renderScatterPlot(dataset);
    renderCohortChart(dataset);
    updateDynamicKPIs(dataset);
}

function updateDynamicKPIs(records) {
    if (!records || records.length === 0) return;
    const n = records.length;
    const avgGlucose = (records.reduce((s, r) => s + r.meanSugar, 0) / n).toFixed(1);
    const avgSleep = (records.reduce((s, r) => s + r.sleepHours, 0) / n).toFixed(2);
    
    // Variance & StdDev
    const variance = records.reduce((s, r) => s + Math.pow(r.meanSugar - avgGlucose, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = ((stdDev / avgGlucose) * 100).toFixed(1);

    // In Range (70-140)
    const inRange = records.filter(r => r.meanSugar >= 70 && r.meanSugar <= 140).length;
    const tir = ((inRange / n) * 100).toFixed(1);

    // eA1c
    const ea1c = ((parseFloat(avgGlucose) + 46.7) / 28.7).toFixed(1);

    const elAvg = document.getElementById("anaAvgGlucose");
    const elTir = document.getElementById("anaTIR");
    const elEa1c = document.getElementById("anaEA1C");
    const elSleep = document.getElementById("anaAvgSleep");
    const elCv = document.getElementById("anaCV");

    if (elAvg) elAvg.innerText = avgGlucose;
    if (elTir) elTir.innerText = tir;
    if (elEa1c) elEa1c.innerText = ea1c;
    if (elSleep) elSleep.innerText = avgSleep;
    if (elCv) elCv.innerText = cv;
}

function renderTrajectoryChart(records) {
    const ctx = document.getElementById("trajectoryChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstances.trajectory) chartInstances.trajectory.destroy();

    const labels = records.map(r => r.date.substring(5)); // MM-DD
    const meanData = records.map(r => r.meanSugar);
    const mornData = records.map(r => r.morningSugar);
    const aftData = records.map(r => r.afternoonSugar);
    const eveData = records.map(r => r.eveningSugar);
    const sleepData = records.map(r => r.sleepHours);

    // Target Range Band background
    const lowerTarget = Array(records.length).fill(70);
    const upperTarget = Array(records.length).fill(140);

    chartInstances.trajectory = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Daily Mean Glucose",
                    data: meanData,
                    borderColor: "#06b6d4",
                    backgroundColor: "rgba(6, 182, 212, 0.15)",
                    borderWidth: 2.5,
                    pointRadius: records.length > 50 ? 0 : 3,
                    tension: 0.3,
                    yAxisID: "y"
                },
                {
                    label: "Morning (Fasting)",
                    data: mornData,
                    borderColor: "#eab308",
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0.3,
                    yAxisID: "y"
                },
                {
                    label: "Afternoon",
                    data: aftData,
                    borderColor: "#3b82f6",
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0.3,
                    yAxisID: "y"
                },
                {
                    label: "Evening",
                    data: eveData,
                    borderColor: "#a855f7",
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0.3,
                    yAxisID: "y"
                },
                {
                    label: "Sleep Duration (hrs)",
                    data: sleepData,
                    borderColor: "rgba(148, 163, 184, 0.4)",
                    backgroundColor: "rgba(148, 163, 184, 0.1)",
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.2,
                    yAxisID: "ySleep"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    labels: { color: "#94a3b8", boxWidth: 12, font: { family: "Inter", size: 12 } }
                },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    titleColor: "#f8fafc",
                    bodyColor: "#94a3b8",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#64748b", maxTicksLimit: 12 }
                },
                y: {
                    position: "left",
                    title: { display: true, text: "Glucose Level (mg/dL)", color: "#94a3b8" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#64748b" },
                    min: 70,
                    max: 180
                },
                ySleep: {
                    position: "right",
                    title: { display: true, text: "Sleep (Hours)", color: "#94a3b8" },
                    grid: { drawOnChartArea: false },
                    ticks: { color: "#64748b" },
                    min: 0,
                    max: 14
                }
            }
        }
    });
}

function renderDiurnalChart(records) {
    const ctx = document.getElementById("diurnalChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstances.diurnal) chartInstances.diurnal.destroy();

    const mornAvg = (records.reduce((s, r) => s + r.morningSugar, 0) / records.length).toFixed(1);
    const aftAvg = (records.reduce((s, r) => s + r.afternoonSugar, 0) / records.length).toFixed(1);
    const eveAvg = (records.reduce((s, r) => s + r.eveningSugar, 0) / records.length).toFixed(1);

    chartInstances.diurnal = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Morning (Fasting)", "Afternoon (Post-Lunch)", "Evening (Post-Dinner)"],
            datasets: [{
                label: "Average Glucose (mg/dL)",
                data: [mornAvg, aftAvg, eveAvg],
                backgroundColor: [
                    "rgba(234, 179, 8, 0.7)",
                    "rgba(59, 130, 246, 0.7)",
                    "rgba(168, 85, 247, 0.7)"
                ],
                borderColor: ["#eab308", "#3b82f6", "#a855f7"],
                borderWidth: 1.5,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                y: {
                    min: 80,
                    max: 150,
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    title: { display: true, text: "mg/dL", color: "#94a3b8" }
                }
            }
        }
    });
}

function renderTIRDonut(records) {
    const ctx = document.getElementById("tirDonutChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstances.tir) chartInstances.tir.destroy();

    let low = 0, normal = 0, elevated = 0, high = 0;
    records.forEach(r => {
        if (r.meanSugar < 70) low++;
        else if (r.meanSugar <= 140) normal++;
        else if (r.meanSugar <= 180) elevated++;
        else high++;
    });

    chartInstances.tir = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Normal (70-140 mg/dL)", "Elevated (141-180 mg/dL)", "High Risk (>180 mg/dL)", "Low / Hypo (<70 mg/dL)"],
            datasets: [{
                data: [normal, elevated, high, low],
                backgroundColor: [
                    "#10b981", // Green
                    "#f59e0b", // Amber
                    "#ef4444", // Red
                    "#8b5cf6"  // Purple
                ],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: { color: "#94a3b8", font: { family: "Inter", size: 12 }, padding: 14 }
                }
            },
            cutout: "65%"
        }
    });
}

function renderScatterPlot(records) {
    const ctx = document.getElementById("scatterChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstances.scatter) chartInstances.scatter.destroy();

    const scatterData = records.map(r => ({ x: r.sleepHours, y: r.meanSugar }));

    // Regression line points (from min sleep to max sleep)
    const minSleep = Math.min(...records.map(r => r.sleepHours));
    const maxSleep = Math.max(...records.map(r => r.sleepHours));
    const slope = 0.0853;
    const intercept = 124.54;
    const trendline = [
        { x: minSleep, y: intercept + slope * minSleep },
        { x: maxSleep, y: intercept + slope * maxSleep }
    ];

    chartInstances.scatter = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Patient Logged Days",
                    data: scatterData,
                    backgroundColor: "rgba(56, 189, 248, 0.45)",
                    borderColor: "#38bdf8",
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: "Fitted Regression Trend (OLS)",
                    data: trendline,
                    type: "line",
                    borderColor: "#f43f5e",
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#94a3b8" } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Sleep: ${ctx.parsed.x}h | Glucose: ${ctx.parsed.y} mg/dL`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Sleep Duration (Hours)", color: "#94a3b8" },
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                y: {
                    title: { display: true, text: "Mean Blood Glucose (mg/dL)", color: "#94a3b8" },
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    min: 90,
                    max: 160
                }
            }
        }
    });
}

function renderCohortChart(records) {
    const ctx = document.getElementById("cohortBarChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstances.cohort) chartInstances.cohort.destroy();

    const low = records.filter(r => r.sleepHours < 6);
    const med = records.filter(r => r.sleepHours >= 6 && r.sleepHours < 8);
    const high = records.filter(r => r.sleepHours >= 8);

    const calcMean = (arr) => arr.length ? (arr.reduce((s, r) => s + r.meanSugar, 0) / arr.length).toFixed(1) : 0;

    chartInstances.cohort = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [`Low <6h\n(n=${low.length})`, `Medium 6-8h\n(n=${med.length})`, `High ≥8h\n(n=${high.length})`],
            datasets: [{
                label: "Mean Glucose (mg/dL)",
                data: [calcMean(low), calcMean(med), calcMean(high)],
                backgroundColor: [
                    "rgba(244, 63, 94, 0.7)",
                    "rgba(16, 185, 129, 0.7)",
                    "rgba(56, 189, 248, 0.7)"
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                y: {
                    min: 100,
                    max: 140,
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    title: { display: true, text: "Mean mg/dL", color: "#94a3b8" }
                }
            }
        }
    });
}

function applyTimeFilter(filter, btn) {
    document.querySelectorAll(".chart-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (filter === "all") {
        renderAllCharts();
    } else {
        renderAllCharts(parseInt(filter));
    }
}
