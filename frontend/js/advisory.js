let farms = [];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : "";

async function init() {
  const [opts, crops] = await Promise.all([api("/api/advisory/options"), api("/api/advisory/crops")]);
  farms = await api("/api/farms");
  
  $("#soilSel").innerHTML = opts.soil_types.map((s) => option(s, cap(s))).join("");
  $("#waterSel").innerHTML = opts.water_sources.map((s) => option(s, cap(s))).join("");
  
  // Handle season options supporting both object and string array formats
  $("#seasonSel").innerHTML = opts.seasons.map((s) => {
    const key = typeof s === "string" ? s : s.key;
    const name = typeof s === "string" ? s : s.name;
    const isCurrent = typeof s === "object" && key === opts.current_season;
    return option(key, name, isCurrent);
  }).join("");

  $("#farmSel").innerHTML = option("", "-- Select a farm or fill manually --") + 
    farms.map((f) => option(f.id, `${f.name || f.farm_name} · ${f.location_name || f.location}`, f.id === FarmStore.get())).join("");
  
  $("#farmSel").addEventListener("change", fillFromFarm);
  $("#advForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  
  $("#library").innerHTML = crops.map((c) => `
    <div class="card" style="padding:14px">
      <div style="font-size:28px">${c.icon || "🌱"}</div>
      <strong>${esc(c.name)}</strong>
      <div class="tiny">${esc(cap(c.category || "Crop"))} · ${c.duration_days || "N/A"} days · ${esc(c.water_need || c.water || "Moderate")} water</div>
      <a class="small" href="calendar.html?crop=${c.key || c.name}">Plan this crop →</a>
    </div>`).join("");
    
  fillFromFarm();
  if ($("#farmSel").value) run();
}

function fillFromFarm() {
  const id = Number($("#farmSel").value);
  const f = farms.find((x) => x.id === id);
  if (!f) return;
  const el = $("#advForm").elements;
  if (f.soil_type && el.soil_type) el.soil_type.value = f.soil_type;
  if (f.water_source && el.water_source) el.water_source.value = f.water_source;
  if (f.size_acres && el.farm_size_acres) el.farm_size_acres.value = f.size_acres;
}

async function run() {
  const el = $("#advForm").elements;
  const body = {
    soil_type: el.soil_type.value,
    season: el.season.value,
    water_source: el.water_source.value,
    farm_size_acres: el.farm_size_acres && el.farm_size_acres.value ? Number(el.farm_size_acres.value) : null,
    altitude_m: el.altitude_m && el.altitude_m.value ? Number(el.altitude_m.value) : null,
  };
  
  const out = $("#results");
  out.innerHTML = `<div class="empty">Thinking…</div>`;
  
  try {
    const d = await api("/api/advisory/recommend", { method: "POST", body });
    if ($("#ctx")) {
      $("#ctx").textContent = `${d.season_name || body.season} · ${cap(body.soil_type)} soil · ${cap(body.water_source)}`;
    }
    
    out.innerHTML = d.recommendations.map((r) => `
      <div class="crop-rec" style="display:flex;gap:12px;margin-bottom:12px;padding:12px;background:var(--card-bg, #1e293b);border-radius:8px;">
        <div class="ico" style="font-size:32px">${r.icon || "🌾"}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${esc(r.name)}</strong>
            <span class="badge ${r.score >= 80 ? "success" : r.score >= 60 ? "info" : "warning"}">${esc(r.suitability)} · ${r.score || ""}</span>
          </div>
          ${r.score ? `<div class="score" style="margin:6px 0;background:#334155;height:6px;border-radius:3px;overflow:hidden;"><span style="display:block;width:${r.score}%;height:100%;background:#22c55e;"></span></div>` : ""}
          <ul style="margin:6px 0 0 16px;padding:0;font-size:13px">
            ${(r.reasons || []).map((x) => `<li>✓ ${esc(x)}</li>`).join("")}
            ${(r.warnings || []).map((x) => `<li style="color:#f59e0b">⚠ ${esc(x)}</li>`).join("")}
          </ul>
          <a class="small" style="display:inline-block;margin-top:6px" href="calendar.html?crop=${r.key || r.name}">Plan ${esc(r.name)} →</a>
        </div>
      </div>`).join("");
  } catch (e) { 
    out.innerHTML = `<div class="empty" style="color:#ef4444">${esc(e.message)}</div>`; 
  }
}

init().catch(console.error);