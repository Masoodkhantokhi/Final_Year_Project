"""
mh_engine.py - the "brain" of the Mental Health Assessment & Recommendation System.

EDUCATIONAL PROJECT. This is NOT a medical or diagnostic tool.

What it does, step by step:
  1. validate the user's inputs
  2. predict a wellbeing score (0-10) with the trained ML pipeline
  3. explain the prediction with SHAP (which habits pushed the score up or down)
  4. turn the explanation into written advice (rule-based, easy to defend)
  5. run "what-if" tests with the model (e.g. what if I sleep 30 min more?)
  6. build a 4-week improvement plan and a weekly schedule
  7. match videos and courses from a curated CSV
"""
import numpy as np
import pandas as pd

# ##### SECTION 1: constants #####
NUMERIC_FEATURES = [
    "Avg_Daily_Usage_Hours", "Daily_Unlocks", "Study_Hours",
    "Physical_Activity_Hours", "Sleep_Hours_Per_Night",
]
CATEGORICAL_FEATURES = ["Academic_Level", "Purpose_Of_Use"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET = "Mental_Health_Score"

CHOICES = {
    "Academic_Level": ["High School", "Undergraduate", "Graduate"],
    "Purpose_Of_Use": ["Education", "Entertainment", "Networking", "News"],
}
# Allowed input ranges = (a little wider than) the range seen in the training data
VALID_RANGES = {
    "Avg_Daily_Usage_Hours": (1.0, 9.0),
    "Daily_Unlocks": (60, 280),
    "Study_Hours": (0.3, 8.5),
    "Physical_Activity_Hours": (0.0, 4.2),
    "Sleep_Hours_Per_Night": (3.5, 10.0),
}
FRIENDLY = {
    "Avg_Daily_Usage_Hours": "Daily social-media time",
    "Daily_Unlocks": "Phone checks per day",
    "Study_Hours": "Study time",
    "Physical_Activity_Hours": "Physical activity",
    "Sleep_Hours_Per_Night": "Sleep",
    "Academic_Level": "Academic level",
    "Purpose_Of_Use": "Main purpose of social media",
}
UNITS = {
    "Avg_Daily_Usage_Hours": "h/day", "Daily_Unlocks": "times/day",
    "Study_Hours": "h/day", "Physical_Activity_Hours": "h/day",
    "Sleep_Hours_Per_Night": "h/night",
}
# Score bands (design choice: cut-offs at 5 and 7 give roughly 17% / 51% / 32% of students)
BAND_EDGES = (5.0, 7.0)
BAND_NAMES = ("Needs attention", "Moderate", "Good")

DISCLAIMER = (
    "Educational project - not a medical or psychological diagnosis. The score comes from a "
    "machine-learning model trained on a public student-survey dataset and has not been "
    "clinically validated. Your answers are used only to compute this result and are not saved."
)
SUPPORT_NOTE = (
    "If you have felt low for a long time, or have thoughts of harming yourself, please talk to "
    "someone you trust, a doctor, or a counsellor. In Pakistan you can call the Umang helpline on "
    "0311-7786264 (listed as 24/7 - check umang.com.pk for current details). If you are in "
    "immediate danger, contact your local emergency services."
)


# ##### SECTION 2: validation and bands #####
def score_to_band(score):
    """Turn a 0-10 score into a band name."""
    if score < BAND_EDGES[0]:
        return BAND_NAMES[0]
    if score < BAND_EDGES[1]:
        return BAND_NAMES[1]
    return BAND_NAMES[2]


def validate_inputs(raw):
    """Check the user's inputs. Returns (clean_row, warnings). Raises ValueError if unusable."""
    row, warnings = {}, []
    for f in NUMERIC_FEATURES:
        if f not in raw or raw[f] is None or pd.isna(raw[f]):
            raise ValueError(f"Missing value for {FRIENDLY[f]}")
        value = float(raw[f])
        lo, hi = VALID_RANGES[f]
        if value < lo or value > hi:
            warnings.append(f"{FRIENDLY[f]} = {value:g} is outside the range the model "
                            f"was trained on ({lo:g}-{hi:g}); it was adjusted to fit.")
            value = min(max(value, lo), hi)
        row[f] = value
    for f in CATEGORICAL_FEATURES:
        if raw.get(f) not in CHOICES[f]:
            raise ValueError(f"{FRIENDLY[f]} must be one of {CHOICES[f]}")
        row[f] = raw[f]
    return row, warnings


# ##### SECTION 3: prediction and SHAP explanation #####
def predict_score(artifact, row):
    """Predicted wellbeing score (0-10) for one student."""
    X = pd.DataFrame([row])[FEATURES]
    return float(np.clip(artifact["pipeline"].predict(X)[0], 0, 10))


_EXPLAINERS = {}


def explain_prediction(artifact, row):
    """
    SHAP explanation for one student.
    SHAP gives every column of the encoded data a contribution; we add the one-hot columns back
    together so each ORIGINAL feature gets one number: how many score points it added (+) or
    removed (-) compared with the average student.
    Returns (table, base_value).
    """
    import shap  # imported here so the rest of the module works without SHAP installed
    pipe = artifact["pipeline"]
    prep, model = pipe.named_steps["prep"], pipe.named_steps["model"]
    if id(model) not in _EXPLAINERS:
        _EXPLAINERS[id(model)] = shap.TreeExplainer(model)
    explainer = _EXPLAINERS[id(model)]

    Xt = prep.transform(pd.DataFrame([row])[FEATURES])
    values = np.asarray(explainer.shap_values(Xt))[0]
    base = float(np.ravel(explainer.expected_value)[0])

    contrib = {f: 0.0 for f in FEATURES}
    for name, v in zip(prep.get_feature_names_out(), values):
        short = name.split("__", 1)[1]
        for f in FEATURES:
            if short == f or short.startswith(f + "_"):
                contrib[f] += float(v)
                break
    table = pd.DataFrame({
        "feature": FEATURES,
        "label": [FRIENDLY[f] for f in FEATURES],
        "value": [row[f] for f in FEATURES],
        "contribution": [contrib[f] for f in FEATURES],
    }).sort_values("contribution").reset_index(drop=True)
    return table, base


def describe_driver(r):
    """One plain-English sentence for one row of the SHAP table."""
    f, c = r["feature"], r["contribution"]
    value = f"{r['value']:g} {UNITS[f]}" if f in UNITS else str(r["value"])
    if abs(c) < 0.05:
        return f"{r['label']} ({value}) had almost no effect."
    direction = "raised" if c > 0 else "lowered"
    return f"{r['label']} ({value}) {direction} your score by about {abs(c):.2f} points compared with the average student."


# ##### SECTION 4: written advice (rule-based) #####
def advice_for(feature, row):
    """Short, practical advice text for one habit. Written for a student audience."""
    v = row.get(feature)
    if feature == "Sleep_Hours_Per_Night":
        if v < 7:
            return (f"You sleep about {v:.1f} hours a night. Most adults feel best with 7-9 hours. Try going "
                    "to bed 15-20 minutes earlier every few days, keep the same wake-up time, and keep your "
                    "phone out of reach for the last 30 minutes before sleep.")
        return (f"Your sleep ({v:.1f} h) is in a healthy range. Protect it by keeping a regular bedtime - "
                "irregular timing can hurt as much as too few hours.")
    if feature == "Physical_Activity_Hours":
        return (f"You get about {v * 60:.0f} minutes of physical activity a day. Adults are generally advised to "
                "aim for at least 150 minutes of moderate activity a week (roughly 20-30 minutes a day). Start "
                "with a 15-minute walk after class or after a meal and add 5 minutes each week.")
    if feature == "Avg_Daily_Usage_Hours":
        return (f"You spend about {v:.1f} hours a day on social media. There is no magic number, but cutting "
                "back gradually (30-60 minutes) works better than quitting suddenly. Use app timers, and make "
                "the last hour before bed phone-free.")
    if feature == "Daily_Unlocks":
        return (f"You pick up your phone about {v:.0f} times a day. Turn off non-essential notifications, move "
                "distracting apps off your home screen, and check messages in batches (for example once an hour).")
    if feature == "Study_Hours":
        return (f"You study about {v:.1f} hours a day. In this dataset, students with a steady study routine "
                "scored higher. Try two or three focused 45-minute blocks with 10-minute breaks, at the same "
                "times each day. (Study time and screen time are linked in the data, so treat this as a pattern, "
                "not a rule.)")
    if feature == "Purpose_Of_Use":
        return ("Most of your social-media time is for entertainment. Moving part of it to learning or real "
                "connection (messaging a friend, a study group, a skill video) can make the time feel more worthwhile.")
    return ""


# ##### SECTION 5: what-if simulation and suggested changes #####
# Rule-based targets: (step, limit) = add/subtract 'step' over 4 weeks but never go past 'limit'
STEPS = {
    "Sleep_Hours_Per_Night": (+1.0, 8.0),
    "Physical_Activity_Hours": (+0.3, 2.0),
    "Avg_Daily_Usage_Hours": (-1.0, 2.5),
    "Daily_Unlocks": (-40, 100),
    "Study_Hours": (+0.5, 4.0),
}


def what_if(artifact, row, changes):
    """Predicted score if the habits in `changes` (dict feature -> new value) were different."""
    return predict_score(artifact, {**row, **changes})


def suggest_changes(artifact, row, drivers=None, min_gain=0.10):
    """
    Choose which habits to work on, and by how much.
      * the TARGET comes from a simple rule (STEPS) - easy to explain and safe;
      * a habit is chosen if it lowers this student's score (SHAP) or if the model estimates a clear gain;
      * the model's estimate is shown as 'gain' (a pattern in the data, not a guaranteed effect).
    Single-habit estimates from tree models are noisy (typical error is about 0.4 points), so small
    gains are kept but not advertised. Returns a list, most important first.
    """
    current = predict_score(artifact, row)
    hurt = {} if drivers is None else {f: -c for f, c in zip(drivers["feature"], drivers["contribution"])}
    out = []
    for f, (step, limit) in STEPS.items():
        cur = row[f]
        if (step > 0 and cur >= limit) or (step < 0 and cur <= limit):
            continue                                              # already at a healthy level
        new = min(cur + step, limit) if step > 0 else max(cur + step, limit)
        gain = what_if(artifact, row, {f: new}) - current
        if hurt.get(f, 0.0) >= 0.05 or gain >= min_gain:
            out.append({"feature": f, "label": FRIENDLY[f], "current": cur, "target": new,
                        "gain": gain, "hurt": hurt.get(f, 0.0)})
    if row["Purpose_Of_Use"] == "Entertainment":
        gain = what_if(artifact, row, {"Purpose_Of_Use": "Education"}) - current
        if hurt.get("Purpose_Of_Use", 0.0) >= 0.05 or gain >= min_gain:
            out.append({"feature": "Purpose_Of_Use", "label": FRIENDLY["Purpose_Of_Use"], "current": "Entertainment",
                        "target": "Education", "gain": gain, "hurt": hurt.get("Purpose_Of_Use", 0.0)})
    return sorted(out, key=lambda d: -(max(d["hurt"], 0) + max(d["gain"], 0)))


def combined_effect(artifact, row, changes, n_habits=3):
    """Model estimate if the top numeric habits all reach their targets together (more stable than one at a time)."""
    chosen = [c for c in changes if c["feature"] in STEPS][:n_habits]
    if not chosen:
        return 0.0
    return what_if(artifact, row, {c["feature"]: c["target"] for c in chosen}) - predict_score(artifact, row)


# ##### SECTION 6: improvement plan #####
HOW = {
    "Sleep_Hours_Per_Night": "Fixed wake-up time; bedtime a little earlier; no phone in bed.",
    "Physical_Activity_Hours": "Walk, stretch, sport or cycling - pick something you enjoy.",
    "Avg_Daily_Usage_Hours": "Set an app timer; keep the last hour before bed phone-free.",
    "Daily_Unlocks": "Notifications off; check messages in batches.",
    "Study_Hours": "Focused 45-minute blocks at fixed times, 10-minute breaks.",
}


def _fmt(feature, value):
    if feature == "Physical_Activity_Hours":
        return f"{value * 60:.0f} min/day"
    if feature == "Daily_Unlocks":
        return f"{value:.0f} checks/day"
    return f"{value:.1f} {UNITS[feature]}"


def build_weekly_plan(changes, n_habits=3):
    """
    4-week ramp (25% -> 50% -> 75% -> 100% of the change) plus a Mon-Sun schedule
    for week 1. Uses only numeric habits. Small steps are easier to keep.
    Returns (ramp_table, schedule_table).
    """
    chosen = [c for c in changes if c["feature"] in STEPS][:n_habits]
    ramp_rows = []
    for week, share in enumerate([0.25, 0.5, 0.75, 1.0], start=1):
        for c in chosen:
            value = c["current"] + (c["target"] - c["current"]) * share
            ramp_rows.append({"Week": week, "Habit": c["label"], "Target": _fmt(c["feature"], value),
                              "How": HOW[c["feature"]]})
    ramp = pd.DataFrame(ramp_rows)

    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    schedule = []
    for d in days:
        tasks = []
        for c in chosen:
            f = c["feature"]
            w1 = c["current"] + (c["target"] - c["current"]) * 0.25
            if f in ("Sleep_Hours_Per_Night", "Avg_Daily_Usage_Hours", "Daily_Unlocks"):
                tasks.append(f"{c['label']}: aim for {_fmt(f, w1)}")
            elif f == "Physical_Activity_Hours" and d in ("Mon", "Wed", "Fri", "Sat"):
                tasks.append(f"Move for {_fmt(f, w1)}")
            elif f == "Study_Hours" and d not in ("Sat", "Sun"):
                tasks.append(f"Study {_fmt(f, w1)} in focused blocks")
        if d == "Sun":
            tasks.append("Weekly check-in: what helped? Re-run this assessment and compare.")
        schedule.append({"Day": d, "Plan": " | ".join(tasks) if tasks else "Rest day"})
    return ramp, pd.DataFrame(schedule)


def plan_to_text(ramp, schedule):
    """Plain-text version of the plan (for the download button)."""
    lines = ["MY 4-WEEK IMPROVEMENT PLAN (educational, not medical advice)", ""]
    for week, grp in ramp.groupby("Week"):
        lines.append(f"Week {week}")
        lines += [f"  - {r.Habit}: {r.Target}  ({r.How})" for r in grp.itertuples()]
        lines.append("")
    lines.append("WEEK-1 SCHEDULE")
    lines += [f"  {r.Day}: {r.Plan}" for r in schedule.itertuples()]
    return "\n".join(lines)


# ##### SECTION 7: video and course matching #####
# Which resource tags go with which habit
FACTOR_TAGS = {
    "Sleep_Hours_Per_Night": ["sleep"],
    "Physical_Activity_Hours": ["activity"],
    "Avg_Daily_Usage_Hours": ["screen_time"],
    "Daily_Unlocks": ["screen_time"],
    "Study_Hours": ["study", "habits"],
    "Purpose_Of_Use": ["screen_time"],
}


def recommend_resources(resources, problem_features, k_videos=3, k_courses=3):
    """
    Pick videos / courses whose tags match the habits that hurt the score most.
    `resources` is the curated CSV (columns: type, title, creator, platform, url, tags, why).
    Items tagged 'general' always get a small bonus so the list is never empty.
    """
    wanted = []
    for f in problem_features:
        wanted += FACTOR_TAGS.get(f, [])
    res = resources.copy()

    def score(tag_string):
        tags = [t.strip() for t in str(tag_string).split(";")]
        return sum(1.0 for t in tags if t in wanted) + (0.25 if "general" in tags else 0)

    res["match"] = res["tags"].apply(score) + res["type"].isin(["video", "course"]) * 0.1   # prefer exact links
    res = res.sort_values("match", ascending=False, kind="stable")
    videos = res[(res["type"].isin(["video", "video_search"])) & (res["match"] > 0.15)].head(k_videos)
    courses = res[(res["type"].isin(["course", "course_search"])) & (res["match"] > 0.15)].head(k_courses)
    return videos.reset_index(drop=True), courses.reset_index(drop=True)


# ##### SECTION 8: the full assessment #####
BAND_MESSAGE = {
    "Good": "Your habits look healthy overall. Focus on keeping what works and fine-tuning one or two things.",
    "Moderate": "Your habits are mixed. A few small, steady changes could make a real difference.",
    "Needs attention": ("Several of your habits are pulling your score down. That is common and changeable - "
                        "start with one small change below, and consider talking to someone you trust."),
}


def assess(artifact, raw_inputs, resources=None):
    """Run the whole pipeline for one student and return everything the dashboard needs."""
    row, warnings = validate_inputs(raw_inputs)
    score = predict_score(artifact, row)
    band = score_to_band(score)
    q10, q90 = artifact["residual_q10"], artifact["residual_q90"]
    drivers, base = explain_prediction(artifact, row)

    actionable = drivers[drivers["feature"].isin(FACTOR_TAGS)]
    helping = actionable[actionable["contribution"] >= 0.15].sort_values("contribution", ascending=False)
    strengths = [f"{r.label}: working in your favour (+{r.contribution:.2f}). Keep it up."
                 for r in helping.itertuples()]

    changes = suggest_changes(artifact, row, drivers)
    advice = [{"label": c["label"], "feature": c["feature"], "contribution": -c["hurt"], "gain": c["gain"],
               "text": advice_for(c["feature"], row)} for c in changes[:4]]
    plan_gain = combined_effect(artifact, row, changes)
    ramp, schedule = build_weekly_plan(changes)

    result = {
        "row": row, "warnings": warnings, "score": score, "band": band,
        "range": (float(np.clip(score + q10, 0, 10)), float(np.clip(score + q90, 0, 10))),
        "band_message": BAND_MESSAGE[band], "base_value": base, "drivers": drivers,
        "driver_text": [describe_driver(r) for _, r in drivers.iterrows()],
        "advice": advice, "strengths": strengths, "changes": changes, "plan_gain": plan_gain,
        "ramp": ramp, "schedule": schedule, "show_support": band == "Needs attention",
    }
    if resources is not None:
        focus = [c["feature"] for c in changes[:3]]
        result["videos"], result["courses"] = recommend_resources(resources, focus)
    return result
