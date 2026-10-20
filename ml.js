// ── GlucoPulse AI — Machine Learning (Pima Indians Dataset) ─────────────────
let featureChart = null;

document.addEventListener("DOMContentLoaded", () => {
    loadMLDiagnostics();
    runPrediction(); // show default result
});

// ── Load ML diagnostics from API ──────────────────────────────────────────────
async function loadMLDiagnostics() {
    try {
        const res  = await fetch("/api/ml-info");
        const json = await res.json();
        if (json.success && json.data) {
            populateDiagnostics(json.data);
        }
    } catch (e) {
        console.warn("ML-info API unavailable:", e);
    }
}

function populateDiagnostics(d) {
    const lr = d.logistic_regression || d.linear_regression || {};

    // Accuracy & metrics
    if (lr.accuracy !== undefined) {
        setEl("metricAccuracy", (lr.accuracy * 100).toFixed(1));
        setEl("metricAUC",      (lr.auc_roc || 0).toFixed(4));
        setEl("metricF1",       (lr.f1_score || 0).toFixed(4));
        setEl("metricRecall",   ((lr.recall || 0) * 100).toFixed(1));
        setEl("metricPrecision", ((lr.precision || 0) * 100).toFixed(1) + "%");
    }

    // Dataset size
    if (d.dataset_size) {
        setEl("metricDataset", d.dataset_size);
        setEl("metricDatasetBadge", d.dataset_source || "NIDDK Real Data");
    }

    // Equation
    if (lr.equation) setEl("regressionEquation", lr.equation);

    // Confusion matrix
    if (lr.confusion_matrix && lr.confusion_matrix.length === 2) {
        const [[tn, fp], [fn, tp]] = lr.confusion_matrix;
        setEl("cmTN", tn); setEl("cmFP", fp);
        setEl("cmFN", fn); setEl("cmTP", tp);
    }

    // Feature importance chart
    if (d.feature_importance) renderFeatureChart(d.feature_importance);

    // ANOVA
    if (d.anova) {
        const a = d.anova;
        const badge = document.getElementById("anovaBadge");
        if (badge) {
            badge.textContent = `F = ${a.f_statistic}, p ${a.p_value < 0.0001 ? "< 0.0001" : "= " + a.p_value}`;
            badge.className   = `kpi-badge ${a.is_significant ? "badge-danger" : "badge-primary"}`;
        }
        // Build rich interpretation with <strong> tags
        const interp = d.shapiro_wilk
            ? `Glucose levels differ significantly between diabetic (<strong>μ = ${d.shapiro_wilk.Diabetic?.mean || "141.3"} mg/dL</strong>) and non-diabetic (<strong>μ = ${d.shapiro_wilk["Non-Diabetic"]?.mean || "110.0"} mg/dL</strong>) groups &mdash; an ANOVA F-statistic of <strong>${a.f_statistic}</strong> with <strong>p ${a.p_value < 0.0001 ? "&lt; 0.0001" : "= " + a.p_value}</strong> strongly rejects the null hypothesis (H₀: no difference).`
            : a.interpretation;
        setHTML("anovaInterpretation", interp);

        // Update stat boxes with real values from shapiro_wilk
        if (d.shapiro_wilk) {
            const diabMeanEl = document.querySelector("[style*='color:#ef4444']");
            const ndMeanEl   = document.querySelector("[style*='color:#10b981']");
            if (diabMeanEl)  diabMeanEl.textContent  = `${d.shapiro_wilk.Diabetic?.mean || 141.3} mg/dL`;
            if (ndMeanEl)    ndMeanEl.textContent     = `${d.shapiro_wilk["Non-Diabetic"]?.mean || 110.0} mg/dL`;
        }
    }

    // Shapiro-Wilk
    if (d.shapiro_wilk) renderShapiro(d.shapiro_wilk);
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ── Feature Importance Chart ──────────────────────────────────────────────────
function renderFeatureChart(importance) {
    const sorted = Object.entries(importance).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([k]) => k);
    const values = sorted.map(([, v]) => (v * 100).toFixed(2));
    const colors = [
        "rgba(239,68,68,0.85)", "rgba(245,158,11,0.85)", "rgba(99,102,241,0.85)",
        "rgba(16,185,129,0.85)", "rgba(56,189,248,0.85)", "rgba(168,85,247,0.85)",
        "rgba(236,72,153,0.85)", "rgba(20,184,166,0.85)"
    ];

    if (featureChart) featureChart.destroy();
    featureChart = new Chart(document.getElementById("featureImportanceChart"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Importance (%)",
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8" }
            },
            scales: {
                x: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#94a3b8" }, beginAtZero: true,
                     title: { display: true, text: "Importance (%)", color: "#94a3b8" } },
                y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#94a3b8" } }
            }
        }
    });
}

