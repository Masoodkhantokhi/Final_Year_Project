/**
 * frontend/js/charts.js
 * Responsive Chart.js visualizations & Radial Gauge animations.
 * Built to adapt fluidly across devices and Windows display scaling (100%-200%).
 */

let shapChartInstance = null;
let radarChartInstance = null;

// Track last rendered datasets for smooth resize re-rendering
let lastShapDrivers = null;
let lastUserHabits = null;

/**
 * Animate the Circular/Radial SVG Gauge for Wellbeing Score
 * Maintains 1:1 circular aspect ratio at all viewports.
 */
export function updateScoreGauge(score, band) {
  const scoreEl = document.getElementById('gauge-score-value');
  const circle = document.getElementById('gauge-circle-progress');
  const badgeEl = document.getElementById('score-band-badge');

  if (!circle || !scoreEl) return;

  // Total circumference = 2 * PI * r = 2 * 3.14159 * 90 ≈ 565.48
  const circumference = 565.48;
  const clampedScore = Math.min(Math.max(score, 0), 10);
  const offset = circumference - (clampedScore / 10) * circumference;

  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${offset}`;

  // Color mapping
  let strokeColor = '#f59e0b';
  let badgeClass = 'moderate';

  if (band === 'Good') {
    strokeColor = '#10b981';
    badgeClass = 'good';
  } else if (band === 'Needs attention') {
    strokeColor = '#ef4444';
    badgeClass = 'attention';
  }

  circle.style.stroke = strokeColor;

  if (badgeEl) {
    badgeEl.className = `score-badge-pill ${badgeClass}`;
    badgeEl.textContent = band;
  }

  // Smooth number count-up animation
  let start = 0;
  const duration = 900;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentScore = (ease * clampedScore).toFixed(1);
    scoreEl.textContent = currentScore;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      scoreEl.textContent = clampedScore.toFixed(1);
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Render or update SHAP Horizontal Bar Chart
 * Fully responsive: adapts font sizing and label length to viewport width.
 */
export function renderShapChart(canvasId, drivers) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  lastShapDrivers = drivers;

  // Viewport-aware responsive adjustments
  const screenWidth = window.innerWidth;
  const isMobile = screenWidth < 600;
  const isNarrowMobile = screenWidth < 400;

  // Sort drivers by contribution ascending for intuitive horizontal display
  const sorted = [...drivers].sort((a, b) => a.contribution - b.contribution);

  // Shorten labels on narrow screens to prevent clipping
  const labels = sorted.map((d) => {
    if (isNarrowMobile) {
      const shortMap = {
        'Daily social-media time': 'Social Media',
        'Phone checks per day': 'Phone Checks',
        'Study time': 'Study',
        'Physical activity': 'Activity',
        'Sleep': 'Sleep',
        'Academic level': 'Degree',
        'Main purpose of social media': 'Purpose',
      };
      return shortMap[d.label] || d.label;
    }
    return d.label;
  });

  const data = sorted.map((d) => d.contribution);
  const bgColors = data.map((v) => (v >= 0 ? '#10b981' : '#ef4444'));
  const borderColors = data.map((v) => (v >= 0 ? '#059669' : '#dc2626'));

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? '#1f293d' : '#f1f5f9';

  if (shapChartInstance) {
    shapChartInstance.destroy();
  }

  const yFontSize = isNarrowMobile ? 9 : isMobile ? 10 : 12;
  const xFontSize = isMobile ? 10 : 11;

  shapChartInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Contribution to Score',
          data: data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: isMobile ? 0.75 : 0.65,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 4,
          right: 12,
          top: 6,
          bottom: 6,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#0f172a',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            title: function (items) {
              const idx = items[0].dataIndex;
              return sorted[idx].label;
            },
            label: function (context) {
              const val = context.raw;
              const sign = val >= 0 ? '+' : '';
              return `${sign}${val.toFixed(2)} pts vs student average`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            drawBorder: false,
          },
          ticks: {
            color: textColor,
            font: { family: 'Inter', size: xFontSize },
            callback: (v) => `${v > 0 ? '+' : ''}${v}`,
          },
          title: {
            display: !isMobile,
            text: 'Points Added (+) or Removed (-) vs Baseline',
            color: textColor,
            font: { family: 'Inter', size: 11, weight: '500' },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            color: textColor,
            font: { family: 'Inter', size: yFontSize, weight: '500' },
            autoSkip: false,
          },
        },
      },
    },
  });
}

/**
 * Render Lifestyle Habit Radar Chart
 * Fully responsive with auto-scaled point labels and padding to prevent clipping.
 */
export function renderHabitsRadar(canvasId, userHabits) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  lastUserHabits = userHabits;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? '#1f293d' : '#e2e8f0';

  const screenWidth = window.innerWidth;
  const isMobile = screenWidth < 500;
  const labelFontSize = isMobile ? 9 : 11;

  // Normalize habit metrics to a 0-100 score for healthy balance
  const sleepNorm = Math.min(Math.round((userHabits.Sleep_Hours_Per_Night / 8) * 100), 100);
  const actNorm = Math.min(Math.round((userHabits.Physical_Activity_Hours / 2.0) * 100), 100);
  const studyNorm = Math.min(Math.round((userHabits.Study_Hours / 4.0) * 100), 100);
  const unlocksNorm = Math.round(100 - ((userHabits.Daily_Unlocks - 60) / 220) * 80);
  const usageNorm = Math.round(100 - ((userHabits.Avg_Daily_Usage_Hours - 1) / 8) * 80);

  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  radarChartInstance = new window.Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['Sleep Health', 'Physical Activity', 'Study Focus', 'Screen Freedom', 'Digital Discipline'],
      datasets: [
        {
          label: 'Your Habits',
          data: [sleepNorm, actNorm, studyNorm, usageNorm, unlocksNorm],
          fill: true,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: '#6366f1',
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#6366f1',
        },
        {
          label: 'Optimal Benchmark',
          data: [100, 100, 100, 85, 85],
          fill: true,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderColor: 'rgba(16, 185, 129, 0.6)',
          borderDash: [4, 4],
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: isMobile ? 8 : 14,
          bottom: isMobile ? 8 : 14,
          left: isMobile ? 8 : 16,
          right: isMobile ? 8 : 16,
        },
      },
      elements: {
        line: { borderWidth: 2 },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: isMobile ? 10 : 11 },
            boxWidth: 12,
            padding: isMobile ? 8 : 12,
          },
        },
      },
      scales: {
        r: {
          angleLines: { color: gridColor },
          grid: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { family: 'Inter', size: labelFontSize, weight: '500' },
            padding: isMobile ? 4 : 8,
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { display: false, max: 100, min: 0 },
        },
      },
    },
  });
}

// Window resize observer to adapt charts dynamically
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (shapChartInstance && lastShapDrivers) {
      renderShapChart('shap-chart-canvas', lastShapDrivers);
    }
    if (radarChartInstance && lastUserHabits) {
      renderHabitsRadar('radar-chart-canvas', lastUserHabits);
    }
  }, 200);
});
