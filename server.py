"""
GlucoPulse AI -- Python Server (Alternative to server.js)
Uses the same Pima Indians Diabetes CSV schema as server.js.
Run with: python server.py
"""
import os
import json
import math
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse

PORT = 3000
CSV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diabetes_data.csv")


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------
def parse_csv():
    """Parse the Pima CSV into a list of record dicts."""
    if not os.path.exists(CSV_FILE):
        return []
    records = []
    with open(CSV_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    if len(lines) <= 1:
        return []
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        cols = [c.strip() for c in line.split(",")]
        if len(cols) < 9:
            continue
        try:
            patient_id     = cols[0]
            pregnancies    = float(cols[1]) if cols[1] else 0
            glucose        = float(cols[2]) if cols[2] else 0
            blood_pressure = float(cols[3]) if cols[3] else 0
            skin_thickness = float(cols[4]) if cols[4] else 0
            insulin        = float(cols[5]) if cols[5] else 0
            bmi            = float(cols[6]) if cols[6] else 0
            pedigree       = float(cols[7]) if cols[7] else 0
            age            = int(cols[8])   if cols[8] else 0
            outcome        = int(cols[9])   if len(cols) > 9 and cols[9] else 0
            label          = cols[10] if len(cols) > 10 and cols[10] else ("Diabetic" if outcome == 1 else "Non-Diabetic")
        except (ValueError, IndexError):
            continue

        if glucose < 100:
            glucose_status, glucose_class = "Normal",        "status-normal"
        elif glucose < 126:
            glucose_status, glucose_class = "Pre-Diabetic",  "status-elevated"
        else:
            glucose_status, glucose_class = "Diabetic Range","status-high"

        if bmi < 18.5:    bmi_class = "Underweight"
        elif bmi < 25:    bmi_class = "Normal"
        elif bmi < 30:    bmi_class = "Overweight"
        else:             bmi_class = "Obese"

        records.append({
            "patientId":     patient_id,
            "pregnancies":   pregnancies,
            "glucose":       glucose,
            "bloodPressure": blood_pressure,
            "skinThickness": skin_thickness,
            "insulin":       insulin,
            "bmi":           bmi,
            "pedigree":      pedigree,
            "age":           age,
            "outcome":       outcome,
            "label":         label,
            "glucoseStatus": glucose_status,
            "glucoseClass":  glucose_class,
            "bmiClass":      bmi_class,
        })
    return records


def write_csv(records):
    """Write records back to the Pima CSV."""
    header = "PatientID,Pregnancies,Glucose,BloodPressure,SkinThickness,Insulin,BMI,DiabetesPedigree,Age,Outcome,DiabetesLabel\n"
    with open(CSV_FILE, "w", encoding="utf-8") as f:
        f.write(header)
        for r in records:
            f.write(
                f"{r['patientId']},{r['pregnancies']},{r['glucose']},{r['bloodPressure']},"
                f"{r['skinThickness']},{r['insulin']},{r['bmi']},{r['pedigree']},"
                f"{r['age']},{r['outcome']},{r['label']}\n"
            )


# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class GlucoPulseHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress request logs for cleaner output

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    # ------------------------------------------------------------------
    def _json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("content-length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    # ------------------------------------------------------------------
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        # GET /api/records
        if path == "/api/records":
            records = parse_csv()
            self._json(200, {"success": True, "count": len(records), "records": records})
            return

        # GET /api/analytics
        if path == "/api/analytics":
            records = parse_csv()
            if not records:
                self._json(200, {"success": True, "empty": True})
                return
            n = len(records)
            diabetic_count     = sum(1 for r in records if r["outcome"] == 1)
            non_diabetic_count = n - diabetic_count

            def avg(f):
                return round(sum(r[f] for r in records) / n, 2)

            self._json(200, {
                "success": True,
                "kpis": {
                    "totalCount":       n,
                    "diabeticCount":    diabetic_count,
                    "nonDiabeticCount": non_diabetic_count,
                    "diabeticRate":     round(diabetic_count / n * 100, 1),
                    "avgGlucose":       avg("glucose"),
                    "avgBMI":           avg("bmi"),
                    "avgAge":           avg("age"),
                    "avgInsulin":       avg("insulin"),
                    "avgBP":            avg("bloodPressure"),
                    "avgPedigree":      avg("pedigree"),
                },
                "glucoseDistribution": {
                    "normalCount":    sum(1 for r in records if r["glucose"] < 100),
                    "preDiabCount":   sum(1 for r in records if 100 <= r["glucose"] < 126),
                    "diabRangeCount": sum(1 for r in records if r["glucose"] >= 126),
                },
                "bmiGroups": {
                    "underweight": sum(1 for r in records if r["bmi"] < 18.5),
                    "normal":      sum(1 for r in records if 18.5 <= r["bmi"] < 25),
                    "overweight":  sum(1 for r in records if 25 <= r["bmi"] < 30),
                    "obese":       sum(1 for r in records if r["bmi"] >= 30),
                },
                "ageGroups": {
                    "21-30": sum(1 for r in records if 21 <= r["age"] <= 30),
                    "31-40": sum(1 for r in records if 31 <= r["age"] <= 40),
                    "41-50": sum(1 for r in records if 41 <= r["age"] <= 50),
                    "51-60": sum(1 for r in records if 51 <= r["age"] <= 60),
                    "61+":   sum(1 for r in records if r["age"] >= 61),
                },
                "pregCohorts": {
                    k: {
                        "count": len(grp := [r for r in records if fn(r)]),
                        "diabeticRate": round(sum(1 for r in grp if r["outcome"] == 1) / len(grp) * 100, 1) if grp else 0,
                    }
                    for k, fn in [
                        ("0",   lambda r: r["pregnancies"] == 0),
                        ("1-3", lambda r: 1 <= r["pregnancies"] <= 3),
                        ("4-6", lambda r: 4 <= r["pregnancies"] <= 6),
                        ("7+",  lambda r: r["pregnancies"] >= 7),
                    ]
                },
                "records": records[:200],
            })
            return

        # GET /api/ml-info
        if path == "/api/ml-info":
            try:
                res = subprocess.run(
                    ["python", "analysis.py", "--json"],
                    cwd=os.path.dirname(os.path.abspath(__file__)),
                    capture_output=True, text=True, timeout=30,
                )
                self._json(200, {"success": True, "source": "python", "data": json.loads(res.stdout)})
            except Exception as e:
                self._json(500, {"success": False, "error": str(e)})
            return

        # GET /download-csv
        if path == "/download-csv":
            if os.path.exists(CSV_FILE):
                with open(CSV_FILE, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/csv")
                self.send_header("Content-Disposition", "attachment; filename=pima_diabetes_data.csv")
                self.end_headers()
                self.wfile.write(data)
            else:
                self._json(404, {"error": "CSV not found"})
            return

        super().do_GET()

    # ------------------------------------------------------------------
    def do_POST(self):
        # POST /api/records -- add patient
        if self.path == "/api/records":
            body    = self._body()
            records = parse_csv()
            if not body.get("glucose"):
                self._json(400, {"success": False, "error": "Glucose is required"})
                return
            out = int(body.get("outcome", 0) or 0)
            new = {
                "patientId":     "P-" + str(len(records) + 1).zfill(4),
                "pregnancies":   float(body.get("pregnancies",   0) or 0),
                "glucose":       float(body.get("glucose",       0) or 0),
                "bloodPressure": float(body.get("bloodPressure", 0) or 0),
                "skinThickness": float(body.get("skinThickness", 0) or 0),
                "insulin":       float(body.get("insulin",       0) or 0),
                "bmi":           float(body.get("bmi",           0) or 0),
                "pedigree":      float(body.get("pedigree",      0) or 0),
                "age":           int(body.get("age",             0) or 0),
                "outcome":       out,
                "label":         "Diabetic" if out == 1 else "Non-Diabetic",
            }
            records.append(new)
            write_csv(records)
            self._json(200, {"success": True, "message": "Patient record added!", "record": new})
            return

        # POST /api/run-python
        if self.path == "/api/run-python":
            res = subprocess.run(
                ["python", "analysis.py"],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                capture_output=True, text=True, timeout=60,
            )
            plot = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pima_boxplot.png")
            self._json(200, {
                "success": res.returncode == 0,
                "stdout":  res.stdout,
                "stderr":  res.stderr,
                "hasPlot": os.path.exists(plot),
            })
            return

        # POST /api/predict
        if self.path == "/api/predict":
            body = self._body()
            try:
                glucose  = float(body.get("glucose",       120))
                bmi_val  = float(body.get("bmi",           28))
                age      = float(body.get("age",           30))
                pedigree = float(body.get("pedigree",      0.5))
                insulin  = float(body.get("insulin",       80))
                bp       = float(body.get("bloodPressure", 72))
                preg     = float(body.get("pregnancies",   1))
                skin     = float(body.get("skinThickness", 20))

                logit = (-8.2399 + 0.0318 * glucose + 0.0126 * bmi_val
                         + 0.0133 * age   + 0.3410 * pedigree
                         + 0.0012 * insulin - 0.0115 * bp
                         + 0.0640 * preg  + 0.0009 * skin)
                prob  = round(1 / (1 + math.exp(-logit)), 4)
                risk  = round(prob * 100)

                if risk < 25:   cat, color = "Low Risk",       "#10b981"
                elif risk < 50: cat, color = "Moderate Risk",  "#f59e0b"
                elif risk < 70: cat, color = "High Risk",      "#f97316"
                else:           cat, color = "Very High Risk", "#ef4444"

                recs = []
                if glucose >= 126:  recs.append("Glucose >= 126 mg/dL meets WHO diabetic threshold. Confirm with HbA1c test.")
                elif glucose >= 100: recs.append("Pre-diabetic glucose range (100-125 mg/dL). Lifestyle modifications advised.")
                else:               recs.append("Fasting glucose is in the normal range (< 100 mg/dL).")
                if bmi_val >= 30:   recs.append("Obese BMI (>=30). Weight reduction of 5-10% significantly reduces diabetes risk.")
                elif bmi_val >= 25: recs.append("Overweight BMI. Regular physical activity (150 min/week) recommended.")
                else:               recs.append("BMI is within a healthy range.")
                if age >= 45:       recs.append("Age >= 45: Higher risk bracket. Annual fasting glucose screening recommended.")
                if pedigree >= 0.5: recs.append("Elevated diabetes pedigree function. Family history increases genetic predisposition.")
                if insulin > 200:   recs.append("Very high insulin suggests insulin resistance. Consider an HOMA-IR assessment.")

                self._json(200, {
                    "success": True,
                    "predictions": {
                        "diabetesRiskProbability": prob,
                        "riskPercent": risk,
                        "riskCategory": cat,
                        "riskColor":    color,
                        "recommendations": recs,
                    },
                })
            except Exception as e:
                self._json(500, {"success": False, "error": str(e)})
            return

        self.send_response(404)
        self.end_headers()

    # ------------------------------------------------------------------
    def do_PUT(self):
        if self.path.startswith("/api/records/"):
            patient_id = urllib.parse.unquote(self.path[len("/api/records/"):])
            body       = self._body()
            records    = parse_csv()
            idx        = next((i for i, r in enumerate(records) if r["patientId"] == patient_id), -1)
            if idx == -1:
                self._json(404, {"success": False, "error": "Patient not found"})
                return
            if not body.get("glucose"):
                self._json(400, {"success": False, "error": "Glucose is required"})
                return
            out = int(body.get("outcome", 0) or 0)
            records[idx].update({
                "pregnancies":   float(body.get("pregnancies",   0) or 0),
                "glucose":       float(body.get("glucose",       0) or 0),
                "bloodPressure": float(body.get("bloodPressure", 0) or 0),
                "skinThickness": float(body.get("skinThickness", 0) or 0),
                "insulin":       float(body.get("insulin",       0) or 0),
                "bmi":           float(body.get("bmi",           0) or 0),
                "pedigree":      float(body.get("pedigree",      0) or 0),
                "age":           int(body.get("age",             0) or 0),
                "outcome":       out,
                "label":         "Diabetic" if out == 1 else "Non-Diabetic",
            })
            write_csv(records)
            self._json(200, {"success": True, "message": "Patient updated!", "record": records[idx]})
            return
        self.send_response(404)
        self.end_headers()

    # ------------------------------------------------------------------
    def do_DELETE(self):
        if self.path.startswith("/api/records/"):
            patient_id = urllib.parse.unquote(self.path[len("/api/records/"):])
            records    = parse_csv()
            before     = len(records)
            records    = [r for r in records if r["patientId"] != patient_id]
            if len(records) == before:
                self._json(404, {"success": False, "error": "Patient not found"})
                return
            write_csv(records)
            self._json(200, {"success": True, "message": "Patient deleted."})
            return
        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), GlucoPulseHandler)
    print(f"GlucoPulse AI (Python Server) running at http://localhost:{PORT}")
    server.serve_forever()
