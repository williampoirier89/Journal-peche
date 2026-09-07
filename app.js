const $ = id => document.getElementById(id);

const photo = $("photo");
const preview = $("preview");
const dateInput = $("date");
const locationInput = $("location");
const species = $("species");
const countInput = $("count");
const waterTemp = $("waterTemp");
const waterUnknown = $("waterUnknown");
const saveBtn = $("save");
const weatherBtn = $("weatherBtn");

const photoStatus = $("photoStatus");
const weatherStatus = $("weatherStatus");
const dateBadge = $("dateBadge");
const locationBadge = $("locationBadge");
const coordsBox = $("coords");
const weatherBox = $("weatherBox");
const msg = $("msg");

let currentPhoto = null;
let lat = null;
let lon = null;
let weatherData = null;
let entries = safeLoadEntries();

function safeLoadEntries(){
  try { return JSON.parse(localStorage.getItem("fishingEntriesV2") || "[]"); }
  catch { return []; }
}

function localToday(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
dateInput.value = localToday();

waterUnknown.addEventListener("change", syncWater);
function syncWater(){
  waterTemp.disabled = waterUnknown.checked;
  if(waterUnknown.checked) waterTemp.value = "";
}
syncWater();

photo.addEventListener("change", async () => {
  const file = photo.files && photo.files[0];
  if(!file) return;

  photoStatus.className = "status";
  photoStatus.textContent = "Analyse de la photo en cours…";
  currentPhoto = await fileToDataURL(file);

  preview.src = currentPhoto;
  preview.style.display = "block";

  lat = null;
  lon = null;
  weatherData = null;
  weatherBox.style.display = "none";
  dateBadge.innerHTML = "";
  locationBadge.innerHTML = "";
  coordsBox.textContent = "";

  try {
    if(typeof exifr === "undefined") throw new Error("Lecteur EXIF indisponible");

    const meta = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      reviveValues: true,
      translateValues: false
    });

    let foundDate = meta && (
      meta.DateTimeOriginal ||
      meta.CreateDate ||
      meta.ModifyDate ||
      meta.DateTime
    );

    if(foundDate instanceof Date && !Number.isNaN(foundDate.getTime())){
      dateInput.value = `${foundDate.getFullYear()}-${String(foundDate.getMonth()+1).padStart(2,"0")}-${String(foundDate.getDate()).padStart(2,"0")}`;
      dateBadge.innerHTML = '<span class="auto-badge">auto</span>';
    }

    const gps = await exifr.gps(file).catch(()=>null);
    if(gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)){
      lat = gps.latitude;
      lon = gps.longitude;
      coordsBox.textContent = `GPS photo : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      locationBadge.innerHTML = '<span class="auto-badge">GPS</span>';

      photoStatus.className = "status ok";
      photoStatus.textContent = "Date/GPS détectés. Recherche du lieu et de la météo…";

      await reverseGeocode();
      await fetchWeather();
    } else {
      photoStatus.className = "status warn";
      photoStatus.textContent = foundDate
        ? "Date détectée, mais aucun GPS trouvé. Écris le lieu puis récupère la météo."
        : "Aucune date/GPS lisible. Tu peux entrer la date et le lieu manuellement.";
    }
  } catch(err) {
    photoStatus.className = "status warn";
    photoStatus.textContent = "Métadonnées non lisibles sur cette photo. Entre la date et le lieu manuellement.";
  }
});

weatherBtn.addEventListener("click", async () => {
  weatherData = null;
  weatherBox.style.display = "none";

  if(!dateInput.value){
    weatherStatus.className = "status warn";
    weatherStatus.textContent = "Sélectionne une date.";
    return;
  }

  if(!(Number.isFinite(lat) && Number.isFinite(lon))){
    const name = locationInput.value.trim();
    if(!name){
      weatherStatus.className = "status warn";
      weatherStatus.textContent = "Entre un emplacement.";
      return;
    }
    const ok = await geocodeLocation(name);
    if(!ok) return;
  }

  await fetchWeather();
});

dateInput.addEventListener("change", () => {
  weatherData = null;
  weatherBox.style.display = "none";
  weatherStatus.className = "status";
  weatherStatus.textContent = "Date modifiée. Appuie sur « Récupérer la météo ».";
});

locationInput.addEventListener("input", () => {
  if(!locationInput.dataset.autoUpdate) {
    lat = null;
    lon = null;
    coordsBox.textContent = "";
  }
  delete locationInput.dataset.autoUpdate;
});

async function reverseGeocode(){
  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=fr&zoom=14`;
    const r = await fetch(url);
    if(!r.ok) throw new Error("reverse failed");
    const data = await r.json();

    const a = data.address || {};
    const place = a.water || a.reservoir || a.lake || a.river || a.village || a.town || a.city || a.municipality || a.county;
    const region = a.state || a.region;

    if(place || region){
      locationInput.dataset.autoUpdate = "1";
      locationInput.value = [place, region].filter(Boolean).join(", ");
      locationBadge.innerHTML = '<span class="auto-badge">auto</span>';
    }
  }catch{
    // GPS coordinates remain usable even if reverse geocoding fails.
  }
}

