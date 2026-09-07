const $ = id => document.getElementById(id);
const photo = $("photo"), preview = $("preview"), dateInput = $("date"), timeInput = $("time");
const locationInput = $("location"), species = $("species"), count = $("count"), temp = $("temp");
const saveBtn = $("save"), list = $("list"), empty = $("empty"), msg = $("msg");
const totalFish = $("totalFish"), totalTrips = $("totalTrips"), speciesCount = $("speciesCount");

let currentPhoto = null;
let entries = JSON.parse(localStorage.getItem("fishingEntries") || "[]");

function setNow(){
  const d = new Date();
  dateInput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  timeInput.value = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
setNow();

photo.addEventListener("change", () => {
  const file = photo.files && photo.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentPhoto = e.target.result;
    preview.src = currentPhoto;
    preview.style.display = "block";
    msg.textContent = "Photo ajoutée. Pour ce premier test, vérifie la date affichée.";
  };
  reader.readAsDataURL(file);
});

saveBtn.addEventListener("click", () => {
  const loc = locationInput.value.trim();
  if(!loc){
    msg.textContent = "Entre le lieu de pêche.";
    locationInput.focus();
    return;
  }
  const n = Math.max(1, Math.min(100, Number(count.value) || 1));
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    photo: currentPhoto,
    date: dateInput.value,
    time: timeInput.value,
    location: loc,
    species: species.value,
    count: n,
    temp: temp.value === "" ? null : Number(temp.value),
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
  locationInput.value = "";
  species.value = "Doré jaune";
  count.value = 1;
  temp.value = "";
  setNow();
}

function persist(){
  localStorage.setItem("fishingEntries", JSON.stringify(entries));
  render();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render(){
  list.innerHTML = "";
  empty.style.display = entries.length ? "none" : "block";

  let fish = 0;
  const speciesSet = new Set();

  entries.forEach(e => {
    fish += Number(e.count) || 0;
    speciesSet.add(e.species);

    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      ${e.photo ? `<img class="thumb" src="${e.photo}" alt="Photo de ${escapeHtml(e.species)}">` : `<div class="thumb"></div>`}
      <div>
        <div><span class="pill">${escapeHtml(e.species)}</span> <b>× ${e.count}</b></div>
        <div class="meta">${escapeHtml(e.location)}</div>
        <div class="meta">${escapeHtml(e.date || "")}${e.time ? " à "+escapeHtml(e.time) : ""}${e.temp !== null ? " · "+escapeHtml(e.temp)+" °C" : ""}</div>
      </div>
      <button class="danger" type="button" data-id="${e.id}">Supprimer</button>
    `;
    div.querySelector("button").addEventListener("click", () => {
      entries = entries.filter(x => x.id !== e.id);
      persist();
    });
    list.appendChild(div);
  });

  totalFish.textContent = fish;
  totalTrips.textContent = entries.length;
  speciesCount.textContent = speciesSet.size;
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
  a.download = "journal-peche.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

render();
