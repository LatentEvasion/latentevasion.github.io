const state = {
  manifest: null,
  prompts: [],
  ridge: null,
  visibleMethods: new Set(["dim", "pipeline", "projection"]),
  evasionDrag: false,
  evasionCompassDrag: false,
  tokenScore: null,
  tokenManifest: null,
  layerDive: {
    prompts: [],
    ridge: null,
    config: null,
    visibleMethods: new Set(["dim", "pipeline", "projection"]),
  },
};

const els = {
  home: document.querySelector("#homePage"),
  explorer: document.querySelector("#explorerPage"),
  backHome: document.querySelector("#backHome"),
  model: document.querySelector("#modelSelect"),
  layers: document.querySelector("#layersSelect"),
  margin: document.querySelector("#marginSelect"),
  prompt: document.querySelector("#promptSelect"),
  layerJump: document.querySelector("#layerJumpSelect"),
  methodPins: [...document.querySelectorAll('input[name="methodPin"]')],
  charts: document.querySelector("#charts"),
  promptTitle: document.querySelector("#promptTitle"),
  promptCategory: document.querySelector("#promptCategory"),
  metadata: document.querySelector("#metadata"),
  evasionModel: document.querySelector("#evasionModelSelect"),
  evasionPrompt: document.querySelector("#evasionPromptSelect"),
  evasionMargin: document.querySelector("#evasionMarginSlider"),
  regionCompassTrack: document.querySelector(".region-compass-track"),
  regionBoundaryTick: document.querySelector("#regionBoundaryTick"),
  regionBoundaryLabel: document.querySelector("#regionBoundaryLabel"),
  regionCompassMarker: document.querySelector("#regionCompassMarker"),
  evasionCanvas: document.querySelector("#evasionCanvas"),
  evasionCompletion: document.querySelector("#evasionCompletion"),
  evasionPlotPrompt: document.querySelector("#evasionPlotPrompt"),
  tokenModel: document.querySelector("#tokenModelSelect"),
  tokenPrompt: document.querySelector("#tokenPromptSelect"),
  tokenSlider: document.querySelector("#tokenSlider"),
  tokenCompletionSlider: document.querySelector("#tokenCompletionSlider"),
  tokenCanvas: document.querySelector("#tokenCanvas"),
  tokenReadout: document.querySelector("#tokenReadout"),
  tokenCompletionReadout: document.querySelector("#tokenCompletionReadout"),
  tokenPromptText: document.querySelector("#tokenPromptText"),
  tokenValues: document.querySelector("#tokenValues"),
  tokenCompletionClea: document.querySelector("#tokenCompletionClea"),
  tokenCompletionClep: document.querySelector("#tokenCompletionClep"),
  tokenCompletionDim: document.querySelector("#tokenCompletionDim"),
  layerDiveModel: document.querySelector("#layerDiveModelSelect"),
  layerDivePrompt: document.querySelector("#layerDivePromptSelect"),
  layerDiveLayer: document.querySelector("#layerDiveLayerSlider"),
  layerDiveLayerReadout: document.querySelector("#layerDiveLayerReadout"),
  layerDiveMethodPins: [...document.querySelectorAll('input[name="layerDiveMethod"]')],
  layerDivePromptText: document.querySelector("#layerDivePromptText"),
  layerDiveChartTitle: document.querySelector("#layerDiveChartTitle"),
  layerDiveCanvas: document.querySelector("#layerDiveCanvas"),
};

