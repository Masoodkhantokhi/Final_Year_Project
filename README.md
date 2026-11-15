# Student Wellbeing Assessment System

Final-year educational project: a responsive dashboard backed by an Express API and a Flask machine-learning service. It uses the saved Random Forest model to generate a score, SHAP explanations, what-if comparisons, recommendations, a four-week plan, and matched learning resources.

This is an educational model, not a diagnostic or treatment tool. Predictions describe patterns in the training data; changing a habit does not guarantee the predicted effect. Assessment answers are not stored on the server. Theme preferences and checklist progress are stored in the browser.

## Setup and launch

Install **64-bit Python 3.11 or 3.12** and **Node.js 18 or newer**. Python 3.12 is the locally verified version. Add Python to PATH during Windows installation.

```sh
node setup.js
node start.js
```

On Windows, double-click `SETUP_WINDOWS.bat` for setup, then `START_DASHBOARD_WINDOWS.bat` to launch. On macOS/Linux, run `bash START_DASHBOARD_MAC_LINUX.sh`.

The launcher verifies dependencies and the model, starts both services, waits for healthy responses, and opens **http://localhost:3000**. Press **Ctrl+C** to stop. It reports occupied ports without terminating unrelated applications.

An internet connection is needed for first-time package installation. The frontend currently loads Chart.js and optional fonts from CDNs, so charts also require access to those hosts.

### Copying to another laptop

Copy or clone the source files, model, and CSVs. **Do not copy `.venv`, `venv`, or `node_modules`**: run setup on the destination computer. All application file paths are relative to the project, including paths containing spaces.

Both of these use the same dependency list:

```sh
python -m pip install -r requirements.txt
python -m pip install -r ml-service/requirements.txt
```

Prefer the project environment (`.venv/Scripts/python.exe` on Windows, `.venv/bin/python` on macOS/Linux) when running pip. Setup creates that environment automatically and checks installed dependencies before reuse. If a copied environment cannot run, remove only the project's `.venv` folder and rerun setup.

The saved model records **scikit-learn 1.9.1**; the runtime pins that exact version. Do not substitute another version or retrain the model just to suppress a loading error. Other dependencies have compatibility ranges. A new installation still depends on package availability for the destination OS and Python version.

## Configuration

Setup creates `backend/.env` from `backend/.env.example`. Process environment variables take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Dashboard and API port |
| `ML_SERVICE_URL` | `http://127.0.0.1:5001` | Python service address |
| `ML_PORT` | URL port, or `5001` | Optional local Python port override |
| `NO_BROWSER` | unset | Set to `1` to skip opening the browser |

The combined launcher manages a local Python service. When running services separately, start `ml-service/app.py` with the project Python interpreter and `backend/server.js` with Node. The gateway reads `backend/.env` regardless of the working directory.

## Application features

- Assessment form and three sample profiles.
- Score, model range, SHAP drivers and habit radar.
- Recommendations and a simulator tied to the last successful assessment.
- Four-week targets, a downloadable text plan, and a checklist scoped to the current plan.
- Resource cards, dark/light themes and a mobile navigation drawer.
- Input validation, range-adjustment warnings, bounded service requests and visible failure messages.

## Project files

| Path | Purpose |
| --- | --- |
| `frontend/` | Dashboard HTML, CSS and JavaScript |
| `backend/` | Express gateway, validation and ML client |
| `ml-service/app.py` | Flask inference API |
| `ml-service/requirements.txt` | Canonical runtime dependencies |
| `requirements.txt` | Convenience include for root-level pip installs |
| `mh_engine.py` | Prediction, SHAP, advice, planning and resource matching |
| `Mental_Health_Model.pkl` | Required trained model artifact |
| `resources.csv` | Required curated resource catalog |
| `Mental_Health_Assessment_System.ipynb` | Training/research notebook for the report and viva |
| `Student_Social_Media_And_Mental_Health_Impact.csv` | Research dataset; retained for reproducibility |
| `setup.js`, `start.js` | Portable setup and service lifecycle |
| `tests/` | API and browser regression tests |

The training notebook may need additional research packages beyond the application runtime requirements.

## API

The frontend talks to `/api` on the gateway. Successful data endpoints return `{ "success": true, "data": ... }`. Invalid inputs return HTTP 400; unavailable ML requests return 503 or 504.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/health` | Gateway and ML health (200 or 503) |
| GET | `/api/meta` | Features, ranges, choices and model metadata |
| POST | `/api/assess` | Complete assessment, plan and resources |
| POST | `/api/predict` | Score and band |
| POST | `/api/explain` | SHAP contributions |
| POST | `/api/simulate` | Baseline and modified prediction |
| GET | `/api/resources` | Resource catalog in `data.resources` |

Assessment input example:

```json
{
  "Avg_Daily_Usage_Hours": 5,
  "Daily_Unlocks": 170,
  "Study_Hours": 3,
  "Physical_Activity_Hours": 1.7,
  "Sleep_Hours_Per_Night": 6.6,
  "Academic_Level": "Undergraduate",
  "Purpose_Of_Use": "Entertainment"
}
```

Simulation accepts `{ "base": <complete assessment input>, "changes": { "Sleep_Hours_Per_Night": 8 } }`. Invalid types and categories are rejected; finite numeric values outside training ranges are clamped with returned warnings.

## Verification

After setup:

```sh
node tests/test_stack.js
node tests/test_all_views.js
```

The API tests check prediction parity, SHAP reconstruction, plans, resources, malformed payloads and validation through both services. They use temporary free ports and stop their own services.

Browser tests need **Node.js 22+** and Chrome, Edge or Chromium. Set `BROWSER_BIN` if the browser is installed elsewhere. They check eight views at ten viewport sizes from 320 to 2560 pixels, the mobile drawer, theme switching, corrupted storage, preset/reset behavior, assessment failure and stale simulation responses. Set `SCREENSHOT_DIR` to save optional screenshots. Browser profiles are isolated in the OS temporary directory.

## Troubleshooting

- **Python not found or unsupported:** install 64-bit Python 3.11/3.12 and rerun setup.
- **Package download failure:** check internet access and registry availability, then rerun setup. A failed model check is a setup failure, not a successful installation.
- **Port occupied:** close the application using that port or choose different ports in `backend/.env`.
- **Charts missing:** check access to `cdn.jsdelivr.net`; other assessment results remain available.
- **Model unavailable:** inspect the Python terminal error and rerun `node setup.js`. Keep the model and resource CSV in the project root.

The Flask development server is appropriate for a local demonstration. A public deployment needs a production server and a separate deployment review.
