let crops = [], symptoms = [], diseases = [];

async function init() {
  [crops, symptoms, diseases] = await Promise.all([api("/api/advisory/crops"), api("/api/diseases/symptoms"), api("/api/diseases")]);
  
  const cropSel = $("#cropSel");
  if (cropSel) cropSel.innerHTML = crops.map((c) => option(c.key, `${c.icon || "🌱"} ${c.name}`)).join("");
  
  const symBox = $("#symptoms");
  if (symBox) symBox.innerHTML = symptoms.map((s) => `<label style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-bottom:6px;"><input type="checkbox" name="symptoms" value="${s.key}" style="width:auto;" /> ${esc(s.label)}</label>`).join("");
  
  const libFilter = $("#libFilter");
  if (libFilter) {
    libFilter.innerHTML = option("", "All crops") + crops.map((c) => option(c.key, c.name)).join("");
    libFilter.addEventListener("change", renderLibrary);
  }
  
  const dxForm = $("#dxForm");
  if (dxForm) dxForm.addEventListener("submit", (e) => { e.preventDefault(); diagnose(); });
  
  renderLibrary();
}

async function diagnose() {
  const crop = $("#cropSel")?.value;
  const picked = $$("input[name=symptoms]:checked").map((c) => c.value);
  const out = $("#results");
  if (!out) return;
  
  if (!picked.length) { 
    out.innerHTML = `<div class="empty">Select at least one symptom.</div>`; 
    return; 
  }
  
  try {
    const d = await api("/api/diseases/diagnose", { method: "POST", body: { crop_key: crop, symptoms: picked } });
    const ctx = $("#ctx");
    if (ctx) ctx.textContent = `${d.crop} · ${d.symptoms.join(", ")}`;
    
    if (!d.results.length) { 
      out.innerHTML = `<div class="empty">No matching disease found for these symptoms. Try adding more symptoms or consult an extension officer.</div>`; 
      return; 
    }
    
    out.innerHTML = d.results.map((r, i) => `
      <div class="card" style="padding:16px;margin-bottom:12px;${i === 0 ? "border-color:var(--primary)" : ""}">
        <div class="card-head" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <h3>${i === 0 ? "⚠️ " : ""}${esc(r.name)} <span class="badge ${r.type === "pest" ? "warning" : r.type === "nutrient" ? "info" : "danger"}">${esc(r.type)}</span></h3>
          <span class="badge ${r.confidence >= 0.75 ? "success" : r.confidence >= 0.5 ? "info" : ""}">${Math.round(r.confidence * 100)}% match</span>
        </div>
        <p>${esc(r.description)}</p>
        <p class="small muted"><strong>Favourable conditions:</strong> ${esc(r.conditions)}</p>
        <p class="small muted"><strong>Matched symptoms:</strong> ${(r.matched_symptoms || []).map(esc).join(", ")}</p>
        <strong class="small">Recommended actions</strong>
        <ol class="small" style="margin:4px 0 0;padding-left:20px">${(r.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
      </div>`).join("");
  } catch (e) { 
    out.innerHTML = `<div class="empty" style="color:#ef4444">${esc(e.message)}</div>`; 
  }
}

function renderLibrary() {
  const libFilter = $("#libFilter");
  const libraryBox = $("#library");
  if (!libraryBox) return;
  
  const f = libFilter ? libFilter.value : "";
  const items = f ? diseases.filter((d) => d.crops && d.crops.includes(f)) : diseases;
  
  libraryBox.innerHTML = items.map((d) => `
    <div class="card" style="padding:14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>${esc(d.name)}</h3>
        <span class="badge ${d.type === "pest" ? "warning" : d.type === "nutrient" ? "info" : "danger"}">${esc(d.type)}</span>
      </div>
      <p class="small" style="margin:6px 0;">${esc(d.description)}</p>
      <p class="tiny muted">Affects: ${(d.crop_names || []).map(esc).join(", ")}</p>
      <details style="margin-top:8px;"><summary class="small" style="cursor:pointer;color:var(--primary)">What to do</summary>
        <ul class="small" style="padding-left:18px;margin:6px 0 0">${(d.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>
    </div>`).join("");
}

init().catch(console.error);