const params = new URLSearchParams(window.location.search);
const USE_STATIC_DATA = params.has("static") || !["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const TOKEN_SCORE_MAX_STEPS = 100;

function staticKey(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

function staticDataUrl(apiUrl) {
  const url = new URL(apiUrl, window.location.origin);
  if (url.pathname === "/api/manifest") return "data/api/manifest.json";
  if (url.pathname === "/api/token-score-models") return "data/api/token-score-models.json";
  if (url.pathname === "/api/evasion-demo-models") return "data/api/evasion-demo-models.json";
  if (url.pathname === "/api/prompts") {
    return `data/api/prompts/${staticKey(url.searchParams.get("file") || "")}.json`;
  }
  if (url.pathname === "/api/ridgeline") {
    return `data/api/ridgeline/${staticKey(url.searchParams.get("file") || "")}.json`;
  }
  if (url.pathname === "/api/token-score") {
    return `data/api/token-score/${staticKey(url.searchParams.get("model") || "llama2-7b")}.json`;
  }
  if (url.pathname === "/api/evasion-demo") {
    return `data/api/evasion-demo/${staticKey(url.searchParams.get("model") || "llama2-7b")}.json`;
  }
  return apiUrl;
}

function materializeStaticRidgeline(bundle, promptIndex) {
  const selectedByPrompt = bundle.selectedByPrompt || {};
  const selected = selectedByPrompt[String(promptIndex)] || selectedByPrompt["0"] || [];
  return {
    ...bundle,
    layers: (bundle.layers || []).map((layer, index) => ({
      ...layer,
      selected: {
        pipeline: Number.isFinite(layer.pipeline?.[promptIndex])
          ? layer.pipeline[promptIndex]
          : selected[index]?.pipeline ?? null,
        projection: Number.isFinite(layer.projection?.[promptIndex])
          ? layer.projection[promptIndex]
          : selected[index]?.projection ?? null,
        dim: Number.isFinite(layer.dim?.[promptIndex])
          ? layer.dim[promptIndex]
          : selected[index]?.dim ?? null,
      },
    })),
  };
}

async function getJson(url) {
  const isStaticApi = USE_STATIC_DATA && url.startsWith("/api/");
  const response = await fetch(isStaticApi ? staticDataUrl(url) : url);
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  if (isStaticApi) {
    const apiUrl = new URL(url, window.location.origin);
    if (apiUrl.pathname === "/api/ridgeline") {
      return materializeStaticRidgeline(payload, Number(apiUrl.searchParams.get("promptIndex") || 0));
    }
  }
  return payload;
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function fillSelect(select, items, getValue, getLabel) {
  select.replaceChildren(...items.map((item) => option(getValue(item), getLabel(item))));
}

function firstSentence(text) {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : text;
}

function initExpandableCopy() {
  for (const paragraph of document.querySelectorAll("#intuitionSection .section-heading > p:not(.eyebrow), #mechanismSection .section-heading > p:not(.eyebrow)")) {
    const fullText = paragraph.textContent.trim().replace(/\s+/g, " ");
    const intro = firstSentence(fullText);
    if (!fullText || intro.length >= fullText.length) continue;

    const textNode = document.createElement("span");
    const button = document.createElement("button");
    button.className = "copy-toggle";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Expand section text");
    button.textContent = "↓";

    function setExpanded(expanded) {
      textNode.textContent = expanded ? fullText : `${intro}...`;
      button.textContent = expanded ? "↑" : "↓";
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-label", expanded ? "Collapse section text" : "Expand section text");
    }

    button.addEventListener("click", () => {
      setExpanded(button.getAttribute("aria-expanded") !== "true");
    });
    paragraph.replaceChildren(textNode, " ", button);
    setExpanded(false);
  }
}

function clampText(text, max = 1800) {
  if (!text) return "No completion available for this prompt/margin.";
  return text.length > max ? `${text.slice(0, max)}\n\n[truncated]` : text;
}

function missingCompletionText(method) {
  const info = state.tokenScore?.completionFiles?.[method];
  if (!info) return "No completion metadata available for this method.";
  return `No exact ${method} completion found for layers ${info.layers}, margin ${info.margin}.`;
}

function renderTokenStrip(container, text, tokenIndex, klass) {
  container.className = "token-strip";
  container.replaceChildren();
  if (!text) {
    const labels = { clea: "CLE-A", clep: "CLE-P", dim: "DiM" };
    container.textContent = missingCompletionText(labels[klass] || klass);
    return;
  }
  const tokens = text.trim().split(/\s+/).slice(0, 100);
  const activeIndex = Math.max(0, Math.min(tokens.length - 1, tokenIndex - 1));
  tokens.forEach((token, index) => {
    const span = document.createElement("span");
    span.className = `token-strip-token ${index === activeIndex ? `active ${klass}` : ""}`;
    span.textContent = `${token}${index === tokens.length - 1 ? "" : " "}`;
    container.append(span);
    if (index === activeIndex) {
      requestAnimationFrame(() => {
        container.scrollLeft = Math.max(
          0,
          span.offsetLeft - (container.clientWidth / 2) + (span.offsetWidth / 2),
        );
      });
    }
  });
}

function currentModelRuns(model = els.model.value) {
  return state.manifest.runs.filter((run) => run.model === model);
}

function currentModelRidges(model = els.model.value) {
  return state.manifest.ridgelines.filter((ridge) => ridge.model === model);
}

function currentModelConfigs(model = els.model.value) {
  return currentModelRidges(model)
    .map((ridge) => {
      const layers = ridge.pipelineLayers || ridge.projectionLayers;
      if (!layers) return null;
      const cleaMargin = ridge.pipelineMargin || null;
      const clepMargin = ridge.projectionMargin || null;
      return {
        id: ridge.id,
        model: ridge.model,
        layers,
        cleaMargin,
        clepMargin,
        marginKey: `clea:${cleaMargin || "none"}|clep:${clepMargin || "none"}`,
        marginLabel: `CLE-A ${cleaMargin || "n/a"} · CLE-P ${clepMargin || "n/a"}`,
        ridge,
      };
    })
    .filter(Boolean);
}

function selectedConfig() {
  return currentModelConfigs().find((config) =>
    config.layers === els.layers.value &&
    config.marginKey === els.margin.value
  ) || null;
}

function promptRunForConfig(config) {
  if (!config) return null;
  const runs = currentModelRuns(config.model);
  return runs.find((run) => run.method === "cle-a" && run.layers === config.layers && run.margin === config.cleaMargin)
    || runs.find((run) => run.method === "cle-p" && run.layers === config.layers && run.margin === config.clepMargin)
    || runs.find((run) => run.layers === config.layers)
    || runs[0]
    || null;
}

function selectedRun() {
  return promptRunForConfig(selectedConfig());
}

function selectedRuns() {
  const config = selectedConfig();
  if (!config) return [];
  return currentModelRuns().filter((run) =>
    run.layers === config.layers &&
    (
      (run.method === "cle-a" && run.margin === config.cleaMargin) ||
      (run.method === "cle-p" && run.margin === config.clepMargin)
    )
  );
}

function selectedRidge() {
  return selectedConfig()?.ridge || null;
}

function selectedPrompt() {
  return state.prompts[Number(els.prompt.value)] || null;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a).localeCompare(String(b));
  });
}

function refreshLayerChoices() {
  const configs = currentModelConfigs();
  const previous = els.layers.value;
  const layers = uniqueSorted(configs.map((config) => config.layers));
  fillSelect(els.layers, layers, (value) => value, (value) => value);
  if (layers.includes(previous)) els.layers.value = previous;
  refreshMarginChoices();
}

function refreshMarginChoices() {
  const configs = currentModelConfigs().filter((config) => config.layers === els.layers.value);
  const previous = els.margin.value;
  const margins = configs.sort((a, b) => a.marginLabel.localeCompare(b.marginLabel));
  fillSelect(els.margin, margins, (config) => config.marginKey, (config) => config.marginLabel);
  if (margins.some((config) => config.marginKey === previous)) els.margin.value = previous;
}

async function loadPrompts() {
  const run = selectedRun();
  if (!run) {
    state.prompts = [];
    els.prompt.replaceChildren();
    return;
  }
  const previousPrompt = els.prompt.value;
  const data = await getJson(`/api/prompts?file=${encodeURIComponent(run.file)}`);
  state.prompts = data.prompts;
  fillSelect(
    els.prompt,
    state.prompts,
    (prompt) => String(prompt.index),
    (prompt) => `${String(prompt.index).padStart(3, "0")} · ${prompt.prompt.slice(0, 92)}`,
  );
  if (state.prompts.some((prompt) => String(prompt.index) === previousPrompt)) {
    els.prompt.value = previousPrompt;
  }
}

async function loadRidge() {
  const ridge = selectedRidge();
  if (!ridge) {
    state.ridge = null;
    return;
  }
  const promptIndex = Number(els.prompt.value || 0);
  state.ridge = await getJson(`/api/ridgeline?file=${encodeURIComponent(ridge.file)}&promptIndex=${promptIndex}`);
  refreshLayerJump();
}

function refreshLayerJump() {
  const layers = state.ridge?.layers || [];
  if (!els.layerJump) return;
  const previous = els.layerJump.value;
  fillSelect(
    els.layerJump,
    layers,
    (layer) => String(layer.layer),
    (layer) => `Layer ${layer.layer}`,
  );
  if (layers.some((layer) => String(layer.layer) === previous)) {
    els.layerJump.value = previous;
  }
}

