// Machine Learning & AI Prediction Engine
let simulationChart = null;

document.addEventListener("DOMContentLoaded", () => {
    initSimulationChart();
    runPrediction();
    loadMLDiagnostics();
});

function updateSleepLabel(val) {
    const label = document.getElementById("sleepValLabel");
    if (label) label.innerText = parseFloat(val).toFixed(1) + " hrs";
    runPrediction();
}

async function runPrediction() {
    const sleep = parseFloat(document.getElementById("inputSleep")?.value) || 7.5;
    const morning = parseFloat(document.getElementById("inputMorning")?.value) || 115;
    const afternoon = parseFloat(document.getElementById("inputAfternoon")?.value) || 130;
    const activity = document.getElementById("inputActivity")?.value || "moderate";

    let result = null;

    // Try calling backend prediction API
    try {
        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sleepHours: sleep, morningSugar: morning, afternoonSugar: afternoon, activity })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.predictions) {
                result = data.predictions;
            }
        }
    } catch (err) {
        console.warn("Backend predict API unreachable, using client-side regression model...", err);
    }

    // Client-side fallback if backend API is not available
    if (!result) {
        // Multi-feature OLS Model: Evening = 119.67 - 0.138 * Sleep + 0.019 * Morning + 0.042 * Afternoon
        let activityFactor = 0;
        if (activity === "sedentary") activityFactor = 4.5;
        if (activity === "active") activityFactor = -5.0;

        const predEve = parseFloat((119.6689 - (0.1383 * sleep) + (0.0192 * morning) + (0.0419 * afternoon) + activityFactor).toFixed(1));
        const predMean = parseFloat(((morning + afternoon + predEve) / 3).toFixed(1));

        let riskCategory = "Optimal Glycemic Control";
        let riskColor = "#10b981";
        if (predMean < 70) {
            riskCategory = "Hypoglycemic Risk (Low)";
            riskColor = "#8b5cf6";
        } else if (predMean > 180) {
            riskCategory = "Hyperglycemic Alert (High)";
            riskColor = "#ef4444";
        } else if (predMean >= 140) {
            riskCategory = "Elevated Glucose Warning";
            riskColor = "#f59e0b";
        }

        const recs = [];
        if (sleep < 6) {
            recs.push("Sleep Debt Detected: Sleeping under 6 hours correlates with elevated cortisol and insulin resistance. Aim for 7 to 8.5 hours.");
        } else if (sleep > 9) {
            recs.push("Prolonged Sleep: Oversleeping can sometimes correlate with sluggish daytime metabolism. Ensure regular physical movement.");
        } else {
            recs.push("Sleep Range Optimal: " + sleep.toFixed(1) + " hours provides healthy restorative sleep for glucose homeostasis.");
        }

        if (predEve > 140) {
            recs.push("Post-Dinner Spike Prevention: Consider an evening 15-minute walk and limit late-night carbohydrates.");
        } else {
            recs.push("Evening Stability: Evening glucose is projected to remain comfortably within the target ADA range.");
        }

        if (morning > 130) {
            recs.push("Dawn Phenomenon Watch: Higher morning fasting glucose might reflect liver glycogen release; stay well hydrated.");
        }

        result = {
            predictedEvening: predEve,
            predictedMean: predMean,
            confidenceInterval: {
                low: parseFloat((predEve - 14.2).toFixed(1)),
                high: parseFloat((predEve + 14.2).toFixed(1))
            },
            riskCategory,
            riskColor,
            recommendations: recs
        };
    }

    // Update UI elements
    updateUIWithPrediction(result, sleep, morning, afternoon);
    updateSimulationCurve(morning, afternoon, sleep);
}

function updateUIWithPrediction(pred, sleep, morning, afternoon) {
    const eveningValEl = document.getElementById("predEveningVal");
    const meanValEl = document.getElementById("predMeanVal");
    const ciEl = document.getElementById("predCI");
    const riskBadge = document.getElementById("predRiskBadge");
    const recsList = document.getElementById("predRecommendations");
    const gaugeNeedle = document.getElementById("gaugeNeedle");

    if (eveningValEl) eveningValEl.innerHTML = `${pred.predictedEvening} <span style="font-size: 14px; font-weight: 400; color: var(--text-dim);">mg/dL</span>`;
    if (meanValEl) meanValEl.innerHTML = `${pred.predictedMean} <span style="font-size: 14px; font-weight: 400; color: var(--text-dim);">mg/dL</span>`;
    if (ciEl) ciEl.innerText = `${pred.confidenceInterval.low} – ${pred.confidenceInterval.high} mg/dL`;

    if (riskBadge) {
        riskBadge.innerText = pred.riskCategory;
        if (pred.predictedMean < 70) {
            riskBadge.className = "kpi-badge badge-primary";
        } else if (pred.predictedMean <= 140) {
            riskBadge.className = "kpi-badge badge-success";
        } else if (pred.predictedMean <= 180) {
            riskBadge.className = "kpi-badge badge-warning";
        } else {
            riskBadge.className = "kpi-badge badge-danger";
        }
    }

    if (recsList && pred.recommendations) {
        recsList.innerHTML = pred.recommendations.map(r => `<li>${r}</li>`).join("");
    }

    // Gauge Needle Rotation:
    // Scale: 50 mg/dL -> -90 deg, 125 mg/dL -> 0 deg, 200 mg/dL -> +90 deg
    const clampedSugar = Math.max(50, Math.min(200, pred.predictedMean));
    const angle = ((clampedSugar - 125) / 75) * 80;
    if (gaugeNeedle) {
        gaugeNeedle.style.transform = `rotate(${angle}deg)`;
        gaugeNeedle.style.transformOrigin = "110px 110px";
    }
}

