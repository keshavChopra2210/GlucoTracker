import sys
import os
import json
import pandas as pd
import numpy as np
import matplotlib
if '--show' not in sys.argv:
    matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score,
                             recall_score, f1_score, roc_auc_score,
                             confusion_matrix)
from sklearn.preprocessing import StandardScaler
from scipy.stats import f_oneway, shapiro, pearsonr

# ── Load dataset ────────────────────────────────────────────────────────────
file_path = os.path.join(os.path.dirname(__file__), 'diabetes_data.csv')
data = pd.read_csv(file_path)

# Rename columns for consistency
rename_map = {
    'PatientID': 'PatientID',
    'Pregnancies': 'Pregnancies',
    'Glucose': 'Glucose',
    'BloodPressure': 'BloodPressure',
    'SkinThickness': 'SkinThickness',
    'Insulin': 'Insulin',
    'BMI': 'BMI',
    'DiabetesPedigree': 'DiabetesPedigree',
    'Age': 'Age',
    'Outcome': 'Outcome'
}
data = data.rename(columns={k: v for k, v in rename_map.items() if k in data.columns})

features = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
            'Insulin', 'BMI', 'DiabetesPedigree', 'Age']

X = data[features]
y = data['Outcome']

# ── Train/Test Split & Logistic Regression ───────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2,
                                                     random_state=42, stratify=y)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

model = LogisticRegression(max_iter=1000, random_state=42)
model.fit(X_train_s, y_train)
y_pred  = model.predict(X_test_s)
y_prob  = model.predict_proba(X_test_s)[:, 1]

accuracy  = round(accuracy_score(y_test, y_pred), 4)
precision = round(precision_score(y_test, y_pred), 4)
recall    = round(recall_score(y_test, y_pred), 4)
f1        = round(f1_score(y_test, y_pred), 4)
auc_roc   = round(roc_auc_score(y_test, y_prob), 4)

cm = confusion_matrix(y_test, y_pred).tolist()

# Feature importance (absolute coefficient values)
coef_dict = {feat: round(float(coef), 4)
             for feat, coef in zip(features, model.coef_[0])}
abs_coef  = {feat: round(abs(coef), 4)
             for feat, coef in zip(features, model.coef_[0])}
intercept = round(float(model.intercept_[0]), 4)
total_coef_sum = sum(abs_coef.values())
feature_importance = {feat: round(v / total_coef_sum, 4)
                      for feat, v in abs_coef.items()}

# ── ANOVA: Glucose across Diabetic vs Non-Diabetic ──────────────────────────
diabetic     = data[data['Outcome'] == 1]['Glucose']
non_diabetic = data[data['Outcome'] == 0]['Glucose']
f_stat, p_value = f_oneway(diabetic, non_diabetic)

# ── Shapiro-Wilk per group ───────────────────────────────────────────────────
shapiro_results = {}
for group_name, group_data in [("Diabetic", diabetic), ("Non-Diabetic", non_diabetic)]:
    stat, p = shapiro(group_data.sample(min(len(group_data), 5000), random_state=42))
    shapiro_results[group_name] = {
        "W": round(float(stat), 4),
        "p": round(float(p), 6),
        "mean": round(float(group_data.mean()), 2),
        "std": round(float(group_data.std()), 2),
        "count": int(len(group_data)),
        "is_normal": bool(p >= 0.05)
    }

# ── Pearson correlation matrix (key pairs) ──────────────────────────────────
corr_glucose_outcome, p_go = pearsonr(data['Glucose'], data['Outcome'])
corr_bmi_outcome, p_bo     = pearsonr(data['BMI'], data['Outcome'])
corr_age_outcome, p_ao     = pearsonr(data['Age'], data['Outcome'])

