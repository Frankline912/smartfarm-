let farms = [], farm = null, crops = [];

async function init() {
  try {
    [farms, crops] = await Promise.all([api("/api/farms"), api("/api/advisory/crops")]);
    if (!farms.length) { 
      $("#plans").innerHTML = `<div class="empty">Add a farm first. <a href="farms.html?first=1">Add farm</a></div>`; 
      return; 
    }
    farm = await FarmStore.pick(farms);
    const picker = $("#farmPicker");
    if (picker) {
      picker.innerHTML = "";
      picker.appendChild(farmSelector(farms, farm.id, (id) => { 
        farm = farms.find((f) => f.id === id); 
        loadPlans(); 
      }));
    }
    
    const pre = new URLSearchParams(location.search).get("crop");
    const cropSel = $("#cropSel");
    if (cropSel && crops.length) {
      cropSel.innerHTML = crops.map((c) => option(c.key || c.name, `${c.icon || "🌱"} ${c.name} (${c.duration_days || 120} days)`, c.key === pre)).join("");
    }
    
    const form = $("#planForm");
    if (form) {
      if (form.elements.planting_date && fmt && fmt.today) {
        form.elements.planting_date.value = fmt.today();
      }
      form.addEventListener("submit", createPlan);
      if (form.elements.crop_key) form.elements.crop_key.addEventListener("change", preview);
      if (form.elements.planting_date) form.elements.planting_date.addEventListener("change", preview);
    }
    
    preview();
    loadPlans();
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

async function preview() {
  const el = $("#planForm")?.elements;
  if (!el || !el.planting_date || !el.planting_date.value || !el.crop_key) return;
  try {
    const d = await api(`/api/calendar/preview?crop_key=${el.crop_key.value}&planting_date=${el.planting_date.value}`);
    const previewEl = $("#preview");
    if (previewEl && d && d.activities) {
      previewEl.innerHTML = `<ul class="timeline">` + d.activities.map((a) => `<li><div class="when">Day ${a.day_offset} · ${fmt.date(a.due_date)}</div><div>${esc(a.title)}</div></li>`).join("") + `</ul>`;
    }
  } catch (e) {
    console.error("Preview error:", e);
  }
}

async function createPlan(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target).entries());
  if (farm) f.farm_id = farm.id;
  if (f.area_acres) f.area_acres = Number(f.area_acres);
  try {
    await api("/api/calendar/plans", { method: "POST", body: f });
    notice($("#formMsg"), "Crop plan created with its activity calendar.", "ok");
    loadPlans();
  } catch (err) { 
    notice($("#formMsg"), err.message); 
  }
}

