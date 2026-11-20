let options = { soil_types: [], water_sources: [] };

async function init() {
  if (new URLSearchParams(location.search).get("first")) $("#welcome").classList.remove("hidden");
  options = await api("/api/advisory/options");
  $("#soilSel").innerHTML = options.soil_types.map((s) => option(s, s[0].toUpperCase() + s.slice(1))).join("");
  $("#waterSel").innerHTML = options.water_sources.map((s) => option(s, s[0].toUpperCase() + s.slice(1))).join("");
  $("#addBtn").addEventListener("click", () => openModal());
  $("#cancelBtn").addEventListener("click", closeModal);
  $("#geoBtn").addEventListener("click", geocode);
  $("#farmForm").addEventListener("submit", save);
  await load();
  if (new URLSearchParams(location.search).get("first")) openModal();
}

async function load() {
  const farms = await api("/api/farms");
  const list = $("#farmList");
  if (!farms.length) { list.innerHTML = `<div class="empty" style="grid-column:1/-1">No farms yet. Click “Add farm” to create one.</div>`; return; }
  list.innerHTML = farms.map((f) => `
    <div class="card">
      <div class="card-head"><h2>${esc(f.name || f.farm_name)}</h2>${FarmStore.get() === f.id ? `<span class="badge success">Selected</span>` : ""}</div>
      <p class="muted">📍 ${esc(f.location_name || f.location)}</p>
      <p class="small">🌍 ${esc(f.soil_type || "N/A")} soil · 💧 ${esc(f.water_source || "N/A")} · 📐 ${f.size_acres || 0} acres</p>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn sm" data-select="${f.id}">Use this farm</button>
        <button class="btn secondary sm" data-edit="${f.id}">Edit</button>
        <button class="btn danger sm" data-del="${f.id}">Delete</button>
      </div>
    </div>`).join("");
  $$("[data-select]").forEach((b) => b.addEventListener("click", () => { FarmStore.set(Number(b.dataset.select)); location.href = "dashboard.html"; }));
  $$("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(farms.find((f) => f.id === Number(b.dataset.edit)))));
  $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this farm and all its crop plans, records and harvests?")) return;
    await api(`/api/farms/${b.dataset.del}`, { method: "DELETE" });
    load();
  }));
}

function openModal(farm) {
  const form = $("#farmForm");
  form.reset();
  $("#geoResults").innerHTML = "";
  $("#formMsg").classList.add("hidden");
  $("#modalTitle").textContent = farm ? "Edit farm" : "Add farm";
  if (farm) {
    for (const [k, v] of Object.entries(farm)) {
      if (form.elements[k]) form.elements[k].value = v;
    }
    // Map backend fallback names to form inputs if needed
    if (farm.farm_name && form.elements["name"] && !form.elements["name"].value) {
      form.elements["name"].value = farm.farm_name;
    }
    if (farm.location && form.elements["location_name"] && !form.elements["location_name"].value) {
      form.elements["location_name"].value = farm.location;
    }
  }
  $("#modal").classList.remove("hidden");
}

function closeModal() { $("#modal").classList.add("hidden"); }

async function geocode() {
  const q = $("#farmForm").elements.location_name.value.trim();
  const out = $("#geoResults");
  if (q.length < 2) return;
  out.textContent = "Searching…";
  try {
    const res = await api(`/api/farms/geocode?q=${encodeURIComponent(q)}`);
    if (!res.length) { out.textContent = "No locations found."; return; }
    out.innerHTML = res.map((r, i) => `<a href="#" data-i="${i}">${esc(r.name)}, ${esc(r.admin1 || "")} ${esc(r.country || "")}</a>`).join(" · ");
    $$("a[data-i]", out).forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const r = res[Number(a.dataset.i)];
      const f = $("#farmForm").elements;
      f.location_name.value = r.name;
      out.innerHTML = `<span class="muted">Selected ${esc(r.name)}</span>`;
    }));
  } catch (e) { out.textContent = e.message; }
}

async function save(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const f = Object.fromEntries(formData.entries());
  const id = f.id; 
  delete f.id;
  
  if (f.size_acres) f.size_acres = Number(f.size_acres);

  try {
    const saved = id ? await api(`/api/farms/${id}`, { method: "PATCH", body: f }) : await api("/api/farms", { method: "POST", body: f });
    if (!FarmStore.get()) FarmStore.set(saved.id);
    closeModal();
    if (new URLSearchParams(location.search).get("first")) { location.href = "dashboard.html"; return; }
    load();
  } catch (err) { notice($("#formMsg"), err.message); }
}

init().catch(console.error);