# ── Boxplot: Glucose by Outcome ──────────────────────────────────────────────
plt.figure(figsize=(9, 6))
sns.set_theme(style='darkgrid')
data_plot = data.copy()
data_plot['OutcomeLabel'] = data_plot['Outcome'].map({0: 'Non-Diabetic', 1: 'Diabetic'})
palette = {'Non-Diabetic': '#10b981', 'Diabetic': '#ef4444'}
ax = sns.boxplot(data=data_plot, x='OutcomeLabel', y='Glucose', hue='OutcomeLabel',
                 palette=palette, order=['Non-Diabetic', 'Diabetic'],
                 width=0.5, linewidth=1.5, legend=False)
ax.set_title('Fasting Plasma Glucose Distribution\nPima Indians Diabetes Dataset (NIDDK)',
             fontsize=13, fontweight='bold', pad=14)
ax.set_xlabel('Diabetes Outcome', fontsize=11)
ax.set_ylabel('Fasting Plasma Glucose (mg/dL)', fontsize=11)
ax.axhline(126, color='#f59e0b', linestyle='--', linewidth=1.2,
           label='Diabetic Threshold (126 mg/dL)')
ax.axhline(100, color='#6366f1', linestyle='--', linewidth=1.2,
           label='Pre-Diabetic Threshold (100 mg/dL)')
ax.legend(fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(os.path.dirname(__file__), 'pima_boxplot.png'),
            dpi=150, bbox_inches='tight')
plt.close()

# ── Assemble JSON output ─────────────────────────────────────────────────────
output = {
    "dataset_size": int(len(data)),
    "dataset_source": "UCI Pima Indians Diabetes Dataset (NIDDK)",
    "diabetic_count": int(y.sum()),
    "non_diabetic_count": int((y == 0).sum()),
    "logistic_regression": {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "auc_roc": auc_roc,
        "intercept": intercept,
        "coefficients": coef_dict,
        "confusion_matrix": cm,
        "equation": (
            f"log(p/1-p) = {intercept} "
            f"+ {coef_dict['Glucose']}·Glucose "
            f"+ {coef_dict['BMI']}·BMI "
            f"+ {coef_dict['Age']}·Age "
            f"+ {coef_dict['DiabetesPedigree']}·Pedigree"
        )
    },
    "feature_importance": feature_importance,
    "anova": {
        "f_statistic": round(float(f_stat), 4),
        "p_value": round(float(p_value), 8),
        "is_significant": bool(p_value < 0.05),
        "interpretation": (
            "Glucose levels differ significantly between diabetic and non-diabetic groups (p < 0.0001)."
            if p_value < 0.05
            else "No significant glucose difference between groups."
        )
    },
    "correlations": {
        "glucose_vs_outcome": round(float(corr_glucose_outcome), 4),
        "bmi_vs_outcome": round(float(corr_bmi_outcome), 4),
        "age_vs_outcome": round(float(corr_age_outcome), 4)
    },
    "shapiro_wilk": shapiro_results,
    "plot_file": "pima_boxplot.png"
}

if '--json' in sys.argv:
    print(json.dumps(output))
else:
    print("=" * 60)
    print(f"Dataset: {output['dataset_source']}")
    print(f"Total patients: {output['dataset_size']}")
    print(f"Diabetic: {output['diabetic_count']}  |  Non-Diabetic: {output['non_diabetic_count']}")
    print("-" * 60)
    print("Logistic Regression Performance:")
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1-Score:  {f1:.4f}")
    print(f"  AUC-ROC:   {auc_roc:.4f}")
    print("-" * 60)
    print("ANOVA (Glucose ~ Outcome):")
    print(f"  F = {f_stat:.4f}, p = {p_value:.6f}")
    print(f"  Significant: {p_value < 0.05}")
    print("-" * 60)
    print("Top Feature Importance:")
    for feat, imp in sorted(feature_importance.items(), key=lambda x: -x[1]):
        print(f"  {feat}: {imp:.4f}")
    print("=" * 60)
    print("Boxplot saved: pima_boxplot.png")