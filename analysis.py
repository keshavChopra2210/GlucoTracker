import sys
import os
import json
import pandas as pd
import numpy as np
import matplotlib
# Use Agg backend if headless/non-interactive
if '--show' not in sys.argv:
    matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from scipy.stats import pearsonr, f_oneway, shapiro

# Load dataset
file_path = os.path.join(os.path.dirname(__file__), 'diabetes_data.csv')
data = pd.read_csv(file_path)

# Calculate Mean Sugar Level
data["Mean Sugar Level"] = data[["Morning Sugar Level", "Afternoon Sugar Level", "Evening Sugar Level"]].mean(axis=1)

# Define Independent (X) and Dependent (Y) variables
X = data[["Sleep Hours"]]  # Independent variable (Feature)
Y = data["Mean Sugar Level"]  # Dependent variable (Target)

# Split into training & testing datasets
X_train, X_test, y_train, y_test = train_test_split(X, Y, test_size=0.2, random_state=42)

# Train the Linear Regression Model
model = LinearRegression()
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

# Model Performance Metrics
r2 = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
corr, p_corr = pearsonr(data["Sleep Hours"], data["Mean Sugar Level"])

# Multi-feature model for Evening Glucose
X_multi = data[['Sleep Hours', 'Morning Sugar Level', 'Afternoon Sugar Level']]
y_multi = data['Evening Sugar Level']
X_tr, X_te, y_tr, y_te = train_test_split(X_multi, y_multi, test_size=0.2, random_state=42)
multi_model = LinearRegression().fit(X_tr, y_tr)
y_multi_pred = multi_model.predict(X_te)
multi_mae = mean_absolute_error(y_te, y_multi_pred)

# Sleep cohorts analysis
low_sleep = data[data["Sleep Hours"] < 6]["Mean Sugar Level"]
medium_sleep = data[(data["Sleep Hours"] >= 6) & (data["Sleep Hours"] < 8)]["Mean Sugar Level"]
high_sleep = data[data["Sleep Hours"] >= 8]["Mean Sugar Level"]
f_stat, p_value = f_oneway(low_sleep, medium_sleep, high_sleep)

# Shapiro-Wilk Test for Normality
shapiro_results = {}
for group_name, group_data in [("Low Sleep (<6h)", low_sleep), ("Medium Sleep (6-8h)", medium_sleep), ("High Sleep (>=8h)", high_sleep)]:
    stat, p = shapiro(group_data)
    shapiro_results[group_name] = {
        "W": float(stat),
        "p": float(p),
        "mean": float(group_data.mean()),
        "std": float(group_data.std()),
        "count": int(len(group_data)),
        "is_normal": bool(p > 0.05)
    }

# Save Boxplot visualization
plot_path = os.path.join(os.path.dirname(__file__), 'sleep_sugar_boxplot.png')
plt.figure(figsize=(8, 5))
data['Sleep Category'] = pd.cut(data["Sleep Hours"], bins=[0, 6, 8, 24], labels=["Low (<6h)", "Medium (6-8h)", "High (>=8h)"])
sns.set_theme(style="whitegrid")
palette = ["#f87171", "#60a5fa", "#34d399"]
ax = sns.boxplot(x="Sleep Category", y="Mean Sugar Level", data=data, hue="Sleep Category", palette=palette, legend=False)
plt.xlabel("Sleep Hours Category", fontsize=12, fontweight='bold')
plt.ylabel("Mean Blood Sugar Level (mg/dL)", fontsize=12, fontweight='bold')
plt.title("Distribution of Mean Blood Sugar Level by Sleep Duration Cohort", fontsize=13, fontweight='bold', pad=15)
plt.tight_layout()
plt.savefig(plot_path, dpi=150)

if '--show' in sys.argv:
    plt.show()
plt.close()

if '--json' in sys.argv:
    output_data = {
        "dataset_size": len(data),
        "linear_regression": {
            "slope": float(model.coef_[0]),
            "intercept": float(model.intercept_),
            "equation": f"Mean Glucose = {model.intercept_:.2f} + {model.coef_[0]:.4f} * (Sleep Hours)",
            "r2_score": float(r2),
            "mae": float(mae),
            "rmse": float(rmse),
            "pearson_r": float(corr),
            "pearson_p": float(p_corr)
        },
        "multivariate_evening_model": {
            "coefficients": {
                "sleep_hours": float(multi_model.coef_[0]),
                "morning_sugar": float(multi_model.coef_[1]),
                "afternoon_sugar": float(multi_model.coef_[2])
            },
            "intercept": float(multi_model.intercept_),
            "mae": float(multi_mae)
        },
        "anova": {
            "f_statistic": float(f_stat),
            "p_value": float(p_value),
            "is_significant": bool(p_value < 0.05),
            "interpretation": "Sleep duration has a statistically significant effect on sugar levels." if p_value < 0.05 else "No statistically significant effect of sleep duration on mean sugar levels (p >= 0.05)."
        },
        "shapiro_wilk": shapiro_results,
        "plot_file": "sleep_sugar_boxplot.png"
    }
    print(json.dumps(output_data, indent=2))
else:
    print("==================================================")
    print("        DIABETES DATA ANALYSIS & ML REPORT        ")
    print("==================================================")
    print(f"Total Observations: {len(data)}")
    print(f"\n[1] Linear Regression Model (Sleep -> Mean Sugar):")
    print(f"    Equation: Mean Glucose = {model.intercept_:.2f} + {model.coef_[0]:.4f} * (Sleep Hours)")
    print(f"    R-squared: {r2:.4f}")
    print(f"    MAE: {mae:.4f} mg/dL | RMSE: {rmse:.4f} mg/dL")
    print(f"    Pearson Correlation: r={corr:.4f} (p={p_corr:.4f})")
    print(f"\n[2] One-Way ANOVA Hypothesis Test:")
    print(f"    F-Statistic: {f_stat:.4f}")
    print(f"    P-Value: {p_value:.4f}")
    if p_value < 0.05:
        print("    Result: Sleep hours have a statistically significant effect on sugar levels.")
    else:
        print("    Result: No significant effect of sleep hours on sugar levels (p >= 0.05).")
    print(f"\n[3] Shapiro-Wilk Test for Normality:")
    for group, stats in shapiro_results.items():
        norm_status = "Normal (p > 0.05)" if stats['is_normal'] else "Non-normal (p <= 0.05)"
        print(f"    {group} (n={stats['count']}): W={stats['W']:.4f}, p={stats['p']:.4f} -> {norm_status}")
    print(f"\n[4] Visualization saved to: {plot_path}")
    print("==================================================")