function initSimulationChart() {
    const ctx = document.getElementById("simulationChart")?.getContext("2d");
    if (!ctx) return;

    simulationChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [4.0, 5.0, 6.0, 7.0, 7.5, 8.0, 9.0, 10.0],
            datasets: [
                {
                    label: "Projected Evening Glucose (mg/dL)",
                    data: [124.5, 124.2, 123.9, 123.6, 123.4, 123.3, 123.0, 122.7],
                    borderColor: "#06b6d4",
                    backgroundColor: "rgba(6, 182, 212, 0.1)",
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: "Current Sleep Selection",
                    data: [],
                    borderColor: "#f43f5e",
                    backgroundColor: "#f43f5e",
                    pointRadius: 7,
                    pointHoverRadius: 9,
                    showLine: false
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
                        label: (c) => `${c.dataset.label}: ${c.parsed.y} mg/dL (at ${c.parsed.x} hrs sleep)`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Simulated Sleep Duration (Hours)", color: "#94a3b8" },
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                y: {
                    title: { display: true, text: "Predicted Evening Glucose (mg/dL)", color: "#94a3b8" },
                    ticks: { color: "#64748b" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    min: 110,
                    max: 140
                }
            }
        }
    });
}

function updateSimulationCurve(morning, afternoon, selectedSleep) {
    if (!simulationChart) return;

    const sleepValues = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];
    const curvePoints = sleepValues.map(s => {
        return parseFloat((119.6689 - (0.1383 * s) + (0.0192 * morning) + (0.0419 * afternoon)).toFixed(1));
    });

    const currentPredicted = parseFloat((119.6689 - (0.1383 * selectedSleep) + (0.0192 * morning) + (0.0419 * afternoon)).toFixed(1));

    simulationChart.data.labels = sleepValues.map(s => `${s}h`);
    simulationChart.data.datasets[0].data = curvePoints;
    
    // Find closest index for current selection point
    const currentMarker = sleepValues.map(s => Math.abs(s - selectedSleep) < 0.25 ? currentPredicted : null);
    simulationChart.data.datasets[1].data = currentMarker;

    simulationChart.update("none");
}

function resetForm() {
    document.getElementById("inputSleep").value = 7.5;
    document.getElementById("inputMorning").value = 115;
    document.getElementById("inputAfternoon").value = 130;
    document.getElementById("inputActivity").value = "moderate";
    updateSleepLabel(7.5);
    runPrediction();
}