async function loadPlans() {
  const box = $("#plans");
  if (!box || !farm) return;
  try {
    const plans = await api(`/api/calendar/plans?farm_id=${farm.id}`);
    if (!plans || !plans.length) { 
      box.innerHTML = `<div class="empty">No crop plans for ${esc(farm.name || farm.farm_name)} yet.</div>`; 
      return; 
    }
    const today = fmt && fmt.today ? fmt.today() : new Date().toISOString().split("T")[0];
    
    box.innerHTML = plans.map((p) => {
      const acts = p.activities || [];
      const done = acts.filter((a) => a.completed).length;
      const next = acts.find((a) => !a.completed);
      const pct = acts.length ? Math.round((done / acts.length) * 100) : 0;
      
      return `
      <div class="card" style="margin-bottom:14px;padding:16px" data-plan="${p.id}">
        <div class="card-head">
          <div><h3>${p.crop_icon || "🌱"} ${esc(p.crop_name)} <span class="badge ${p.status === "active" ? "success" : ""}">${esc(p.status || "active")}</span></h3></div>
          <div class="tiny">Planted ${fmt && fmt.date ? fmt.date(p.planting_date) : p.planting_date} · ${p.area_acres || 1} acres</div>
        </div>
        <div class="toolbar" style="margin:10px 0">
          <button class="btn secondary sm" data-irr="${p.id}">💧 Irrigation</button>
          ${p.status === "active" ? `<button class="btn secondary sm" data-status="${p.id}" data-val="harvested">Mark harvested</button>` : ""}
          <button class="btn danger sm" data-del="${p.id}">Delete</button>
        </div>
        <div class="score" style="margin-bottom:6px;background:#334155;height:6px;border-radius:3px;overflow:hidden;"><span style="display:block;width:${pct}%;height:100%;background:#22c55e;"></span></div>
        <div class="tiny" style="margin-bottom:10px">${done}/${acts.length} activities done${next ? ` · next: <strong>${esc(next.title)}</strong> on ${fmt && fmt.date ? fmt.date(next.due_date) : next.due_date}` : ""}</div>
        <div id="irr-${p.id}"></div>
        <details ${p.status === "active" ? "open" : ""}>
          <summary class="small" style="cursor:pointer;color:var(--primary)">Show schedule</summary>
          <ul class="timeline" style="margin-top:12px">
            ${acts.map((a) => `
              <li class="${a.completed ? "done" : a.due_date === today ? "today" : ""}">
                <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;margin:0;color:var(--text);font-weight:400">
                  <input type="checkbox" data-act="${a.id}" ${a.completed ? "checked" : ""} style="width:auto;margin-top:4px" />
                  <span>
                    <span class="when">Day ${a.day_offset} · ${fmt && fmt.date ? fmt.date(a.due_date) : a.due_date} ${a.due_date < today && !a.completed ? `<span class="badge danger">overdue</span>` : ""}</span><br />
                    <strong style="${a.completed ? "text-decoration:line-through;color:var(--text-3)" : ""}">${esc(a.title)}</strong>
                    <div class="small muted">${esc(a.description || "")}</div>
                  </span>
                </label>
              </li>`).join("")}
          </ul>
        </details>
      </div>`;
    }).join("");

    $$("input[data-act]").forEach((cb) => cb.addEventListener("change", async () => { 
      await api(`/api/calendar/activities/${cb.dataset.act}/toggle`, { method: "PATCH" }); 
      loadPlans(); 
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => { 
      if (confirm("Delete this crop plan?")) { 
        await api(`/api/calendar/plans/${b.dataset.del}`, { method: "DELETE" }); 
        loadPlans(); 
      } 
    }));
    $$("[data-status]").forEach((b) => b.addEventListener("click", async () => { 
      await api(`/api/calendar/plans/${b.dataset.status}`, { method: "PATCH", body: { status: b.dataset.val } }); 
      loadPlans(); 
    }));
    $$("[data-irr]").forEach((b) => b.addEventListener("click", () => irrigation(Number(b.dataset.irr))));
  } catch (e) {
    console.error("Error loading plans:", e);
  }
}

async function irrigation(planId) {
  const box = $(`#irr-${planId}`);
  if (!box) return;
  box.innerHTML = `
    <div class="card" style="padding:14px;margin-bottom:12px;background:var(--surface-2, #1e293b)">
      <div class="form-row" style="display:flex;gap:10px;margin-bottom:10px">
        <div class="field" style="flex:1"><label class="small">Soil moisture %</label><input type="number" min="0" max="100" id="sm-${planId}" placeholder="e.g. 35" style="width:100%" /></div>
        <div class="field" style="flex:1"><label class="small">Days since last irrigation</label><input type="number" min="0" id="li-${planId}" placeholder="e.g. 2" style="width:100%" /></div>
      </div>
      <button class="btn sm" id="irrGo-${planId}">Get irrigation advice</button>
      <div id="irrOut-${planId}" style="margin-top:10px"></div>
    </div>`;
  const run = async () => {
    const sm = $(`#sm-${planId}`)?.value;
    const li = $(`#li-${planId}`)?.value;
    const out = $(`#irrOut-${planId}`);
    if (!out) return;
    out.innerHTML = `<span class="muted">Checking weather…</span>`;
    try {
      const r = await api("/api/irrigation/advice", { method: "POST", body: { crop_plan_id: planId, soil_moisture_pct: sm ? Number(sm) : null, last_irrigation_days_ago: li ? Number(li) : null } });
      out.innerHTML = `<div class="alert ${r.recommend ? "warning" : "success"}" style="padding:10px;border-radius:6px;background:rgba(0,0,0,0.2)"><div class="body"><strong>${esc(r.message)}</strong>
        <div class="small">Stage: ${esc(r.stage)} (day ${r.days_since_planting}) · water need ≈ ${r.water_demand_mm} mm/day</div>
        <ul style="margin:6px 0 0;padding-left:18px" class="small">${(r.reasons || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>`;
    } catch (e) { out.innerHTML = `<span class="notice error" style="color:#ef4444">${esc(e.message)}</span>`; }
  };
  const btn = $(`#irrGo-${planId}`);
  if (btn) btn.addEventListener("click", run);
  run();
}

init().catch(console.error);