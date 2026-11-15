# Student Wellbeing Assessment & Recommendation System (WellbeingAI)
> **Final Year Project** | Full-Stack Machine Learning Web Application

An end-to-end Explainable AI (XAI) application designed to assess, interpret, and optimize student mental wellbeing based on lifestyle, academic routines, and digital phone usage habits.

---

## 1. Overview & Key Capabilities

- **Predictive Scoring Pipeline**: Deploys a tuned Random Forest regression model ($R^2 = 0.85$, $MAE = 0.40$) to compute an accurate wellbeing score ($0.0 - 10.0$) and categorizes it into defined bands (*Needs attention*, *Moderate*, *Good*).
- **Explainable AI (SHAP)**: Employs TreeExplainer to break down predictions into precise positive and negative habit attributions, transparently displaying what helped or hindered the student's wellbeing score.
- **Interactive "What-If" Habit Studio**: Real-time simulation playground powered by the live ML model, allowing students to tweak variables (sleep, screen time, physical exercise) and immediately visualize score impact.
- **4-Week Structured Improvement Ramp**: Automatically designs incremental 25% weekly targets and provides an interactive week-1 checklist with local browser persistence (`localStorage`).
- **Curated Educational Resources**: Matches specific habit deficiencies with vetted lectures (TED talks by neuroscientists and sleep scientists) and free university courses (Yale, UC Berkeley).
- **Ethical AI**: Purposely excludes demographic indicators (age, gender, nationality) from training to prevent algorithmic bias; operates with zero server-side user data storage.

---

## 2. Modern Technology Stack

| Layer | Technologies & Tools |
|---|---|
| **Frontend** | HTML5, CSS3 (Modern SaaS design system, CSS variables, dark/light theme), JavaScript (ES6+ Modules), Chart.js 4.4, Custom SVG Gauge & Icons |
| **Backend Gateway** | Node.js (v18+), Express.js, REST API, Morgan logging, CORS, input sanitization middleware |
| **ML Microservice** | Python 3.12, Flask 3.1, scikit-learn 1.9.1, SHAP 0.54, pandas 3.1, joblib |
| **Orchestrator** | Node.js automated process manager (`start.js`) & one-click launcher scripts |

---

## 3. Project Directory Structure

```text
Final_Year_Project/
├── backend/                             # Node.js Express Gateway
│   ├── controllers/
│   │   └── assessmentController.js      # REST API route handlers
│   ├── middleware/
│   │   └── validation.js                # Input sanitization and bounds checking
│   ├── routes/
│   │   └── api.js                       # Route declarations (/api/*)
│   ├── services/
│   │   └── mlService.js                 # Resilient HTTP proxy to Python ML service
│   ├── .env.example                     # Environment configuration template
│   ├── package.json                     # Node dependencies & scripts
│   └── server.js                        # Express server & static asset host (Port 3000)
│
├── frontend/                            # Modern SaaS Dashboard SPA
│   ├── css/
│   │   └── style.css                    # Design tokens, themes, layouts, animations
│   ├── js/
│   │   ├── api.js                       # ES6 API client
│   │   ├── charts.js                    # Chart.js SHAP bar & habit radar charts
│   │   └── app.js                       # SPA router, state, presets, what-if, plan
│   └── index.html                       # Semantic HTML5 single-page application
│
├── ml-service/                          # Dedicated Python ML Microservice
│   └── app.py                           # Flask REST API serving model & SHAP (Port 5001)
│
├── Mental_Health_Model.pkl              # Core trained Random Forest model & metrics
├── mh_engine.py                         # Validation, SHAP TreeExplainer, rule-based advice
├── resources.csv                        # Curated educational videos and courses
├── Student_Social_Media_...csv          # Original training dataset
├── Mental_Health_Assessment_System.ipynb # Research notebook for thesis & viva defense
├── requirements.txt                     # Python pip package specifications
├── start.js                             # Cross-platform orchestrator (starts ML + Node)
├── START_DASHBOARD_WINDOWS.bat          # One-click launcher for Windows
├── START_DASHBOARD_MAC_LINUX.sh         # One-click launcher for Mac / Linux
└── README.md                            # Comprehensive documentation
```

---

## 4. Quickstart Guide (Local Development)

### Prerequisites
1. **Python 3.12**: Download from [python.org](https://www.python.org/) (ensure *"Add python.exe to PATH"* is checked).
2. **Node.js (v18 or higher)**: Download from [nodejs.org](https://nodejs.org/).

### One-Click Launch
- **Windows**: Double-click `START_DASHBOARD_WINDOWS.bat`
- **Mac / Linux**: Run `bash START_DASHBOARD_MAC_LINUX.sh`

The launcher will verify dependencies, start both the Python ML service and Express backend, and automatically open your browser at `http://localhost:3000`.

### Running in VS Code / Terminal
1. **Set up Python Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   ```

2. **Set up Node.js Backend**:
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Run Unified Launcher**:
   ```bash
   node start.js
   ```

---

## 5. REST API Documentation

The Express gateway exposes endpoints under `/api`:

### `GET /api/health`
Health verification across both Express and Python ML services.
```json
{
  "status": "healthy",
  "gateway": { "status": "ok", "uptime": 12.4 },
  "ml_service": {
    "status": "ok",
    "model_name": "Random Forest (tuned)",
    "metrics": { "test_r2": 0.85, "test_mae": 0.40 }
  }
}
```

### `POST /api/assess`
Computes complete wellbeing assessment, SHAP drivers, personalized advice, 4-week ramp, and matched resources.
- **Request Body**:
  ```json
  {
    "Avg_Daily_Usage_Hours": 5.0,
    "Daily_Unlocks": 170,
    "Study_Hours": 3.0,
    "Physical_Activity_Hours": 1.7,
    "Sleep_Hours_Per_Night": 6.6,
    "Academic_Level": "Undergraduate",
    "Purpose_Of_Use": "Entertainment"
  }
  ```
- **Response**: Full JSON containing `score`, `band`, `range`, `drivers` (SHAP attributions), `advice`, `ramp`, `schedule`, `videos`, and `courses`.

### `POST /api/simulate`
Live what-if habit modification evaluation.
- **Request Body**:
  ```json
  {
    "base": { ... },
    "changes": {
      "Sleep_Hours_Per_Night": 8.0,
      "Physical_Activity_Hours": 2.2
    }
  }
  ```
- **Response**: `{ current_score, simulated_score, score_diff, simulated_band }`

---

## 6. Model Verification & Parity

The modernized architecture preserves 100% fidelity with the original machine learning pipeline:
- Estimator: Scikit-learn `Pipeline` (ColumnTransformer + RandomForestRegressor).
- SHAP: Local explanations aggregated to parent feature names using `TreeExplainer`.
- Preprocessing & ranges: Identical bounds enforced across client, gateway, and ML service.

---

## 7. Educational & Crisis Support Disclaimers
This tool was engineered strictly as an educational and academic final-year project. It does **not** provide psychological or psychiatric diagnosis, clinical treatment, or medical advice. 

- **Pakistan Mental Health Hotline**: Umang 24/7 Helpline at `0311-7786264` ([umang.com.pk](https://umang.com.pk)).
- **Emergency**: For immediate danger or self-harm crisis, contact local emergency services immediately.
