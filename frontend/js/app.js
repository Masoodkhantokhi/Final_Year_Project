/**
 * frontend/js/app.js
 * Master Application Controller for Student Wellbeing Assessment System
 */

import { api } from './api.js';
import { updateScoreGauge, renderShapChart, renderHabitsRadar } from './charts.js';

// Application State
const state = {
  currentInputs: {
    Avg_Daily_Usage_Hours: 5.0,
    Daily_Unlocks: 170,
    Study_Hours: 3.0,
    Physical_Activity_Hours: 1.7,
    Sleep_Hours_Per_Night: 6.6,
    Academic_Level: 'Undergraduate',
    Purpose_Of_Use: 'Entertainment',
  },
  assessmentData: null,
  simulatedInputs: null,
  metadata: null,
  selectedPlanWeek: 1,
  activeView: 'view-dashboard',
};

// Preset Profiles
const PRESETS = {
  typical: {
    Avg_Daily_Usage_Hours: 5.0,
    Daily_Unlocks: 170,
    Study_Hours: 3.0,
    Physical_Activity_Hours: 1.7,
    Sleep_Hours_Per_Night: 6.6,
    Academic_Level: 'Undergraduate',
    Purpose_Of_Use: 'Entertainment',
  },
  balanced: {
    Avg_Daily_Usage_Hours: 2.5,
    Daily_Unlocks: 95,
    Study_Hours: 4.0,
    Physical_Activity_Hours: 2.0,
    Sleep_Hours_Per_Night: 8.0,
    Academic_Level: 'Undergraduate',
    Purpose_Of_Use: 'Education',
  },
  stressed: {
    Avg_Daily_Usage_Hours: 7.2,
    Daily_Unlocks: 240,
    Study_Hours: 5.5,
    Physical_Activity_Hours: 0.3,
    Sleep_Hours_Per_Night: 4.8,
    Academic_Level: 'Graduate',
    Purpose_Of_Use: 'Entertainment',
  },
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupNavigation();
  setupSliderBadges();
  setupPresets();
  setupForm();
  setupSimulator();
  setupPlanInteractions();

  // Load initial health & metadata
  await checkSystemStatus();

  // Run initial default assessment
  await runAssessment(state.currentInputs);
});

/* ==========================================================================
   Theme Management
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);

      // Re-render charts with updated theme colors
      if (state.assessmentData) {
        renderShapChart('shap-chart-canvas', state.assessmentData.drivers);
        renderHabitsRadar('radar-chart-canvas', state.assessmentData.row);
      }
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  } else {
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }
}

/* ==========================================================================
   Navigation
   ========================================================================== */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[data-view]');
  const breadcrumb = document.getElementById('breadcrumb-current-text');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('mobile-menu-btn');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      switchView(targetView, link.textContent.trim());

      // Close mobile sidebar if open
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  });

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