async function geocodeLocation(name){
  weatherStatus.className = "status";
  weatherStatus.textContent = "Recherche de l'emplacement…";

  try{
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&accept-language=fr&q=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    if(!r.ok) throw new Error("geocode failed");
    const data = await r.json();

    if(!data.length){
      weatherStatus.className = "status warn";
      weatherStatus.textContent = "Emplacement introuvable. Essaie avec le nom du lac + Québec.";
      return false;
    }

    lat = Number(data[0].lat);
    lon = Number(data[0].lon);
    coordsBox.textContent = `Position météo : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    return true;
  }catch{
    weatherStatus.className = "status warn";
    weatherStatus.textContent = "Impossible de trouver l'emplacement pour le moment.";
    return false;
  }
}

async function fetchWeather(){
  if(!(Number.isFinite(lat) && Number.isFinite(lon)) || !dateInput.value) return;

  weatherStatus.className = "status";
  weatherStatus.textContent = "Téléchargement de la météo historique…";

  const d = dateInput.value;
  const hourly = [
    "temperature_2m",
    "precipitation",
    "rain",
    "weather_code",
    "pressure_msl",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m"
  ].join(",");

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${d}&end_date=${d}&hourly=${hourly}&timezone=auto`;

  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error("weather failed");
    const data = await r.json();

    if(!data.hourly || !data.hourly.time || !data.hourly.time.length){
      throw new Error("no hourly");
    }

    const h = data.hourly;

    const tempVals = validNums(h.temperature_2m);
    const pressureVals = validNums(h.pressure_msl);
    const cloudVals = validNums(h.cloud_cover);
    const windVals = validNums(h.wind_speed_10m);
    const gustVals = validNums(h.wind_gusts_10m);
    const precipVals = validNums(h.precipitation);
    const rainVals = validNums(h.rain);
    const codes = validNums(h.weather_code).map(Math.round);

    const windDir = circularMeanDirection(h.wind_direction_10m, h.wind_speed_10m);

    weatherData = {
      airTempC: round1(avg(tempVals)),
      pressureHpa: round1(avg(pressureVals)),
      cloudPct: Math.round(avg(cloudVals)),
      windKmh: round1(avg(windVals)),
      gustKmh: round1(max(gustVals)),
      precipMm: round1(sum(precipVals)),
      rainMm: round1(sum(rainVals)),
      windDirectionDeg: Number.isFinite(windDir) ? Math.round(windDir) : null,
      windDirectionText: Number.isFinite(windDir) ? compass(windDir) : "—",
      weatherCode: representativeWeatherCode(codes),
      conditionText: conditionFromCodes(codes, cloudVals, sum(rainVals), sum(precipVals))
    };

    renderWeather();

    weatherStatus.className = "status ok";
    weatherStatus.textContent = "Météo historique récupérée automatiquement.";
  }catch(err){
    weatherData = null;
    weatherBox.style.display = "none";
    weatherStatus.className = "status warn";
    weatherStatus.textContent = "Météo historique indisponible pour cette date/emplacement. Vérifie la date ou réessaie plus tard.";
  }
}

function renderWeather(){
  if(!weatherData) return;
  $("airTemp").textContent = finiteText(weatherData.airTempC, " °C");
  $("condition").textContent = weatherData.conditionText || "—";
  $("wind").textContent = finiteText(weatherData.windKmh, " km/h");
  $("gust").textContent = finiteText(weatherData.gustKmh, " km/h");
  $("windDir").textContent = weatherData.windDirectionDeg == null
    ? "—"
    : `${weatherData.windDirectionText} (${weatherData.windDirectionDeg}°)`;
  $("pressure").textContent = finiteText(weatherData.pressureHpa, " hPa");
  $("rain").textContent = finiteText(weatherData.precipMm, " mm");
  $("clouds").textContent = finiteText(weatherData.cloudPct, " %");
  weatherBox.style.display = "grid";
}

function conditionFromCodes(codes, clouds, rain, precip){
  const set = new Set(codes);
  if([...set].some(c => c >= 95)) return "Orageux";
  if([...set].some(c => c >= 71 && c <= 77)) return "Neige";
  if([...set].some(c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82))) return "Pluvieux";
  if([...set].some(c => c >= 45 && c <= 48)) return "Brouillard";
  if(rain > 0.1 || precip > 0.1) return "Précipitations";
  const c = avg(validNums(clouds));
  if(c < 25) return "Ensoleillé";
  if(c < 70) return "Partiellement nuageux";
  return "Nuageux";
}

function representativeWeatherCode(codes){
  if(!codes.length) return null;
  const freq = {};
  for(const c of codes) freq[c] = (freq[c] || 0) + 1;
  return Number(Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0]);
}

