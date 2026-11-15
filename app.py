"""
Student Wellbeing Assessment - Streamlit dashboard.
Run with:  streamlit run app.py
Needs in the same folder: Mental_Health_Model.pkl, mh_engine.py, resources.csv
EDUCATIONAL PROJECT - not a medical or diagnostic tool.
"""
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
import sklearn
import streamlit as st

import mh_engine as eng

st.set_page_config(page_title="Student Wellbeing Assessment", page_icon="🧠", layout="wide")

# ------------------------------------------------------------------ load model + resources
HERE = Path(__file__).parent


@st.cache_resource
def load_artifact():
    return joblib.load(HERE / "Mental_Health_Model.pkl")


@st.cache_data
def load_resources():
    return pd.read_csv(HERE / "resources.csv")


missing = [f for f in ("Mental_Health_Model.pkl", "resources.csv") if not (HERE / f).exists()]
if missing:
    st.error(f"Missing file(s): {', '.join(missing)}. Run the notebook first, then keep the files next to app.py.")
    st.stop()

artifact, resources = load_artifact(), load_resources()
if artifact.get("sklearn_version") != sklearn.__version__:
    st.warning(f"The model was trained with scikit-learn {artifact.get('sklearn_version')} but you are running "
               f"{sklearn.__version__}. Install the version in requirements.txt (or re-run the notebook) "
               "to avoid unexpected results.")

# ------------------------------------------------------------------ sidebar: inputs
st.sidebar.title("About you")
st.sidebar.caption("Typical daily or nightly averages. Nothing you enter is saved.")
with st.sidebar.form("inputs"):
    usage = st.slider("Social-media time (hours/day)", 1.0, 9.0, 5.0, 0.1)
    unlocks = st.slider("Phone checks per day", 60, 280, 170, 5)
    study = st.slider("Study time (hours/day)", 0.3, 8.5, 3.0, 0.1)
    activity = st.slider("Physical activity (hours/day)", 0.0, 4.2, 1.7, 0.1)
    sleep = st.slider("Sleep (hours/night)", 3.5, 10.0, 6.6, 0.1)
    level = st.selectbox("Academic level", eng.CHOICES["Academic_Level"], index=1)
    purpose = st.selectbox("Main reason you use social media", eng.CHOICES["Purpose_Of_Use"], index=1)
    st.form_submit_button("Update my assessment", type="primary")
with st.sidebar.expander("Need to talk to someone?"):
    st.write(eng.SUPPORT_NOTE)

inputs = {
    "Avg_Daily_Usage_Hours": usage, "Daily_Unlocks": unlocks, "Study_Hours": study,
    "Physical_Activity_Hours": activity, "Sleep_Hours_Per_Night": sleep,
    "Academic_Level": level, "Purpose_Of_Use": purpose,
}

try:
    res = eng.assess(artifact, inputs, resources)
except ValueError as e:
    st.error(str(e))
    st.stop()

# ------------------------------------------------------------------ header + headline numbers
st.title("🧠 Student Wellbeing Assessment")
st.info(eng.DISCLAIMER)
for w in res["warnings"]:
    st.warning(w)

lo, hi = res["range"]
c1, c2, c3 = st.columns(3)
c1.metric("Estimated wellbeing score", f"{res['score']:.1f} / 10")
c2.metric("Band", res["band"])
c3.metric("Typical range (80%)", f"{lo:.1f} - {hi:.1f}")
st.write(res["band_message"])
if res["show_support"]:
    st.warning("**You are not alone.** " + eng.SUPPORT_NOTE)

tab_why, tab_advice, tab_whatif, tab_plan, tab_res, tab_about = st.tabs(
    ["Why this score?", "Advice", "What-if", "My plan", "Videos & courses", "About & limits"])

# ------------------------------------------------------------------ tab: explanation
with tab_why:
    st.subheader("What pushed your score up or down?")
    st.caption("SHAP explanation: points added (green) or removed (red) compared with the average student.")
    d = res["drivers"].sort_values("contribution")
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.barh(d["label"], d["contribution"], color=["#D1495B" if c < 0 else "#2A9D8F" for c in d["contribution"]])
    ax.axvline(0, color="grey", lw=0.8)
    ax.set_xlabel("Score points vs the average student")
    fig.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
    for line in res["driver_text"][:4]:
        st.write("• " + line)
    st.caption("These are patterns the model learned from a dataset - associations, not proof of cause and effect.")

# ------------------------------------------------------------------ tab: advice
with tab_advice:
    st.subheader("Personal advice")
    if res["advice"]:
        for a in res["advice"]:
            if a["contribution"] <= -0.05:
                note = f"lowered your score by about {abs(a['contribution']):.2f} points vs the average student"
            elif a["gain"] >= 0.1:
                note = f"model estimate: about {a['gain']:+.1f} points if improved"
            else:
                note = "worth improving"
            with st.container(border=True):
                st.markdown(f"**{a['label']}**  ·  {note}")
                st.write(a["text"])
    else:
        st.success("No habit needs changing right now. Keep your routine steady.")
    for s in res["strengths"]:
        st.success(s)

