"""
ml-service/app.py
Python ML Microservice for Student Wellbeing Assessment System.
Serves predictions, SHAP attributions, simulations, and recommendations via REST API.
"""
import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify
import joblib
import pandas as pd
import numpy as np

# Add project root to sys.path so we can import mh_engine
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import mh_engine as eng

app = Flask(__name__)

# Paths to artifacts
MODEL_PATH = ROOT_DIR / "Mental_Health_Model.pkl"
RESOURCES_PATH = ROOT_DIR / "resources.csv"

# Global model & resources cache
artifact = None
resources = None


def load_artifacts():
    global artifact, resources
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    if not RESOURCES_PATH.exists():
        raise FileNotFoundError(f"Resources file not found at {RESOURCES_PATH}")
    artifact = joblib.load(MODEL_PATH)
    resources = pd.read_csv(RESOURCES_PATH)
    print(f"[ML Service] Loaded model: {artifact.get('model_name', 'Unknown')}")
    print(f"[ML Service] Loaded {len(resources)} educational resources")


@app.route("/health", methods=["GET"])
def health():
    if artifact is None:
        return jsonify({"status": "error", "message": "Model not loaded"}), 503
    return jsonify({
        "status": "ok",
        "service": "student-wellbeing-ml-service",
        "model_name": artifact.get("model_name", "Random Forest"),
        "sklearn_version": artifact.get("sklearn_version", "unknown"),
        "metrics": artifact.get("metrics", {}),
        "trained_rows": artifact.get("trained_rows", 0)
    })


@app.route("/meta", methods=["GET"])
def get_metadata():
    if artifact is None:
        return jsonify({"status": "error", "message": "Model not loaded"}), 503
    return jsonify({
        "features": eng.FEATURES,
        "numeric_features": eng.NUMERIC_FEATURES,
        "categorical_features": eng.CATEGORICAL_FEATURES,
        "valid_ranges": eng.VALID_RANGES,
        "choices": eng.CHOICES,
        "friendly_names": eng.FRIENDLY,
        "units": eng.UNITS,
        "band_edges": list(eng.BAND_EDGES),
        "band_names": list(eng.BAND_NAMES),
        "disclaimer": eng.DISCLAIMER,
        "support_note": eng.SUPPORT_NOTE,
        "metrics": artifact.get("metrics", {})
    })


@app.route("/assess", methods=["POST"])
def assess():
    if artifact is None:
        return jsonify({"error": "Model not loaded"}), 503

    payload = request.get_json(silent=True) or {}
    try:
        raw_inputs, warnings = eng.validate_inputs(payload)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        raw = eng.assess(artifact, raw_inputs, resources)

        # Build clean JSON serializable output
        drivers_list = raw["drivers"].to_dict(orient="records")
        for d in drivers_list:
            d["contribution"] = round(float(d["contribution"]), 3)

        response = {
            "score": round(float(raw["score"]), 2),
            "band": raw["band"],
            "range": [round(float(raw["range"][0]), 2), round(float(raw["range"][1]), 2)],
            "band_message": raw["band_message"],
            "base_value": round(float(raw["base_value"]), 3),
            "drivers": drivers_list,
            "driver_text": raw["driver_text"],
            "advice": raw["advice"],
            "strengths": raw["strengths"],
            "changes": [
                {
                    "feature": c["feature"],
                    "label": c["label"],
                    "current": c["current"],
                    "target": c["target"],
                    "gain": round(float(c["gain"]), 3),
                    "hurt": round(float(c.get("hurt", 0.0)), 3)
                }
                for c in raw["changes"]
            ],
            "plan_gain": round(float(raw["plan_gain"]), 2),
            "ramp": raw["ramp"].to_dict(orient="records"),
            "schedule": raw["schedule"].to_dict(orient="records"),
            "videos": raw["videos"].to_dict(orient="records"),
            "courses": raw["courses"].to_dict(orient="records"),
            "show_support": bool(raw["show_support"]),
            "warnings": warnings + raw.get("warnings", []),
            "row": raw["row"]
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": f"Assessment calculation error: {str(e)}"}), 500


@app.route("/predict", methods=["POST"])
def predict():
    if artifact is None:
        return jsonify({"error": "Model not loaded"}), 503

    payload = request.get_json(silent=True) or {}
    try:
        row, warnings = eng.validate_inputs(payload)
        score = eng.predict_score(artifact, row)
        band = eng.score_to_band(score)
        return jsonify({
            "score": round(score, 2),
            "band": band,
            "warnings": warnings,
            "row": row
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/explain", methods=["POST"])
def explain():
    if artifact is None:
        return jsonify({"error": "Model not loaded"}), 503

    payload = request.get_json(silent=True) or {}
    try:
        row, warnings = eng.validate_inputs(payload)
        drivers, base = eng.explain_prediction(artifact, row)
        drivers_list = drivers.to_dict(orient="records")
        for d in drivers_list:
            d["contribution"] = round(float(d["contribution"]), 3)
        driver_text = [eng.describe_driver(r) for _, r in drivers.iterrows()]
        return jsonify({
            "base_value": round(base, 3),
            "drivers": drivers_list,
            "driver_text": driver_text,
            "warnings": warnings
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/simulate", methods=["POST"])
def simulate():
    if artifact is None:
        return jsonify({"error": "Model not loaded"}), 503

    payload = request.get_json(silent=True) or {}
    base_inputs = payload.get("base", {})
    changes = payload.get("changes", {})

    try:
        row, warnings = eng.validate_inputs(base_inputs)
        # Apply changes
        simulated_row = {**row}
        for k, v in changes.items():
            if k in eng.NUMERIC_FEATURES:
                lo, hi = eng.VALID_RANGES[k]
                simulated_row[k] = min(max(float(v), lo), hi)
            elif k in eng.CATEGORICAL_FEATURES and v in eng.CHOICES[k]:
                simulated_row[k] = v

        current_score = eng.predict_score(artifact, row)
        simulated_score = eng.predict_score(artifact, simulated_row)
        score_diff = simulated_score - current_score

        return jsonify({
            "current_score": round(current_score, 2),
            "simulated_score": round(simulated_score, 2),
            "score_diff": round(score_diff, 2),
            "current_band": eng.score_to_band(current_score),
            "simulated_band": eng.score_to_band(simulated_score),
            "simulated_row": simulated_row
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/resources", methods=["GET"])
def get_resources():
    if resources is None:
        return jsonify({"error": "Resources not loaded"}), 503
    return jsonify({
        "resources": resources.to_dict(orient="records")
    })


if __name__ == "__main__":
    load_artifacts()
    port = int(os.environ.get("ML_PORT", 5001))
    print(f"[ML Service] Starting Flask server on port {port}...")
    app.run(host="127.0.0.1", port=port, debug=False)