function circularMeanDirection(directions, speeds){
  if(!Array.isArray(directions)) return NaN;
  let x=0, y=0, w=0;
  for(let i=0;i<directions.length;i++){
    const d = Number(directions[i]);
    if(!Number.isFinite(d)) continue;
    const speed = Array.isArray(speeds) && Number.isFinite(Number(speeds[i])) ? Math.max(Number(speeds[i]),0.1) : 1;
    const rad = d * Math.PI / 180;
    x += Math.cos(rad) * speed;
    y += Math.sin(rad) * speed;
    w += speed;
  }
  if(!w) return NaN;
  let deg = Math.atan2(y,x) * 180 / Math.PI;
  if(deg < 0) deg += 360;
  return deg;
}

function compass(deg){
  const dirs = ["N","NE","E","SE","S","SO","O","NO"];
  return dirs[Math.round(deg/45)%8];
}

function validNums(arr){
  return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
}
function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : NaN; }
function sum(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0) : NaN; }
function max(arr){ return arr.length ? Math.max(...arr) : NaN; }
function round1(n){ return Number.isFinite(n) ? Math.round(n*10)/10 : null; }
function finiteText(v,suffix){ return Number.isFinite(Number(v)) ? `${v}${suffix}` : "—"; }

saveBtn.addEventListener("click", () => {
  const loc = locationInput.value.trim();
  if(!dateInput.value){
    msg.textContent = "Sélectionne la date.";
    return;
  }
  if(!loc && !(Number.isFinite(lat)&&Number.isFinite(lon))){
    msg.textContent = "Entre ou récupère l'emplacement.";
    return;
  }

  const n = Math.max(1, Math.min(100, Number(countInput.value) || 1));
  const wt = waterUnknown.checked ? null : Number(waterTemp.value);

  if(!waterUnknown.checked && !Number.isFinite(wt)){
    msg.textContent = "Entre la température de l'eau en °F ou sélectionne « inconnue ».";
    return;
  }

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    photo: currentPhoto,
    date: dateInput.value,
    location: loc || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    species: species.value,
    count: n,
    waterTempF: waterUnknown.checked ? null : wt,
    waterTempUnknown: waterUnknown.checked,
    weather: weatherData,
    createdAt: new Date().toISOString()
  };

  entries.unshift(entry);
  persist();
  resetForm();
  msg.textContent = "Prise enregistrée.";
});

function resetForm(){
  photo.value = "";
  currentPhoto = null;
  preview.removeAttribute("src");
  preview.style.display = "none";
  dateInput.value = localToday();
  locationInput.value = "";
  dateBadge.innerHTML = "";
  locationBadge.innerHTML = "";
  coordsBox.textContent = "";
  lat = null;
  lon = null;
  species.value = "Doré jaune";
  countInput.value = "1";
  waterUnknown.checked = true;
  syncWater();
  weatherData = null;
  weatherBox.style.display = "none";
  photoStatus.className = "status";
  photoStatus.textContent = "Sélectionne une photo pour commencer.";
  weatherStatus.className = "status";
  weatherStatus.textContent = "La météo sera récupérée après la date et l'emplacement.";
}

function persist(){
  try{
    localStorage.setItem("fishingEntriesV2", JSON.stringify(entries));
  }catch(err){
    msg.textContent = "Stockage plein. Les photos prennent beaucoup d'espace; exporte tes données et supprime d'anciennes entrées.";
  }
  renderJournal();
}

function renderJournal(){
  const list = $("list");
  const empty = $("empty");
  list.innerHTML = "";
  empty.style.display = entries.length ? "none" : "block";

  let fish = 0;
  const sp = new Set();

  entries.forEach(e => {
    fish += Number(e.count) || 0;
    sp.add(e.species);

    const div = document.createElement("div");
    div.className = "entry";

    const wx = e.weather;
    const weatherLine = wx
      ? `${escapeHtml(wx.conditionText || "")} · ${finiteText(wx.airTempC," °C")} · ${finiteText(wx.pressureHpa," hPa")}`
      : "Météo non enregistrée";

    const waterLine = e.waterTempF == null ? "Eau : inconnue" : `Eau : ${escapeHtml(e.waterTempF)} °F`;

    div.innerHTML = `
      ${e.photo ? `<img class="thumb" src="${e.photo}" alt="Photo de ${escapeHtml(e.species)}">` : `<div class="thumb"></div>`}
      <div>
        <div><span class="pill">${escapeHtml(e.species)}</span> <b>× ${e.count}</b></div>
        <div class="meta">${escapeHtml(e.location)}</div>
        <div class="meta">${escapeHtml(e.date)} · ${waterLine}</div>
        <div class="meta">${weatherLine}</div>
      </div>
      <button class="danger" type="button" data-id="${escapeHtml(e.id)}">Supprimer</button>
    `;

    div.querySelector("button").addEventListener("click", () => {
      entries = entries.filter(x => x.id !== e.id);
      persist();
    });

    list.appendChild(div);
  });

  $("totalFish").textContent = fish;
  $("totalTrips").textContent = entries.length;
  $("speciesCount").textContent = sp.size;
}

$("clear").addEventListener("click", () => {
  if(confirm("Effacer toutes les prises enregistrées sur cet appareil?")){
    entries = [];
    persist();
  }
});

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "journal-peche-v2.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

renderJournal();