export function switchView(viewId, viewTitle) {
  state.activeView = viewId;

  // Toggle sections
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.remove('active');
  });
  const activeSec = document.getElementById(viewId);
  if (activeSec) activeSec.classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update breadcrumb
  const breadcrumb = document.getElementById('breadcrumb-current-text');
  if (breadcrumb && viewTitle) {
    breadcrumb.textContent = viewTitle;
  }

  // Trigger chart resize if navigating to chart views
  if (viewId === 'view-insights' && state.assessmentData) {
    setTimeout(() => {
      renderShapChart('shap-chart-canvas', state.assessmentData.drivers);
    }, 50);
  } else if (viewId === 'view-dashboard' && state.assessmentData) {
    setTimeout(() => {
      renderHabitsRadar('radar-chart-canvas', state.assessmentData.row);
    }, 50);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   Slider Badges & Live Input Sync
   ========================================================================== */
function setupSliderBadges() {
  const sliders = document.querySelectorAll('input[type="range"]');
  sliders.forEach((slider) => {
    const badgeId = slider.getAttribute('data-badge');
    const unit = slider.getAttribute('data-unit') || '';
    const badge = document.getElementById(badgeId);

    if (badge) {
      badge.textContent = `${slider.value} ${unit}`;
      slider.addEventListener('input', () => {
        badge.textContent = `${slider.value} ${unit}`;
      });
    }
  });
}

function updateFormInputs(inputs) {
  for (const [key, val] of Object.entries(inputs)) {
    const el = document.getElementById(`input-${key}`);
    if (el) {
      el.value = val;
      const badgeId = el.getAttribute('data-badge');
      const unit = el.getAttribute('data-unit') || '';
      const badge = document.getElementById(badgeId);
      if (badge) badge.textContent = `${val} ${unit}`;
    }
  }
}

/* ==========================================================================
   Presets
   ========================================================================== */
function setupPresets() {
  document.querySelectorAll('.preset-chip[data-preset]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const presetKey = chip.getAttribute('data-preset');
      const profile = PRESETS[presetKey];
      if (profile) {
        updateFormInputs(profile);
        showToast(`Loaded "${chip.textContent.trim()}" profile`);
        await runAssessment(profile);
      }
    });
  });
}

/* ==========================================================================
   Form Handling & Assessment Execution
   ========================================================================== */
function setupForm() {
  const form = document.getElementById('assessment-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-assessment-btn');
    if (btn) btn.disabled = true;

    const inputs = {
      Avg_Daily_Usage_Hours: parseFloat(document.getElementById('input-Avg_Daily_Usage_Hours').value),
      Daily_Unlocks: parseFloat(document.getElementById('input-Daily_Unlocks').value),
      Study_Hours: parseFloat(document.getElementById('input-Study_Hours').value),
      Physical_Activity_Hours: parseFloat(document.getElementById('input-Physical_Activity_Hours').value),
      Sleep_Hours_Per_Night: parseFloat(document.getElementById('input-Sleep_Hours_Per_Night').value),
      Academic_Level: document.getElementById('input-Academic_Level').value,
      Purpose_Of_Use: document.getElementById('input-Purpose_Of_Use').value,
    };

    state.currentInputs = inputs;
    await runAssessment(inputs);

    if (btn) btn.disabled = false;
    showToast('Assessment updated successfully!');
    switchView('view-dashboard', 'Dashboard');
  });
}

async function runAssessment(inputs) {
  try {
    const data = await api.assess(inputs);
    state.assessmentData = data;
    renderAssessmentResults(data);
    syncSimulatorBase(inputs, data.score);
  } catch (err) {
    showToast(`Assessment failed: ${err.message}`, 'error');
  }
}

/* ==========================================================================
   Render Assessment Results Across All Views
   ========================================================================== */