# ------------------------------------------------------------------ tab: what-if
with tab_whatif:
    st.subheader("Suggested targets (4 weeks)")
    if res["changes"]:
        rows = []
        for c in res["changes"]:
            f = c["feature"]
            frm = c["current"] if f == "Purpose_Of_Use" else eng._fmt(f, c["current"])
            to = c["target"] if f == "Purpose_Of_Use" else eng._fmt(f, c["target"])
            est = f"{c['gain']:+.1f} points" if c["gain"] >= 0.1 else "small"
            rows.append({"Habit": c["label"], "From": frm, "To": to, "Model estimate alone": est})
        st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")
        if res["plan_gain"] >= 0.1:
            st.metric("Estimated effect if the top targets are reached together", f"{res['plan_gain']:+.1f} points")
    else:
        st.write("No change stands out - your habits are already in a good place.")
    st.caption("Targets come from simple rules; the numbers are model estimates of patterns in the data "
               "(typical model error is about 0.4 points), not guaranteed results.")

    st.subheader("Try your own changes")
    row = res["row"]
    w1, w2, w3 = st.columns(3)
    n_sleep = w1.slider("Sleep (h/night)", 3.5, 10.0, float(row["Sleep_Hours_Per_Night"]), 0.1, key="ws")
    n_act = w2.slider("Activity (h/day)", 0.0, 4.2, float(row["Physical_Activity_Hours"]), 0.1, key="wa")
    n_use = w3.slider("Social media (h/day)", 1.0, 9.0, float(row["Avg_Daily_Usage_Hours"]), 0.1, key="wu")
    new_score = eng.what_if(artifact, row, {"Sleep_Hours_Per_Night": n_sleep, "Physical_Activity_Hours": n_act,
                                           "Avg_Daily_Usage_Hours": n_use})
    st.metric("Estimated score with these changes", f"{new_score:.1f} / 10", f"{new_score - res['score']:+.2f}")
    st.caption("Differences under about 0.3 points are within the model's normal error - treat them as noise.")

# ------------------------------------------------------------------ tab: plan
with tab_plan:
    st.subheader("Your 4-week plan")
    if len(res["ramp"]):
        st.caption("Small steps: each week moves you a bit closer to the target.")
        for week, grp in res["ramp"].groupby("Week"):
            with st.expander(f"Week {week}", expanded=(week == 1)):
                st.dataframe(grp[["Habit", "Target", "How"]], hide_index=True, width="stretch")
        st.subheader("Week-1 schedule")
        st.dataframe(res["schedule"], hide_index=True, width="stretch")
        st.download_button("Download my plan (.txt)", eng.plan_to_text(res["ramp"], res["schedule"]),
                           file_name="my_wellbeing_plan.txt")
    else:
        st.write("No numeric habit needs changing right now. Keep your current routine and re-check in a few weeks.")

# ------------------------------------------------------------------ tab: videos and courses
with tab_res:
    st.subheader("Videos")
    for r in res["videos"].itertuples():
        st.markdown(f"**[{r.title}]({r.url})** - {r.creator} · {r.platform}")
        st.caption(r.why)
    st.subheader("Courses and learning resources")
    for r in res["courses"].itertuples():
        st.markdown(f"**[{r.title}]({r.url})** - {r.creator} · {r.platform}")
        st.caption(r.why)
    st.caption("Links come from a small hand-checked list (resources.csv). Course prices and free-audit options can change.")

# ------------------------------------------------------------------ tab: about
with tab_about:
    m = artifact["metrics"]
    st.subheader("How this works")
    st.write(f"A **{artifact['model_name']}** model predicts a 0-10 wellbeing score from 7 inputs. "
             f"On students it had never seen, it was off by about **{m['test_mae']:.2f} points** on average "
             f"(R² = {m['test_r2']:.2f}). SHAP explains each prediction; the advice is rule-based; "
             "what-if numbers come from the model.")
    st.subheader("Limits you should know")
    st.markdown(
        "- Educational project - **not a diagnosis** and not a replacement for a doctor or counsellor.\n"
        "- The training data is a public student-survey dataset that looks simulated; accuracy on real students is unknown.\n"
        "- The score is not a clinically validated measure.\n"
        "- Country, gender, age and stress level are deliberately **not used**: they are not things you can change, "
        "and advice should not depend on who you are.\n"
        "- Nothing you type is stored by this app.")
    st.subheader("Support")
    st.write(eng.SUPPORT_NOTE)
