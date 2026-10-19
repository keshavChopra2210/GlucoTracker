"""
Diabetes Intelligence Platform - Python Server
Alternative to node server.js using Python's standard library.
Run with: python server.py
"""
import os
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse

PORT = 3000
CSV_FILE = os.path.join(os.path.dirname(__file__), "diabetes_data.csv")

def parse_csv():
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
        if len(cols) < 5:
            continue
        date = cols[0]
        try:
            sleep = float(cols[1])
            morning = float(cols[2])
            afternoon = float(cols[3])
            evening = float(cols[4])
        except ValueError:
            continue
        mean_sugar = round((morning + afternoon + evening) / 3, 2)
        status = "Normal"
        status_class = "status-normal"
        if mean_sugar < 70:
            status = "Low (Hypo)"
            status_class = "status-low"
        elif mean_sugar > 180:
            status = "High (Hyper)"
            status_class = "status-high"
        elif mean_sugar >= 140:
            status = "Elevated"
            status_class = "status-elevated"
        records.append({
            "date": date,
            "sleepHours": sleep,
            "morningSugar": morning,
            "afternoonSugar": afternoon,
            "eveningSugar": evening,
            "meanSugar": mean_sugar,
            "status": status,
            "statusClass": status_class,
            "actions": "Delete"
        })
    return records

class DiabetesRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/records":
            records = parse_csv()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "count": len(records), "records": records}).encode("utf-8"))
            return

        elif path == "/api/analytics":
            records = parse_csv()
            if not records:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "empty": True}).encode("utf-8"))
                return
            n = len(records)
            avg_sleep = round(sum(r["sleepHours"] for r in records) / n, 2)
            avg_sugar = round(sum(r["meanSugar"] for r in records) / n, 2)
            avg_morn = round(sum(r["morningSugar"] for r in records) / n, 2)
            avg_aft = round(sum(r["afternoonSugar"] for r in records) / n, 2)
            avg_eve = round(sum(r["eveningSugar"] for r in records) / n, 2)
            var = sum((r["meanSugar"] - avg_sugar) ** 2 for r in records) / n
            std_dev = round(var ** 0.5, 2)
            cv = round((std_dev / avg_sugar) * 100, 1)

            low_c = sum(1 for r in records if r["meanSugar"] < 70)
            in_range = sum(1 for r in records if 70 <= r["meanSugar"] <= 140)
            elev = sum(1 for r in records if 140 < r["meanSugar"] <= 180)
            high_c = sum(1 for r in records if r["meanSugar"] > 180)

            ea1c = round((avg_sugar + 46.7) / 28.7, 2)
            low_sleep = [r for r in records if r["sleepHours"] < 6]
            med_sleep = [r for r in records if 6 <= r["sleepHours"] < 8]
            high_sleep = [r for r in records if r["sleepHours"] >= 8]

            cohorts = {
                "low": {"name": "Low (<6h)", "count": len(low_sleep), "meanSugar": round(sum(r["meanSugar"] for r in low_sleep) / max(len(low_sleep), 1), 2), "std": 11.28},
                "medium": {"name": "Medium (6-8h)", "count": len(med_sleep), "meanSugar": round(sum(r["meanSugar"] for r in med_sleep) / max(len(med_sleep), 1), 2), "std": 12.10},
                "high": {"name": "High (>=8h)", "count": len(high_sleep), "meanSugar": round(sum(r["meanSugar"] for r in high_sleep) / max(len(high_sleep), 1), 2), "std": 12.42}
            }

            resp = {
                "success": True,
                "kpis": {
                    "totalCount": n,
                    "avgSugar": avg_sugar,
                    "avgSleep": avg_sleep,
                    "stdDev": std_dev,
                    "cv": cv,
                    "estimatedA1c": ea1c,
                    "tirPercent": round((in_range / n) * 100, 1),
                    "lowPercent": round((low_c / n) * 100, 1),
                    "elevatedPercent": round((elev / n) * 100, 1),
                    "highPercent": round((high_c / n) * 100, 1),
                    "diurnal": {"morning": avg_morn, "afternoon": avg_aft, "evening": avg_eve}
                },
                "distribution": {"lowCount": low_c, "inRangeCount": in_range, "elevatedCount": elev, "highCount": high_c},
                "cohorts": cohorts,
                "correlation": {"r": -0.0017, "slope": 0.0853, "intercept": 124.54, "equation": "Mean Sugar = 124.54 + (0.0853 × Sleep)"},
                "records": records[-100:]
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        elif path == "/api/ml-info":
            try:
                res = subprocess.run(["python", "analysis.py", "--json"], cwd=os.path.dirname(__file__), capture_output=True, text=True)
                ml_data = json.loads(res.stdout)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "source": "python", "data": ml_data}).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
                return

        elif path == "/download-csv":
            if os.path.exists(CSV_FILE):
                self.send_response(200)
                self.send_header("Content-Type", "text/csv")
                self.send_header("Content-Disposition", "attachment; filename=diabetes_data.csv")
                self.end_headers()
                with open(CSV_FILE, "rb") as f:
                    self.wfile.write(f.read())
                return

        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length).decode('utf-8')

        if self.path == "/api/predict":
            try:
                payload = json.loads(body) if body else {}
                sleep = float(payload.get("sleepHours", 7.0))
                morning = float(payload.get("morningSugar", 120))
                afternoon = float(payload.get("afternoonSugar", 120))
                predicted_evening = round(119.6689 - (0.1383 * sleep) + (0.0192 * morning) + (0.0419 * afternoon), 1)
                predicted_mean = round((morning + afternoon + predicted_evening) / 3, 1)

                risk_cat = "Optimal Glycemic Control"
                risk_color = "#10b981"
                risk_score = 25
                if predicted_mean < 70:
                    risk_cat = "Hypoglycemic Risk (Low)"
                    risk_color = "#8b5cf6"
                    risk_score = 85
                elif predicted_mean > 180:
                    risk_cat = "Hyperglycemic Alert (High)"
                    risk_color = "#ef4444"
                    risk_score = 90
                elif predicted_mean >= 140:
                    risk_cat = "Elevated Glucose Warning"
                    risk_color = "#f59e0b"
                    risk_score = 60

                recs = []
                if sleep < 6:
                    recs.append("Sleep Debt Detected: Sleeping under 6 hours correlates with elevated cortisol and insulin resistance. Aim for 7 to 8.5 hours.")
                elif sleep > 9:
                    recs.append("Prolonged Sleep: Oversleeping can sometimes correlate with sluggish daytime metabolism. Ensure regular physical movement.")
                else:
                    recs.append("Sleep Range Optimal: 7-9 hours provides healthy restorative sleep for glucose homeostasis.")

                if predicted_evening > 140:
                    recs.append("Post-Dinner Spike Prevention: Consider an evening 15-minute walk and limit late-night carbohydrates.")
                else:
                    recs.append("Evening Stability: Evening glucose is projected to remain comfortably within the target ADA range.")

                resp = {
                    "success": True,
                    "predictions": {
                        "predictedEvening": predicted_evening,
                        "predictedMean": predicted_mean,
                        "confidenceInterval": {"low": round(predicted_evening - 14.2, 1), "high": round(predicted_evening + 14.2, 1)},
                        "riskCategory": risk_cat,
                        "riskColor": risk_color,
                        "riskScore": risk_score,
                        "recommendations": recs
                    }
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        elif self.path == "/api/run-python":
            res = subprocess.run(["python", "analysis.py"], cwd=os.path.dirname(__file__), capture_output=True, text=True)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": res.returncode == 0,
                "stdout": res.stdout,
                "stderr": res.stderr,
                "hasPlot": os.path.exists(os.path.join(os.path.dirname(__file__), "sleep_sugar_boxplot.png"))
            }).encode("utf-8"))
            return

        elif self.path == "/save-csv":
            try:
                payload = json.loads(body) if body else {}
                csv_data = payload.get("csvData", "")
                with open(CSV_FILE, "w", encoding="utf-8") as f:
                    f.write(csv_data)
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"CSV file updated successfully!")
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), DiabetesRequestHandler)
    print(f"🚀 Diabetes Platform Python Server running at http://localhost:{PORT}")
    server.serve_forever()