function renderAssessmentResults(data) {
  // 1. Gauge & Header Metrics
  updateScoreGauge(data.score, data.band);

  const rangeEl = document.getElementById('metric-range-val');
  if (rangeEl) rangeEl.textContent = `${data.range[0].toFixed(1)} - ${data.range[1].toFixed(1)}`;

  const bandDescEl = document.getElementById('score-band-message');
  if (bandDescEl) bandDescEl.textContent = data.band_message;

  const baselineEl = document.getElementById('metric-base-val');
  if (baselineEl) baselineEl.textContent = `${data.base_value.toFixed(1)} / 10`;

  const gainEl = document.getElementById('metric-plan-gain-val');
  if (gainEl) gainEl.textContent = data.plan_gain > 0 ? `+${data.plan_gain.toFixed(1)} pts` : 'Optimized';

  // Crisis Banner
  const crisisBanner = document.getElementById('crisis-support-banner');
  if (crisisBanner) {
    crisisBanner.style.display = data.show_support ? 'flex' : 'none';
  }

  // Strengths
  const strengthsBox = document.getElementById('strengths-list');
  if (strengthsBox) {
    if (data.strengths && data.strengths.length > 0) {
      strengthsBox.innerHTML = data.strengths
        .map(
          (s) => `
        <div class="strength-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          <span>${s}</span>
        </div>
      `
        )
        .join('');
      strengthsBox.parentElement.style.display = 'block';
    } else {
      strengthsBox.parentElement.style.display = 'none';
    }
  }

  // 2. Charts
  renderHabitsRadar('radar-chart-canvas', data.row);
  renderShapChart('shap-chart-canvas', data.drivers);

  // 3. Narrative Drivers List
  const driversList = document.getElementById('shap-drivers-list');
  if (driversList) {
    driversList.innerHTML = data.drivers
      .map((d) => {
        const isPos = d.contribution >= 0;
        const sign = isPos ? '+' : '';
        return `
          <div class="driver-item ${isPos ? 'positive' : 'negative'}">
            <div class="driver-label-desc">
              <span class="driver-name">${d.label}</span>
              <span class="driver-desc">${d.value} ${getUnit(d.feature)}</span>
            </div>
            <span class="driver-score-tag ${isPos ? 'positive' : 'negative'}">
              ${sign}${d.contribution.toFixed(2)} pts
            </span>
          </div>
        `;
      })
      .join('');
  }

  // 4. Recommendations Cards
  const adviceGrid = document.getElementById('recommendations-grid');
  if (adviceGrid) {
    if (data.advice && data.advice.length > 0) {
      adviceGrid.innerHTML = data.advice
        .map((a) => {
          return `
            <div class="advice-card">
              <div class="advice-header">
                <span class="advice-habit-name">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                  ${a.label}
                </span>
                ${
                  a.gain >= 0.1
                    ? `<span class="advice-gain-badge">Est. Gain: +${a.gain.toFixed(1)}</span>`
                    : ''
                }
              </div>
              <p class="advice-body">${a.text}</p>
            </div>
          `;
        })
        .join('');
    } else {
      adviceGrid.innerHTML = `
        <div class="advice-card" style="grid-column: 1 / -1; text-align: center;">
          <p class="advice-body">Your lifestyle habits are well-balanced. Keep up your current daily rhythm!</p>
        </div>
      `;
    }
  }

  // 5. Plan & Schedule
  renderPlanTable(data.ramp, state.selectedPlanWeek);
  renderSchedule(data.schedule);

  // 6. Educational Resources
  renderResources(data.videos, data.courses);
}

function getUnit(feat) {
  const units = {
    Avg_Daily_Usage_Hours: 'h/day',
    Daily_Unlocks: 'checks/day',
    Study_Hours: 'h/day',
    Physical_Activity_Hours: 'h/day',
    Sleep_Hours_Per_Night: 'h/night',
    Academic_Level: '',
    Purpose_Of_Use: '',
  };
  return units[feat] || '';
}

/* ==========================================================================
   What-If Simulator
   ========================================================================== */
let simDebounceTimer = null;

function setupSimulator() {
  const simSliders = ['sim-sleep', 'sim-activity', 'sim-usage', 'sim-unlocks', 'sim-study'];

  simSliders.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      const badge = document.getElementById(`${id}-val`);
      const unit = el.getAttribute('data-unit') || '';
      if (badge) badge.textContent = `${el.value} ${unit}`;

      // Debounce live simulation request
      clearTimeout(simDebounceTimer);
      simDebounceTimer = setTimeout(triggerSimulation, 150);
    });
  });

  const resetBtn = document.getElementById('reset-simulation-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (state.currentInputs) {
        syncSimulatorBase(state.currentInputs, state.assessmentData?.score || 6.0);
        showToast('Simulator reset to your original habits');
      }
    });
  }
}