// ── Shapiro-Wilk table ────────────────────────────────────────────────────────
function renderShapiro(sw) {
    const container = document.getElementById("shapiroWilkRows");
    if (!container) return;
    container.innerHTML = Object.entries(sw).map(([group, s]) => `
        <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px">${group}</td>
            <td style="padding:10px; text-align:center">${s.W}</td>
            <td style="padding:10px; text-align:center">${s.p}</td>
            <td style="padding:10px; text-align:center">${s.count}</td>
            <td style="padding:10px; text-align:center">
                <span class="status-badge ${s.is_normal ? "status-normal" : "status-high"}">${s.is_normal ? "Yes" : "No"}</span>
            </td>
        </tr>
    `).join("");
}

// ── Python runner ─────────────────────────────────────────────────────────────
async function executePythonAnalysis() {
    const btn      = document.getElementById("btnRunPython");
    const terminal = document.getElementById("pythonTerminalOutput");
    const boxWrap  = document.getElementById("pythonBoxplotWrap");
    const boxImg   = document.getElementById("pythonBoxplotImg");

    btn.disabled    = true;
    btn.textContent = "⏳ Running analysis.py…";
    terminal.textContent = "$ python analysis.py\n\nRunning Logistic Regression on Pima dataset…\n";

    try {
        const res  = await fetch("/api/run-python", { method: "POST" });
        const data = await res.json();

        terminal.textContent = `$ python analysis.py\n\n${data.stdout || ""}${data.stderr ? "\nSTDERR:\n" + data.stderr : ""}`;

        if (data.hasPlot) {
            boxWrap.style.display = "block";
            boxImg.src = `pima_boxplot.png?t=${Date.now()}`;
        }

        if (data.success) {
            await loadMLDiagnostics();
        }
    } catch (e) {
        terminal.textContent = "Error: Could not reach the server. Is node server.js running?";
    } finally {
        btn.disabled    = false;
        btn.textContent = "▶ Run analysis.py & Retrain Model";
    }
}

// ── Diabetes Risk Prediction ──────────────────────────────────────────────────
async function runPrediction() {
    const payload = {
        glucose:       document.getElementById("predGlucose")?.value     || 120,
        bmi:           document.getElementById("predBMI")?.value          || 28.5,
        age:           document.getElementById("predAge")?.value          || 33,
        pedigree:      document.getElementById("predPedigree")?.value     || 0.471,
        insulin:       document.getElementById("predInsulin")?.value      || 80,
        bloodPressure: document.getElementById("predBP")?.value           || 72,
        pregnancies:   document.getElementById("predPregnancies")?.value  || 1,
        skinThickness: document.getElementById("predSkin")?.value         || 23
    };

    try {
        const res  = await fetch("/api/predict", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) displayPrediction(data.predictions);
    } catch (e) {
        // Fallback: compute logistic regression locally
        const logit = -8.2399
            + (0.0318  * parseFloat(payload.glucose))
            + (0.0126  * parseFloat(payload.bmi))
            + (0.0133  * parseFloat(payload.age))
            + (0.3410  * parseFloat(payload.pedigree))
            + (0.0012  * parseFloat(payload.insulin))
            + (-0.0115 * parseFloat(payload.bloodPressure))
            + (0.0640  * parseFloat(payload.pregnancies))
            + (0.0009  * parseFloat(payload.skinThickness));
        const prob        = 1 / (1 + Math.exp(-logit));
        const riskPercent = Math.round(prob * 100);
        let riskCategory, riskColor;
        if (riskPercent < 25)      { riskCategory = "Low Risk";       riskColor = "#10b981"; }
        else if (riskPercent < 50) { riskCategory = "Moderate Risk";  riskColor = "#f59e0b"; }
        else if (riskPercent < 70) { riskCategory = "High Risk";      riskColor = "#f97316"; }
        else                       { riskCategory = "Very High Risk"; riskColor = "#ef4444"; }
        displayPrediction({ riskPercent, riskCategory, riskColor, recommendations: [] });
    }
}

function displayPrediction(p) {
    const result = document.getElementById("predResult");
    result.style.display = "block";

    document.documentElement.style.setProperty("--pred-color", p.riskColor || "#6366f1");
    setEl("predRiskPct",   p.riskPercent + "%");
    setEl("predRiskLabel", p.riskCategory);

    const bar = document.getElementById("predRiskBar");
    if (bar) {
        setTimeout(() => { bar.style.width = p.riskPercent + "%"; }, 50);
    }

    const recsEl = document.getElementById("predRecommendations");
    if (recsEl && p.recommendations && p.recommendations.length) {
        recsEl.innerHTML = p.recommendations.map(r =>
            `<div style="padding:10px 14px; background:var(--bg-primary); border-radius:8px; border-left:3px solid ${p.riskColor}; font-size:13.5px; color:var(--text-secondary); line-height:1.6">${r}</div>`
        ).join("");
    }
}
