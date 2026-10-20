# GlucoPulse AI

Real-world clinical diabetes data explorer built on the Pima Indians Diabetes Dataset (NIDDK / UCI ML Repository). Features patient record management, exploratory data analytics, and a scikit-learn Logistic Regression diabetes risk predictor.

## Pages

| Page | File | Description |
|------|------|-------------|
| Patient Records | index.html | Browse, add, edit, delete and search all 768 patient records |
| Data Analytics | analytics.html | Charts: glucose distribution, BMI breakdown, age groups, scatter plots, stats table |
| Machine Learning & AI | ml.html | LR metrics, feature importance, ANOVA, Shapiro-Wilk, risk predictor |

## Quick Start

### Option A - Node.js (recommended)
```
npm install
npm start
```
Open http://localhost:3000

### Option B - Python (no npm needed)
```
python server.py
```
Open http://localhost:3000

## Python ML Analysis

```bash
# Human-readable output + saves pima_boxplot.png
python analysis.py

# JSON output (used by the ML page)
python analysis.py --json
```

Required packages:
```
pip install pandas numpy matplotlib seaborn scikit-learn scipy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/records | All patient records |
| POST | /api/records | Add new patient |
| PUT | /api/records/:id | Update patient |
| DELETE | /api/records/:id | Delete patient |
| GET | /api/analytics | Aggregated analytics |
| GET | /api/ml-info | ML metrics (calls analysis.py --json) |
| POST | /api/predict | Diabetes risk prediction |
| POST | /api/run-python | Retrain model via analysis.py |
| GET | /download-csv | Download diabetes_data.csv |

## Dataset

Pima Indians Diabetes Dataset - UCI Machine Learning Repository
- 768 female patients aged 21-81
- 8 clinical features: Pregnancies, Glucose, Blood Pressure, Skin Thickness, Insulin, BMI, Pedigree, Age
- Prevalence: 34.9% diabetic (268/768)

Smith, J.W. et al. (1988). Using the ADAP learning algorithm to forecast the onset of diabetes mellitus. Symposium on Computer Applications in Medical Care.

## Disclaimer

For academic research and educational purposes only. Not for clinical diagnosis.