function syncSimulatorBase(inputs, currentScore) {
  const baseScoreEl = document.getElementById('sim-base-score');
  const simScoreEl = document.getElementById('sim-target-score');
  const diffPill = document.getElementById('sim-diff-pill');

  if (baseScoreEl) baseScoreEl.textContent = currentScore.toFixed(1);
  if (simScoreEl) simScoreEl.textContent = currentScore.toFixed(1);
  if (diffPill) {
    diffPill.className = 'gain-indicator-pill neutral';
    diffPill.textContent = '±0.0 pts (Unchanged)';
  }

  // Set slider values
  setSimVal('sim-sleep', inputs.Sleep_Hours_Per_Night);
  setSimVal('sim-activity', inputs.Physical_Activity_Hours);
  setSimVal('sim-usage', inputs.Avg_Daily_Usage_Hours);
  setSimVal('sim-unlocks', inputs.Daily_Unlocks);
  setSimVal('sim-study', inputs.Study_Hours);
}

function setSimVal(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.value = val;
    const badge = document.getElementById(`${id}-val`);
    const unit = el.getAttribute('data-unit') || '';
    if (badge) badge.textContent = `${val} ${unit}`;
  }
}

async function triggerSimulation() {
  if (!state.currentInputs) return;

  const changes = {
    Sleep_Hours_Per_Night: parseFloat(document.getElementById('sim-sleep').value),
    Physical_Activity_Hours: parseFloat(document.getElementById('sim-activity').value),
    Avg_Daily_Usage_Hours: parseFloat(document.getElementById('sim-usage').value),
    Daily_Unlocks: parseFloat(document.getElementById('sim-unlocks').value),
    Study_Hours: parseFloat(document.getElementById('sim-study').value),
  };

  try {
    const simResult = await api.simulate(state.currentInputs, changes);

    const simScoreEl = document.getElementById('sim-target-score');
    const diffPill = document.getElementById('sim-diff-pill');

    if (simScoreEl) simScoreEl.textContent = simResult.simulated_score.toFixed(1);

    if (diffPill) {
      const diff = simResult.score_diff;
      if (diff > 0.05) {
        diffPill.className = 'gain-indicator-pill positive';
        diffPill.textContent = `+${diff.toFixed(2)} pts Projected Gain`;
      } else if (diff < -0.05) {
        diffPill.className = 'gain-indicator-pill negative';
        diffPill.textContent = `${diff.toFixed(2)} pts Projected Drop`;
      } else {
        diffPill.className = 'gain-indicator-pill neutral';
        diffPill.textContent = `±${Math.abs(diff).toFixed(2)} pts (Within Model Noise)`;
      }
    }
  } catch (err) {
    console.error('Simulation error:', err);
  }
}

/* ==========================================================================
   4-Week Improvement Plan & Schedule Checklist
   ========================================================================== */
function setupPlanInteractions() {
  document.querySelectorAll('.plan-tab-btn[data-week]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.plan-tab-btn[data-week]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const week = parseInt(btn.getAttribute('data-week'), 10);
      state.selectedPlanWeek = week;
      if (state.assessmentData) {
        renderPlanTable(state.assessmentData.ramp, week);
      }
    });
  });

  const downloadBtn = document.getElementById('download-plan-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadPlanText);
  }
}

function renderPlanTable(ramp, selectedWeek) {
  const container = document.getElementById('plan-table-body');
  if (!container || !ramp) return;

  const weekRows = ramp.filter((r) => r.Week === selectedWeek);
  container.innerHTML = weekRows
    .map(
      (r) => `
    <tr>
      <td style="font-weight: 600;">${r.Habit}</td>
      <td><span class="driver-score-tag positive">${r.Target}</span></td>
      <td style="color: var(--text-secondary);">${r.How}</td>
    </tr>
  `
    )
    .join('');
}