function scrollToLayer(layerId) {
  const target = document.getElementById(`layer-${layerId}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function density(values, min, max, bins = 42) {
  const counts = new Array(bins).fill(0);
  const width = max - min || 1;
  for (const value of values) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(((value - min) / width) * bins)));
    counts[index] += 1;
  }
  const peak = Math.max(1, ...counts);
  return counts.map((count, index) => ({
    x: min + ((index + .5) / bins) * width,
    y: count / peak,
  }));
}

function drawDistribution(canvas, layer, options = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);

  const w = rect.width;
  const h = rect.height;
  const pad = { left: 48, right: 22, top: 72, bottom: 42 };
  const selectedValues = Object.values(layer.selected || {}).filter((value) => value !== null && Number.isFinite(value));
  const allValues = [...layer.harmful, ...layer.harmless, ...layer.pipeline, ...layer.projection, ...layer.dim, ...selectedValues];
  const min = percentile(allValues, .01);
  const max = percentile(allValues, .99);
  const xScale = (value) => {
    const raw = pad.left + ((value - min) / ((max - min) || 1)) * (w - pad.left - pad.right);
    return Math.min(w - pad.right - 8, Math.max(pad.left + 8, raw));
  };
  const yBase = h - pad.bottom;
  const yScale = (value) => yBase - value * (h - pad.top - pad.bottom) * .78;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#ded8cc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, yBase);
  ctx.lineTo(w - pad.right, yBase);
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = "#6f6b63";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("harmful ← PC1 → harmless", pad.left + (w - pad.left - pad.right) / 2, h - 12);
  ctx.restore();

  function drawArea(values, color, alpha) {
    const points = density(values, min, max);
    ctx.beginPath();
    ctx.moveTo(xScale(points[0].x), yBase);
    for (const point of points) ctx.lineTo(xScale(point.x), yScale(point.y));
    ctx.lineTo(xScale(points[points.length - 1].x), yBase);
    ctx.closePath();
    ctx.fillStyle = color.replace("1)", `${alpha})`);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawArea(layer.harmful, "rgba(185, 74, 72, 1)", .22);
  drawArea(layer.harmless, "rgba(134, 191, 230, 1)", .34);

  const config = options.config || selectedConfig();
  const visibleMethods = options.visibleMethods || state.visibleMethods;
  const showClea = Boolean(config?.cleaMargin);
  const showClep = Boolean(config?.clepMargin);
  const markers = [
    {
      key: "dim",
      enabled: visibleMethods.has("dim"),
      value: layer.selected.dim,
      color: "#d28b26",
      label: "DiM",
      heightRatio: 0.66,
      lane: 2,
    },
    {
      key: "pipeline",
      enabled: visibleMethods.has("pipeline") && showClea,
      value: layer.selected.pipeline,
      color: "#6f5fb8",
      label: "CLE-A",
      heightRatio: 0.84,
      lane: 0,
    },
    {
      key: "projection",
      enabled: visibleMethods.has("projection") && showClep,
      value: layer.selected.projection,
      color: "#2f9f75",
      label: "CLE-P",
      heightRatio: 0.76,
      lane: 1,
    },
  ].filter((marker) => marker.enabled && marker.value !== null && Number.isFinite(marker.value));

  const markerGroups = [];
  for (const marker of markers) {
    const x = xScale(marker.value);
    const group = markerGroups.find((candidate) => Math.abs(candidate.x - x) < 18);
    if (group) group.items.push({ ...marker, baseX: x });
    else markerGroups.push({ x, items: [{ ...marker, baseX: x }] });
  }
  for (const group of markerGroups) {
    const offsets = group.items.length === 1 ? [0] : group.items.length === 2 ? [-14, 14] : [-20, 0, 20];
    group.items.forEach((marker, index) => drawMarker(marker, offsets[index]));
  }

  function drawMarker(marker, offsetX) {
    const x = Math.min(w - pad.right - 18, Math.max(pad.left + 18, marker.baseX + offsetX));
    const { color, label, heightRatio } = marker;
    const top = yBase - (h - pad.top - pad.bottom) * heightRatio;
    const pinTop = Math.max(pad.top + 18, Math.min(yBase - 30, top));
    const badgeY = 10 + marker.lane * 22;
    const badgeWidth = label === "CLE-A" || label === "CLE-P" ? 56 : 44;
    const badgeX = Math.min(w - pad.right - badgeWidth, Math.max(pad.left, x - badgeWidth / 2));
    const badgeCenterX = badgeX + badgeWidth / 2;
    ctx.save();

    ctx.strokeStyle = "rgba(32, 32, 32, .24)";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(badgeCenterX, badgeY + 22);
    ctx.lineTo(x, pinTop);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, yBase + 3);
    ctx.lineTo(x, pinTop);
    ctx.stroke();
    if (Math.abs(offsetX) > 0) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(32, 32, 32, .28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(marker.baseX, yBase + 4);
      ctx.lineTo(x, pinTop);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, pinTop, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, pinTop, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, .97)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, 20, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(badgeCenterX - 5, badgeY + 20);
    ctx.lineTo(badgeCenterX + 5, badgeY + 20);
    ctx.lineTo(badgeCenterX, badgeY + 26);
    ctx.closePath();
    ctx.fill();

    ctx.font = "900 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, badgeCenterX, badgeY + 15);
    ctx.restore();
  }
}

function jitter(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function evasionBoundaryStepIndex(start, normal, scale) {
  const boundaryAnchor = state.evasion?.pcaBasis?.probe?.boundaryAnchor;
  if (!boundaryAnchor || !Number.isFinite(scale) || scale <= 0) return -1;
  const startSignedDistance = (
    (start.x - boundaryAnchor.x) * normal[0]
    + (start.y - boundaryAnchor.y) * normal[1]
  );
  const boundaryMargin = -startSignedDistance / scale;
  let boundaryStepIndex = -1;
  let boundaryStepDistance = Infinity;
  state.evasion.margins.map(Number).forEach((candidate, index) => {
    const distance = Math.abs(candidate - boundaryMargin);
    if (Number.isFinite(candidate) && distance < boundaryStepDistance) {
      boundaryStepDistance = distance;
      boundaryStepIndex = index;
    }
  });
  return boundaryStepIndex;
}

function currentEvasionBoundaryIndex() {
  if (!state.evasion?.pcaBasis) return Math.round(Math.max(1, (state.evasion?.margins?.length || 1) - 1) / 2);
  const basis = state.evasion.pcaBasis;
  const promptIndex = Number(els.evasionPrompt.value || 0);
  const initial = basis.promptInitial?.find((p) => Number(p.index) === promptIndex);
  const normal = basis.probe?.complianceNormalPca;
  if (!initial || !normal) return Math.round(Math.max(1, state.evasion.margins.length - 1) / 2);

  const harmlessPoints = basis.background?.harmless || [];
  const harmlessCentroid = harmlessPoints.length
    ? {
        x: harmlessPoints.reduce((sum, p) => sum + p.x, 0) / harmlessPoints.length,
        y: harmlessPoints.reduce((sum, p) => sum + p.y, 0) / harmlessPoints.length,
      }
    : null;
  const bestMargin = Number(state.evasion.bestMargin);
  let scale = 2.2;
  if (Number.isFinite(bestMargin) && bestMargin > 0 && harmlessCentroid) {
    const toHarmless = { x: harmlessCentroid.x - initial.x, y: harmlessCentroid.y - initial.y };
    const alongNormal = toHarmless.x * normal[0] + toHarmless.y * normal[1];
    scale = Math.max(0.4, alongNormal / bestMargin);
  }
  const computedIndex = evasionBoundaryStepIndex(initial, normal, scale);
  return computedIndex >= 0 ? computedIndex : Math.round(Math.max(1, state.evasion.margins.length - 1) / 2);
}

function compassPercentForIndex(index, boundaryIndex, maxIndex) {
  if (maxIndex <= 0) return 0;
  if (index <= boundaryIndex) {
    return boundaryIndex <= 0 ? 50 : (index / boundaryIndex) * 50;
  }
  return boundaryIndex >= maxIndex
    ? 50
    : 50 + ((index - boundaryIndex) / (maxIndex - boundaryIndex)) * 50;
}

function compassIndexFromPercent(percent, boundaryIndex, maxIndex) {
  if (maxIndex <= 0) return 0;
  if (percent <= 50) {
    return Math.round(boundaryIndex <= 0 ? 0 : (percent / 50) * boundaryIndex);
  }
  return Math.round(boundaryIndex >= maxIndex
    ? maxIndex
    : boundaryIndex + ((percent - 50) / 50) * (maxIndex - boundaryIndex));
}

function drawEvasionCanvas() {
  if (!state.evasion || !els.evasionCanvas) return;
  const canvas = els.evasionCanvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);

  const w = rect.width;
  const h = rect.height;
  const pad = { left: 52, right: 28, top: 34, bottom: 44 };
  const promptIndex = Number(els.evasionPrompt.value || 0);
  const margin = state.evasion.margins[Number(els.evasionMargin.value || 0)];
  const position = state.evasion.positions[margin]?.[String(promptIndex)];
  const basis = state.evasion.pcaBasis;
  const initial = basis?.promptInitial?.find((p) => Number(p.index) === promptIndex);

  const xLimits = basis?.limits?.x || (() => {
    const values = [
      ...state.evasion.background.harmful.map((p) => p.x),
      ...state.evasion.background.harmless.map((p) => p.x),
      ...Object.values(state.evasion.positions).flatMap((byPrompt) => Object.values(byPrompt)),
    ].filter(Number.isFinite);
    return [percentile(values, .01), percentile(values, .99)];
  })();
  const yLimits = basis?.limits?.y || [0, 1];
  const xScale = (value) => pad.left + ((value - xLimits[0]) / ((xLimits[1] - xLimits[0]) || 1)) * (w - pad.left - pad.right);
  const yScale = (value) => pad.top + (1 - ((value - yLimits[0]) / ((yLimits[1] - yLimits[0]) || 1))) * (h - pad.top - pad.bottom);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(pad.left, 0, w - pad.right, 0);
  gradient.addColorStop(0, "rgba(185, 74, 72, 0.62)");
  gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.78)");
  gradient.addColorStop(0.52, "rgba(255, 255, 255, 0.78)");
  gradient.addColorStop(1, "rgba(47, 115, 183, 0.62)");
  ctx.fillStyle = gradient;
  ctx.fillRect(pad.left, pad.top, w - pad.left - pad.right, h - pad.top - pad.bottom);

  function withPlotClip(draw) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, w - pad.left - pad.right, h - pad.top - pad.bottom);
    ctx.clip();
    draw();
    ctx.restore();
  }

  ctx.strokeStyle = "#ded8cc";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (i / 4) * (h - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  function pointCloud(points, color, baseY, label) {
    ctx.fillStyle = color;
    for (const point of points) {
      const x = xScale(point.x);
      const yValue = Number.isFinite(point.y) ? point.y : baseY + (jitter((point.promptIndex ?? 0) + point.x * 1000) - .5) * .22;
      const y = yScale(yValue);
      ctx.globalAlpha = .34;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const harmfulPoints = basis?.background?.harmful || state.evasion.background.harmful;
  const harmlessPoints = basis?.background?.harmless || state.evasion.background.harmless;
  withPlotClip(() => {
    pointCloud(harmfulPoints, "#b94a48", .28, "harmful train");
    pointCloud(harmlessPoints, "#2f73b7", .72, "harmless train");
  });

  function centroid(points) {
    if (!points.length) return null;
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  }

  const harmfulCentroid = centroid(harmfulPoints);
  const harmlessCentroid = centroid(harmlessPoints);

  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillStyle = "#8d2634";
  ctx.fillText("harmful train", pad.left + 8, pad.top + 18);
  ctx.fillStyle = "#1f5e9a";
  ctx.textAlign = "right";
  ctx.fillText("harmless train", w - pad.right - 8, pad.top + 18);
  ctx.textAlign = "left";

  const boundary = basis?.probe?.boundary;
  function drawBoundaryStopLabel(anchorX, anchorY, boundaryStart = null, boundaryEnd = null) {
    const label = "prior work stops here";
    const targetY = h - pad.bottom - 18;
    let pointX = Math.min(w - pad.right - 8, Math.max(pad.left + 8, anchorX));
    let pointY = targetY + 5;
    if (boundaryStart && boundaryEnd && Math.abs(boundaryEnd.y - boundaryStart.y) > 1e-6) {
      const t = Math.min(1, Math.max(0, (pointY - boundaryStart.y) / (boundaryEnd.y - boundaryStart.y)));
      pointX = boundaryStart.x + t * (boundaryEnd.x - boundaryStart.x);
      pointY = boundaryStart.y + t * (boundaryEnd.y - boundaryStart.y);
    }
    const labelX = Math.min(w - 152, Math.max(pad.left + 8, pointX + 86));
    const labelY = pointY - 5;
    ctx.save();
    ctx.strokeStyle = "#333";
    ctx.fillStyle = "rgba(255, 255, 255, .86)";
    ctx.lineWidth = 1;
    const textWidth = ctx.measureText(label).width;
    ctx.beginPath();
    ctx.roundRect(labelX - 8, labelY - 17, textWidth + 16, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.fillText(label, labelX, labelY);
    const connectorStartX = pointX < labelX ? labelX - 8 : labelX + textWidth + 8;
    const connectorStartY = labelY + 5;
    ctx.beginPath();
    ctx.moveTo(connectorStartX, connectorStartY);
    ctx.lineTo(pointX, pointY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pointX, pointY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawBoundaryTopLabel(anchorX) {
    ctx.save();
    ctx.fillStyle = "#333";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("probe boundary", Math.min(w - pad.right - 72, Math.max(pad.left + 72, anchorX)), pad.top + 18);
    ctx.restore();
  }

  if (boundary) {
    withPlotClip(() => {
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(xScale(boundary.p0.x), yScale(boundary.p0.y));
      ctx.lineTo(xScale(boundary.p1.x), yScale(boundary.p1.y));
      ctx.stroke();
    });
    ctx.fillStyle = "#333";
    ctx.font = "700 12px system-ui, sans-serif";
    const bx = xScale(basis.probe.boundaryAnchor.x);
    const by = yScale(basis.probe.boundaryAnchor.y);
    const boundaryStart = { x: xScale(boundary.p0.x), y: yScale(boundary.p0.y) };
    const boundaryEnd = { x: xScale(boundary.p1.x), y: yScale(boundary.p1.y) };
    drawBoundaryTopLabel(bx);
    drawBoundaryStopLabel(bx, by, boundaryStart, boundaryEnd);
  } else {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xScale(0), pad.top);
    ctx.lineTo(xScale(0), h - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "700 12px system-ui, sans-serif";
    drawBoundaryTopLabel(xScale(0));
    drawBoundaryStopLabel(xScale(0), pad.top + 58);
  }

  if (Number.isFinite(position) || initial) {
    let start = initial ? { x: initial.x, y: initial.y } : { x: position, y: (yLimits[0] + yLimits[1]) / 2 };
    let point = start;
    if (basis?.probe?.complianceNormalPca) {
      const bestMargin = Number(state.evasion.bestMargin);
      const currentMargin = Number(margin);
      const selectedMarginIndex = Number(els.evasionMargin.value || 0);
      const normal = basis.probe.complianceNormalPca;
      let scale = 2.2;
      if (Number.isFinite(bestMargin) && bestMargin > 0 && harmlessCentroid) {
        const toHarmless = {
          x: harmlessCentroid.x - start.x,
          y: harmlessCentroid.y - start.y,
        };
        const alongNormal = toHarmless.x * normal[0] + toHarmless.y * normal[1];
        scale = Math.max(0.4, alongNormal / bestMargin);
      }
      let effectiveMargin = currentMargin;
      const boundaryStepIndex = evasionBoundaryStepIndex(start, normal, scale);
      if (selectedMarginIndex === boundaryStepIndex) {
        const boundaryAnchor = basis.probe?.boundaryAnchor;
        const startSignedDistance = (
          (start.x - boundaryAnchor.x) * normal[0]
          + (start.y - boundaryAnchor.y) * normal[1]
        );
        effectiveMargin = -startSignedDistance / scale;
      }
      point = {
        x: start.x + normal[0] * effectiveMargin * scale,
        y: start.y + normal[1] * effectiveMargin * scale,
      };
    }
    const x = xScale(point.x);
    const y = yScale(point.y);
    const sx = xScale(start.x);
    const sy = yScale(start.y);
    withPlotClip(() => {
      ctx.strokeStyle = "#6f5fb8";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6f5fb8";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.fillStyle = "#6f6b63";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PC1", pad.left + (w - pad.left - pad.right) / 2, h - 14);
  ctx.save();
  ctx.translate(16, pad.top + (h - pad.top - pad.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("PC2", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";
}

function eventToCanvasPoint(event) {
  const rect = els.evasionCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function setMarginFromCanvasEvent(event) {
  if (!state.evasion?.pcaBasis) return;
  const basis = state.evasion.pcaBasis;
  const promptIndex = Number(els.evasionPrompt.value || 0);
  const initial = basis.promptInitial?.find((p) => Number(p.index) === promptIndex);
  if (!initial || !basis.probe?.complianceNormalPca) return;

  const canvasPoint = eventToCanvasPoint(event);
  const pad = { left: 52, right: 28, top: 34, bottom: 44 };
  const xLimits = basis.limits.x;
  const yLimits = basis.limits.y;
  const plotW = canvasPoint.width - pad.left - pad.right;
  const plotH = canvasPoint.height - pad.top - pad.bottom;
  const px = xLimits[0] + ((canvasPoint.x - pad.left) / Math.max(1, plotW)) * (xLimits[1] - xLimits[0]);
  const py = yLimits[0] + (1 - ((canvasPoint.y - pad.top) / Math.max(1, plotH))) * (yLimits[1] - yLimits[0]);

  const normal = basis.probe.complianceNormalPca;
  const harmlessPoints = basis.background?.harmless || [];
  const harmlessCentroid = harmlessPoints.length
    ? {
        x: harmlessPoints.reduce((sum, p) => sum + p.x, 0) / harmlessPoints.length,
        y: harmlessPoints.reduce((sum, p) => sum + p.y, 0) / harmlessPoints.length,
      }
    : null;
  const bestMargin = Number(state.evasion.bestMargin);
  let scale = 2.2;
  if (Number.isFinite(bestMargin) && bestMargin > 0 && harmlessCentroid) {
    const toHarmless = { x: harmlessCentroid.x - initial.x, y: harmlessCentroid.y - initial.y };
    const alongNormal = toHarmless.x * normal[0] + toHarmless.y * normal[1];
    scale = Math.max(0.4, alongNormal / bestMargin);
  }

  const fromStart = { x: px - initial.x, y: py - initial.y };
  const marginEstimate = (fromStart.x * normal[0] + fromStart.y * normal[1]) / Math.max(scale, 1e-6);
  const margins = state.evasion.margins.map(Number);
  let bestIndex = 0;
  let bestDistance = Infinity;
  margins.forEach((m, index) => {
    const distance = Math.abs(m - marginEstimate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  els.evasionMargin.value = String(bestIndex);
  updateEvasionDemo();
}

function setMarginFromCompassEvent(event) {
  if (!state.evasion || !els.regionCompassTrack) return;
  const rect = els.regionCompassTrack.getBoundingClientRect();
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100));
  const maxIndex = Math.max(0, state.evasion.margins.length - 1);
  const boundaryIndex = currentEvasionBoundaryIndex();
  const nextIndex = Math.max(0, Math.min(maxIndex, compassIndexFromPercent(percent, boundaryIndex, maxIndex)));
  els.evasionMargin.value = String(nextIndex);
  updateEvasionDemo();
}

function updateRegionCompass() {
  if (!state.evasion || !els.regionCompassMarker || !els.regionBoundaryTick) return;
  const maxIndex = Math.max(1, state.evasion.margins.length - 1);
  const currentIndex = Number(els.evasionMargin.value || 0);
  const boundaryIndex = currentEvasionBoundaryIndex();
  const currentPercent = Math.max(0, Math.min(100, compassPercentForIndex(currentIndex, boundaryIndex, maxIndex)));
  els.regionCompassMarker.style.left = `${currentPercent}%`;
  els.regionBoundaryTick.style.left = "50%";
}

function updateEvasionDemo() {
  if (!state.evasion) return;
  const margin = state.evasion.margins[Number(els.evasionMargin.value || 0)];
  const promptIndex = String(Number(els.evasionPrompt.value || 0));
  const prompt = state.evasion.prompts.find((p) => String(p.index) === promptIndex);
  els.evasionPlotPrompt.textContent = prompt?.prompt || "No prompt selected.";
  els.evasionCompletion.textContent = clampText(state.evasion.completions[margin]?.[promptIndex]?.response);
  updateRegionCompass();
  drawEvasionCanvas();
}

function methodColor(method) {
  if (method === "CLE-P") return "#2f9f75";
  if (method === "CLE-A") return "#6f5fb8";
  if (method === "DiM") return "#d28b26";
  return "#8f8a80";
}

function tokenRun(method) {
  const promptIndex = Number(els.tokenPrompt.value || 0);
  return state.tokenScore?.runs?.[method]?.find((run) => Number(run.promptIdx) === promptIndex) || null;
}

function drawTokenCanvas() {
  if (!state.tokenScore || !els.tokenCanvas) return;
  const canvas = els.tokenCanvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);

  const w = rect.width;
  const h = rect.height;
  const pad = { left: 54, right: 28, top: 28, bottom: 42 };
  const methods = ["CLE-P", "CLE-A", "DiM"].filter((method) => tokenRun(method));
  const tokenIndex = Number(els.tokenSlider.value || 0);
  const maxStep = Math.min(TOKEN_SCORE_MAX_STEPS, Math.max(1, ...methods.map((method) => tokenRun(method).scores.length - 1)));
  const xScale = (index) => pad.left + (index / maxStep) * (w - pad.left - pad.right);
  const yScale = (value) => pad.top + (1 - value) * (h - pad.top - pad.bottom);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#ded8cc";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (i / 4) * (h - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  const refs = state.tokenScore.trainingReference || {};
  function refLine(value, color, label) {
    if (!Number.isFinite(value)) return;
    const y = yScale(value);
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(label, pad.left + 8, y - 6);
  }

  refLine(Number(refs.harmful_mean), "#b94a48", "harmful train mean");
  refLine(Number(refs.harmless_mean), "#2f73b7", "harmless train mean");
  refLine(0.5, "#6f6b63", "probe threshold");

  for (const method of methods) {
    const run = tokenRun(method);
    const scores = run.scores.slice(0, Math.min(run.scores.length, maxStep + 1));
    ctx.strokeStyle = methodColor(method);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    scores.forEach((score, index) => {
      const x = xScale(index);
      const y = yScale(score);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const current = Math.min(tokenIndex, scores.length - 1);
    ctx.fillStyle = methodColor(method);
    ctx.beginPath();
    ctx.arc(xScale(current), yScale(scores[current]), 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#202020";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xScale(tokenIndex), pad.top);
  ctx.lineTo(xScale(tokenIndex), h - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#6f6b63";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("generated-token position", pad.left + (w - pad.left - pad.right) / 2, h - 12);
  ctx.save();
  ctx.translate(16, pad.top + (h - pad.top - pad.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("probe confidence toward compliance", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";

  let legendX = pad.left;
  for (const method of methods) {
    ctx.fillStyle = methodColor(method);
    ctx.beginPath();
    ctx.arc(legendX + 5, 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4d4942";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(method, legendX + 16, 18);
    legendX += 72;
  }
}

function updateTokenScoreView() {
  if (!state.tokenScore) return;
  const promptIndex = String(Number(els.tokenPrompt.value || 0));
  const prompt = state.tokenScore.prompts.find((item) => String(item.index) === promptIndex);
  els.tokenPromptText.textContent = prompt?.prompt || "No prompt selected.";

  const maxScores = Math.max(1, ...["CLE-P", "CLE-A", "DiM"].map((method) => tokenRun(method)?.scores.length || 0));
  const sliderMax = Math.min(TOKEN_SCORE_MAX_STEPS, Math.max(0, maxScores - 1));
  if (Number(els.tokenSlider.max) !== sliderMax) els.tokenSlider.max = String(sliderMax);
  if (els.tokenCompletionSlider && Number(els.tokenCompletionSlider.max) !== sliderMax) {
    els.tokenCompletionSlider.max = String(sliderMax);
  }
  if (Number(els.tokenSlider.value) > sliderMax) els.tokenSlider.value = String(sliderMax);
  if (els.tokenCompletionSlider && Number(els.tokenCompletionSlider.value) > sliderMax) {
    els.tokenCompletionSlider.value = String(sliderMax);
  }
  const tokenIndex = Number(els.tokenSlider.value || 0);
  const tokenLabel = tokenIndex === 0
    ? "Final prompt token"
    : `Generated token ${tokenIndex}`;
  els.tokenReadout.textContent = tokenLabel;
  if (els.tokenCompletionReadout) els.tokenCompletionReadout.textContent = tokenLabel;
  if (els.tokenCompletionSlider && els.tokenCompletionSlider.value !== els.tokenSlider.value) {
    els.tokenCompletionSlider.value = els.tokenSlider.value;
  }

  els.tokenValues.replaceChildren(...["CLE-P", "CLE-A", "DiM"].map((method) => {
    const run = tokenRun(method);
    const value = run?.scores?.[Math.min(tokenIndex, (run?.scores?.length || 1) - 1)];
    const item = document.createElement("div");
    item.className = "token-value";
    item.style.borderLeftColor = methodColor(method);
    const label = document.createElement("span");
    label.textContent = method;
    const score = document.createElement("strong");
    score.textContent = Number.isFinite(value) ? value.toFixed(3) : "n/a";
    item.append(label, score);
    return item;
  }));

  renderTokenStrip(
    els.tokenCompletionClea,
    state.tokenScore.completions?.["CLE-A"]?.[promptIndex],
    tokenIndex,
    "clea",
  );
  renderTokenStrip(
    els.tokenCompletionClep,
    state.tokenScore.completions?.["CLE-P"]?.[promptIndex],
    tokenIndex,
    "clep",
  );
  renderTokenStrip(
    els.tokenCompletionDim,
    state.tokenScore.completions?.["DiM"]?.[promptIndex],
    tokenIndex,
    "dim",
  );
  drawTokenCanvas();
}

async function loadTokenScoreRun() {
  const model = els.tokenModel.value || "llama2-7b";
  state.tokenScore = await getJson(`/api/token-score?model=${encodeURIComponent(model)}`);
  fillSelect(
    els.tokenPrompt,
    state.tokenScore.prompts,
    (prompt) => String(prompt.index),
    (prompt) => `${String(prompt.index).padStart(3, "0")} · ${prompt.prompt.slice(0, 86)}`,
  );
  if (state.tokenScore.prompts.some((prompt) => Number(prompt.index) === 8)) {
    els.tokenPrompt.value = "8";
  }
  els.tokenSlider.value = "0";
  if (els.tokenCompletionSlider) els.tokenCompletionSlider.value = "0";
  updateTokenScoreView();
}

async function loadTokenScoreOptions() {
  state.tokenManifest = await getJson("/api/token-score-models");
  fillSelect(
    els.tokenModel,
    state.tokenManifest.models,
    (model) => model.repoKey,
    (model) => model.displayName,
  );
  if (state.tokenManifest.models.some((model) => model.repoKey === "llama2-7b")) {
    els.tokenModel.value = "llama2-7b";
  }
  await loadTokenScoreRun();
}

async function loadEvasionDemo() {
  const selectedModel = els.evasionModel.value || "llama2-7b";
  state.evasion = await getJson(`/api/evasion-demo?model=${encodeURIComponent(selectedModel)}`);
  const initialPromptIds = new Set((state.evasion.pcaBasis?.promptInitial || []).map((prompt) => String(prompt.index)));
  const evasionPrompts = initialPromptIds.size
    ? state.evasion.prompts.filter((prompt) => initialPromptIds.has(String(prompt.index)))
    : state.evasion.prompts;
  state.evasion.prompts = evasionPrompts;
  fillSelect(
    els.evasionPrompt,
    evasionPrompts,
    (prompt) => String(prompt.index),
    (prompt) => `${String(prompt.index).padStart(3, "0")} · ${prompt.prompt.slice(0, 86)}`,
  );
  if (evasionPrompts.some((prompt) => Number(prompt.index) === 8)) {
    els.evasionPrompt.value = "8";
  }
  els.evasionMargin.min = "0";
  els.evasionMargin.max = String(Math.max(0, state.evasion.margins.length - 1));
  els.evasionMargin.step = "1";
  const defaultIndex = Math.max(0, state.evasion.margins.findIndex((margin) => margin === state.evasion.bestMargin));
  els.evasionMargin.value = String(defaultIndex);
  updateEvasionDemo();
}

async function loadEvasionModelOptions() {
  const data = await getJson("/api/evasion-demo-models");
  fillSelect(
    els.evasionModel,
    data.models,
    (model) => model.repoKey,
    (model) => model.displayName,
  );
  if (data.models.some((model) => model.repoKey === "llama2-7b")) els.evasionModel.value = "llama2-7b";
}

function selectedLayerDiveLayer() {
  const layers = state.layerDive.ridge?.layers || [];
  return layers[Number(els.layerDiveLayer?.value || 0)] || layers[0] || null;
}

function layerDiveConfigForModel(model) {
  const configs = currentModelConfigs(model).filter((config) => config.cleaMargin && config.clepMargin);
  return configs.find((config) => config.layers === "5to25")
    || configs.find((config) => config.ridge?.arditiLayer !== null && config.ridge?.arditiLayer !== undefined)
    || configs[0]
    || currentModelConfigs(model)[0]
    || null;
}

function preferredLayerDiveIndex(layers, config) {
  if (!layers.length) return 0;
  const preferred = config?.ridge?.arditiLayer;
  let index = layers.findIndex((layer) => Number(layer.layer) === Number(preferred));
  if (index >= 0) return index;
  index = layers.findIndex((layer) => Number(layer.layer) === 14);
  if (index >= 0) return index;
  return Math.floor(layers.length / 2);
}

async function loadLayerDivePrompts() {
  const config = state.layerDive.config;
  if (!config || !els.layerDivePrompt) {
    state.layerDive.prompts = [];
    els.layerDivePrompt?.replaceChildren();
    return;
  }
  const data = await getJson(`/api/evasion-demo?model=${encodeURIComponent(config.model)}`);
  state.layerDive.prompts = data.prompts;
  fillSelect(
    els.layerDivePrompt,
    state.layerDive.prompts,
    (prompt) => String(prompt.index),
    (prompt) => `${String(prompt.index).padStart(3, "0")} · ${prompt.prompt.slice(0, 86)}`,
  );
  const cigarettePrompt = state.layerDive.prompts.find((prompt) =>
    Number(prompt.index) === 8
    && /cigar+ettes|cigarettes/i.test(prompt.prompt)
  );
  const fallbackPrompt = state.layerDive.prompts.find((prompt) => /cigar+ettes|cigarettes/i.test(prompt.prompt));
  els.layerDivePrompt.value = String((cigarettePrompt || fallbackPrompt || state.layerDive.prompts[0])?.index || 0);
}

async function loadLayerDiveRidge({ preserveLayer = false } = {}) {
  const config = state.layerDive.config;
  if (!config || !els.layerDivePrompt) {
    state.layerDive.ridge = null;
    return;
  }
  const previousLayer = selectedLayerDiveLayer()?.layer;
  const promptIndex = Number(els.layerDivePrompt.value || 0);
  state.layerDive.ridge = await getJson(`/api/ridgeline?file=${encodeURIComponent(config.ridge.file)}&promptIndex=${promptIndex}`);
  const layers = state.layerDive.ridge.layers || [];
  els.layerDiveLayer.min = "0";
  els.layerDiveLayer.max = String(Math.max(0, layers.length - 1));
  els.layerDiveLayer.step = "1";
  const preservedIndex = preserveLayer
    ? layers.findIndex((layer) => Number(layer.layer) === Number(previousLayer))
    : -1;
  els.layerDiveLayer.value = String(preservedIndex >= 0 ? preservedIndex : preferredLayerDiveIndex(layers, config));
}

function renderLayerDive() {
  if (!state.layerDive.ridge || !els.layerDiveCanvas) return;
  const layer = selectedLayerDiveLayer();
  const prompt = state.layerDive.prompts.find((item) => String(item.index) === String(els.layerDivePrompt.value));
  if (!layer) return;
  els.layerDivePromptText.textContent = prompt?.prompt || "No prompt selected.";
  els.layerDiveLayerReadout.textContent = `Layer ${layer.layer}`;
  els.layerDiveChartTitle.textContent = `Layer ${layer.layer}`;
  drawDistribution(els.layerDiveCanvas, layer, {
    config: state.layerDive.config,
    visibleMethods: state.layerDive.visibleMethods,
  });
}

async function loadLayerDivePanel() {
  const model = els.layerDiveModel?.value || "llama2-7b";
  state.layerDive.config = layerDiveConfigForModel(model);
  await loadLayerDivePrompts();
  await loadLayerDiveRidge();
  renderLayerDive();
}

async function refreshLayerDivePrompt() {
  await loadLayerDiveRidge({ preserveLayer: true });
  renderLayerDive();
}

async function loadLayerDiveModelOptions() {
  if (!els.layerDiveModel) return;
  fillSelect(els.layerDiveModel, state.manifest.models, (model) => model, (model) => model);
  if (state.manifest.models.includes("llama2-7b")) els.layerDiveModel.value = "llama2-7b";
  await loadLayerDivePanel();
}

function render() {
  const prompt = selectedPrompt();
  els.promptTitle.textContent = prompt?.prompt || "No prompt selected";
  els.promptCategory.textContent = prompt?.category || "";

  const run = selectedRun();
  const ridge = selectedRidge();
  els.metadata.innerHTML = "";

  els.charts.replaceChildren();
  const layers = state.ridge?.layers || [];
  if (!layers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No visualization layers available.";
    els.charts.append(empty);
    return;
  }

  for (const layer of layers) {
    const card = document.createElement("article");
    card.className = "chart-card";
    card.id = `layer-${layer.layer}`;
    const title = document.createElement("h3");
    title.textContent = `Layer ${layer.layer}`;
    const canvas = document.createElement("canvas");
    card.append(title, canvas);
    els.charts.append(card);
    drawDistribution(canvas, layer);
  }
}

async function refreshData() {
  await loadPrompts();
  await loadRidge();
  render();
}

async function refreshPromptData() {
  await loadRidge();
  render();
}

async function init() {
  initExpandableCopy();
  for (const img of document.querySelectorAll(".author-card img")) {
    img.addEventListener("error", () => {
      const name = img.alt || "";
      const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#ded8cc"/><text x="100" y="112" text-anchor="middle" font-family="system-ui, sans-serif" font-size="48" font-weight="800" fill="#4d4942">${initials}</text></svg>`;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }, { once: true });
  }
  state.manifest = await getJson("/api/manifest");
  await loadEvasionModelOptions();
  await loadEvasionDemo();
  await loadTokenScoreOptions();
  await loadLayerDiveModelOptions();
  fillSelect(els.model, state.manifest.models, (model) => model, (model) => model);
  if (state.manifest.models.includes("llama2-7b")) {
    els.model.value = "llama2-7b";
  }
  refreshLayerChoices();
  await refreshData();

  els.backHome.addEventListener("click", () => {
    els.explorer.hidden = true;
    els.home.hidden = false;
  });
  els.model.addEventListener("change", async () => {
    refreshLayerChoices();
    await refreshData();
  });
  els.layers.addEventListener("change", async () => {
    refreshMarginChoices();
    await refreshData();
  });
  els.margin.addEventListener("change", async () => {
    await refreshData();
  });
  els.prompt.addEventListener("change", refreshPromptData);
  els.layerJump?.addEventListener("change", () => scrollToLayer(els.layerJump.value));
  els.methodPins.forEach((input) => {
    input.addEventListener("change", () => {
      state.visibleMethods = new Set(
        els.methodPins
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value),
      );
      render();
    });
  });
  els.layerDiveModel?.addEventListener("change", loadLayerDivePanel);
  els.layerDivePrompt?.addEventListener("change", refreshLayerDivePrompt);
  els.layerDiveLayer?.addEventListener("input", renderLayerDive);
  els.layerDiveMethodPins.forEach((input) => {
    input.addEventListener("change", () => {
      state.layerDive.visibleMethods = new Set(
        els.layerDiveMethodPins
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value),
      );
      renderLayerDive();
    });
  });
  els.evasionModel.addEventListener("change", loadEvasionDemo);
  els.evasionPrompt.addEventListener("change", updateEvasionDemo);
  els.evasionMargin.addEventListener("input", updateEvasionDemo);
  els.regionCompassTrack.addEventListener("pointerdown", (event) => {
    state.evasionCompassDrag = true;
    els.regionCompassTrack.setPointerCapture(event.pointerId);
    setMarginFromCompassEvent(event);
  });
  els.regionCompassTrack.addEventListener("pointermove", (event) => {
    if (state.evasionCompassDrag) setMarginFromCompassEvent(event);
  });
  els.regionCompassTrack.addEventListener("pointerup", (event) => {
    state.evasionCompassDrag = false;
    els.regionCompassTrack.releasePointerCapture(event.pointerId);
  });
  els.regionCompassTrack.addEventListener("pointercancel", () => {
    state.evasionCompassDrag = false;
  });
  els.evasionCanvas.addEventListener("pointerdown", (event) => {
    state.evasionDrag = true;
    els.evasionCanvas.setPointerCapture(event.pointerId);
    setMarginFromCanvasEvent(event);
  });
  els.evasionCanvas.addEventListener("pointermove", (event) => {
    if (state.evasionDrag) setMarginFromCanvasEvent(event);
  });
  els.evasionCanvas.addEventListener("pointerup", (event) => {
    state.evasionDrag = false;
    els.evasionCanvas.releasePointerCapture(event.pointerId);
  });
  els.evasionCanvas.addEventListener("pointercancel", () => {
    state.evasionDrag = false;
  });
  els.tokenModel.addEventListener("change", async () => {
    await loadTokenScoreRun();
  });
  els.tokenPrompt.addEventListener("change", () => {
    els.tokenSlider.value = "0";
    if (els.tokenCompletionSlider) els.tokenCompletionSlider.value = "0";
    updateTokenScoreView();
  });
  els.tokenSlider.addEventListener("input", updateTokenScoreView);
  els.tokenCompletionSlider.addEventListener("input", () => {
    els.tokenSlider.value = els.tokenCompletionSlider.value;
    updateTokenScoreView();
  });
  for (const button of document.querySelectorAll(".method-toggle")) {
    button.addEventListener("click", () => {
      const panel = button.closest(".method-panel");
      const expanded = !panel.classList.contains("expanded");
      panel.classList.toggle("expanded", expanded);
      button.setAttribute("aria-expanded", String(expanded));
    });
  }
  window.addEventListener("resize", render);
  window.addEventListener("resize", drawEvasionCanvas);
  window.addEventListener("resize", drawTokenCanvas);
  window.addEventListener("resize", renderLayerDive);
}

init().catch((error) => {
  els.charts.innerHTML = `<div class="empty">${error.message}</div>`;
});