async function executePythonAnalysis() {
    const btn = document.getElementById("btnRunPython");
    const terminal = document.getElementById("pythonTerminalOutput");
    const boxplot = document.getElementById("pythonBoxplotImg");

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display: inline-block; animation: spin 1s infinite linear;">⚙</span> Running analysis.py...`;
    }
    if (terminal) {
        terminal.innerText = "Spawning python analysis.py subprocess...\nProcessing dataset and executing hypothesis tests...\n";
    }

    try {
        const res = await fetch("/api/run-python", { method: "POST" });
        const data = await res.json();

        if (terminal) {
            terminal.innerText = data.stdout || data.stderr || "Executed successfully with no output.";
        }
        if (boxplot) {
            boxplot.src = `sleep_sugar_boxplot.png?t=${Date.now()}`;
            boxplot.style.display = "block";
            const placeholder = document.getElementById("plotPlaceholder");
            if (placeholder) placeholder.style.display = "none";
        }

        // Reload diagnostics after python run (refreshes metrics from newly computed data)
        await loadMLDiagnostics();

    } catch (err) {
        if (terminal) {
            terminal.innerText = `Error executing Python script:\n${err.message}\n\nMake sure the local server is running (node server.js or python server.py).`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run Python Script (analysis.py)`;
        }
    }
}

// Dynamically load ML model info from the backend API and render into the diagnostics section
async function loadMLDiagnostics() {
    let mlData = null;

    try {
        const res = await fetch("/api/ml-info");
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                mlData = json.data;
            }
        }
    } catch (err) {
        console.warn("Could not load ML diagnostics from API:", err);
    }

    // Fallback to built-in default values if API is unavailable
    if (!mlData) {
        mlData = {
            dataset_size: 500,
            linear_regression: {
                slope: 0.0853,
                intercept: 124.54,
                r2_score: -0.0054,
                mae: 10.68,
                rmse: 13.07,
                pearson_r: -0.0017,
                pearson_p: 0.9704
            },
            anova: {
                f_statistic: 0.5115,
                p_value: 0.5999,
                is_significant: false,
                interpretation: "No statistically significant effect of sleep duration on mean sugar levels (p >= 0.05)."
            },
            shapiro_wilk: {
                "Low Sleep (<6h)": { W: 0.9799, p: 0.0865, mean: 125.62, std: 11.28, count: 113, is_normal: true },
                "Medium Sleep (6-8h)": { W: 0.9956, p: 0.6882, mean: 124.44, std: 12.10, count: 256, is_normal: true },
                "High Sleep (>=8h)": { W: 0.9862, p: 0.2110, mean: 125.42, std: 12.42, count: 131, is_normal: true }
            }
        };
    }

    renderMLDiagnostics(mlData);
}

function renderMLDiagnostics(data) {
    const lr = data.linear_regression;
    const anova = data.anova;
    const shapiro = data.shapiro_wilk;

    // Update Regression Equation
    const eqEl = document.getElementById("regressionEquation");
    if (eqEl && lr) {
        const slope = lr.slope !== undefined ? lr.slope.toFixed(4) : "0.0853";
        const intercept = lr.intercept !== undefined ? lr.intercept.toFixed(2) : "124.54";
        eqEl.textContent = `Mean Glucose = ${intercept} + ${slope} × (Sleep Hours)`;
    }

    // Update R² Score
    const r2El = document.getElementById("metricR2");
    if (r2El && lr) r2El.textContent = lr.r2_score !== undefined ? lr.r2_score.toFixed(4) : "—";

    // Update MAE
    const maeEl = document.getElementById("metricMAE");
    if (maeEl && lr) maeEl.textContent = lr.mae !== undefined ? lr.mae.toFixed(2) : "—";

    // Update RMSE
    const rmseEl = document.getElementById("metricRMSE");
    if (rmseEl && lr) rmseEl.textContent = lr.rmse !== undefined ? lr.rmse.toFixed(2) : "—";

    // Update ANOVA results
    const anovaBadge = document.getElementById("anovaBadge");
    if (anovaBadge && anova) {
        const f = anova.f_statistic !== undefined ? anova.f_statistic.toFixed(4) : "?";
        const p = anova.p_value !== undefined ? anova.p_value.toFixed(4) : "?";
        anovaBadge.textContent = `F = ${f}, p = ${p}`;
        anovaBadge.className = anova.is_significant ? "kpi-badge badge-danger" : "kpi-badge badge-primary";
    }

    const anovaInterpEl = document.getElementById("anovaInterpretation");
    if (anovaInterpEl && anova) {
        const sig = anova.is_significant;
        anovaInterpEl.innerHTML = `<strong>Conclusion:</strong> Since <em>p = ${anova.p_value !== undefined ? anova.p_value.toFixed(4) : "?"} ${sig ? "< 0.05" : "> 0.05"}</em>, we ${sig ? "<strong style=\"color:#ef4444\">reject</strong> the null hypothesis. Sleep duration has a statistically significant effect on mean blood glucose." : "fail to reject the null hypothesis. There is no statistically significant difference in mean blood sugar across sleep duration cohorts."}`;
    }

    // Update Shapiro-Wilk rows
    const swBody = document.getElementById("shapiroWilkRows");
    if (swBody && shapiro) {
        const groupMap = {
            "Low Sleep (<6h)":    { label: "Low Sleep", range: "<6h" },
            "Medium Sleep (6-8h)":{ label: "Medium Sleep", range: "6-8h" },
            "High Sleep (>=8h)": { label: "High Sleep", range: "≥8h" }
        };

        swBody.innerHTML = Object.entries(shapiro).map(([key, stat]) => {
            const isNormal = stat.is_normal;
            const normText = isNormal
                ? `<strong style="color: #34d399">→ Normal (p > 0.05)</strong>`
                : `<strong style="color: #f87171">→ Non-normal (p ≤ 0.05)</strong>`;
            const label = groupMap[key] ? `${groupMap[key].label} (${groupMap[key].range})` : key;
            return `<div style="display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                <span>${label}, n=${stat.count}</span>
                <span>W = ${stat.W.toFixed(4)}, p = ${stat.p.toFixed(4)} ${normText}</span>
            </div>`;
        }).join("");
    }

    // Update dataset size badge if present
    const datasetBadge = document.getElementById("datasetSizeBadge");
    if (datasetBadge && data.dataset_size) {
        datasetBadge.textContent = `n = ${data.dataset_size} records`;
    }
}