function renderSchedule(schedule) {
  const list = document.getElementById('schedule-checklist');
  if (!list || !schedule) return;

  const savedChecks = JSON.parse(localStorage.getItem('schedule_checks') || '{}');

  list.innerHTML = schedule
    .map((item, idx) => {
      const isChecked = savedChecks[item.Day] ? 'checked' : '';
      return `
      <div class="schedule-day-card">
        <input type="checkbox" class="schedule-checkbox" data-day="${item.Day}" ${isChecked}>
        <span class="schedule-day-badge">${item.Day}</span>
        <span class="schedule-plan-text" style="${isChecked ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          ${item.Plan}
        </span>
      </div>
    `;
    })
    .join('');

  // Add checkbox toggle listeners
  list.querySelectorAll('.schedule-checkbox').forEach((box) => {
    box.addEventListener('change', (e) => {
      const day = box.getAttribute('data-day');
      const current = JSON.parse(localStorage.getItem('schedule_checks') || '{}');
      current[day] = box.checked;
      localStorage.setItem('schedule_checks', JSON.stringify(current));

      const textEl = box.nextElementSibling.nextElementSibling;
      if (textEl) {
        textEl.style.textDecoration = box.checked ? 'line-through' : 'none';
        textEl.style.opacity = box.checked ? '0.6' : '1';
      }
      showToast(`${day} task marked ${box.checked ? 'completed' : 'pending'}`);
    });
  });
}

function downloadPlanText() {
  if (!state.assessmentData) return;

  const { ramp, schedule } = state.assessmentData;
  let text = `=====================================================\n`;
  text += ` STUDENT WELLBEING PERSONAL IMPROVEMENT PLAN\n`;
  text += ` Educational guidance based on predictive model analysis\n`;
  text += `=====================================================\n\n`;

  [1, 2, 3, 4].forEach((w) => {
    text += `WEEK ${w} TARGETS:\n`;
    const rows = ramp.filter((r) => r.Week === w);
    rows.forEach((r) => {
      text += `  • ${r.Habit}: Target ${r.Target} (${r.How})\n`;
    });
    text += `\n`;
  });

  text += `-----------------------------------------------------\n`;
  text += `WEEK-1 ACTION SCHEDULE:\n`;
  text += `-----------------------------------------------------\n`;
  schedule.forEach((s) => {
    text += `  [${s.Day}] ${s.Plan}\n`;
  });

  text += `\nNote: This tool is educational and not clinical psychological advice.`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Wellbeing_Improvement_Plan.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Plan downloaded as text file');
}

/* ==========================================================================
   Educational Resources Cards
   ========================================================================== */
function renderResources(videos, courses) {
  const vidContainer = document.getElementById('resources-videos-grid');
  const courseContainer = document.getElementById('resources-courses-grid');

  if (vidContainer && videos) {
    vidContainer.innerHTML = videos
      .map(
        (v) => `
      <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="resource-card">
        <div class="resource-meta">
          <span class="resource-platform-badge">${v.platform}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${v.creator}</span>
        </div>
        <h4 class="resource-title">${v.title}</h4>
        <p class="resource-desc">${v.why}</p>
        <div class="resource-footer">
          <span>Watch Video</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </div>
      </a>
    `
      )
      .join('');
  }

  if (courseContainer && courses) {
    courseContainer.innerHTML = courses
      .map(
        (c) => `
      <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="resource-card">
        <div class="resource-meta">
          <span class="resource-platform-badge">${c.platform}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${c.creator}</span>
        </div>
        <h4 class="resource-title">${c.title}</h4>
        <p class="resource-desc">${c.why}</p>
        <div class="resource-footer">
          <span>Explore Course</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </div>
      </a>
    `
      )
      .join('');
  }
}

/* ==========================================================================
   System Status & Toast Notifications
   ========================================================================== */
async function checkSystemStatus() {
  const indicator = document.getElementById('system-status-indicator');
  const label = document.getElementById('system-status-text');

  const health = await api.getHealth();
  if (health.status === 'healthy' && indicator && label) {
    indicator.className = 'status-indicator';
    label.textContent = `Model Online (${health.ml_service.model_name})`;
  } else if (indicator && label) {
    indicator.className = 'status-indicator degraded';
    label.textContent = 'Degraded connection';
  }
}

export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${
      type === 'error' ? '#ef4444' : '#10b981'
    }" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span>${msg}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
