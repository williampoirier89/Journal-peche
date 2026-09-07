const $ = id => document.getElementById(id);
const photo = $("photo"), preview = $("preview"), dateInput = $("date"), locationInput = $("location");
const species = $("species"), countInput = $("count"), waterTemp = $("waterTemp"), waterUnknown = $("waterUnknown");
const photoStatus = $("photoStatus"), weatherStatus = $("weatherStatus"), aiStatus = $("aiStatus");
const aiBtn = $("aiBtn"), aiBox = $("aiBox"), dateBadge = $("dateBadge"), locationBadge = $("locationBadge");
const coordsBox = $("coords"), weatherBox = $("weatherBox"), msg = $("msg");

let currentPhoto = null, currentFile = null, lat = null, lon = null, weatherData = null, aiData = null;
let entries = loadEntries();

function loadEntries(){
  try{
    const v3 = JSON.parse(localStorage.getItem("fishingEntriesV3") || "null");
    if(Array.isArray(v3)) return v3;
    const v2 = JSON.parse(localStorage.getItem("fishingEntriesV2") || "[]");
    return Array.isArray(v2) ? v2.map(e => ({...e, ai:e.ai||null})) : [];
  }catch{return []}
}
function persist(){
  try{localStorage.setItem("fishingEntriesV3", JSON.stringify(entries))}
  catch{msg.textContent="Stockage presque plein. Exporte tes données avant de supprimer d'anciennes entrées."}
  renderAll();
}
function localToday(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
dateInput.value=localToday();

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    $("panel-"+btn.dataset.tab).classList.add("active");
  });
});

waterUnknown.addEventListener("change", syncWater);
function syncWater(){waterTemp.disabled=waterUnknown.checked;if(waterUnknown.checked)waterTemp.value=""}
syncWater();

photo.addEventListener("change", async()=>{
  const file=photo.files&&photo.files[0];
  if(!file)return;
  currentFile=file;
  currentPhoto=await fileToDataURL(file);
  preview.src=currentPhoto;preview.style.display="block";
  aiBtn.disabled=false; aiBox.style.display="none"; aiStatus.style.display="none"; aiData=null;
  lat=null;lon=null;weatherData=null;weatherBox.style.display="none";
  dateBadge.innerHTML="";locationBadge.innerHTML="";coordsBox.textContent="";
  photoStatus.className="status";photoStatus.textContent="Analyse de la date et du GPS…";
  try{
    if(typeof exifr==="undefined")throw new Error();
    const meta=await exifr.parse(file,{tiff:true,exif:true,gps:true,reviveValues:true,translateValues:false});
    const foundDate=meta&&(meta.DateTimeOriginal||meta.CreateDate||meta.ModifyDate||meta.DateTime);
    if(foundDate instanceof Date&&!Number.isNaN(foundDate.getTime())){
      dateInput.value=`${foundDate.getFullYear()}-${String(foundDate.getMonth()+1).padStart(2,"0")}-${String(foundDate.getDate()).padStart(2,"0")}`;
      dateBadge.innerHTML='<span class="auto-badge">auto</span>';
    }
    const gps=await exifr.gps(file).catch(()=>null);
    if(gps&&Number.isFinite(gps.latitude)&&Number.isFinite(gps.longitude)){
      lat=gps.latitude;lon=gps.longitude;
      coordsBox.textContent=`GPS photo : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      locationBadge.innerHTML='<span class="auto-badge">GPS</span>';
      photoStatus.className="status ok";photoStatus.textContent="Date/GPS détectés. Recherche du lieu et de la météo…";
      await reverseGeocode(); await fetchWeather();
    }else{
      photoStatus.className="status warn";
      photoStatus.textContent=foundDate?"Date détectée, mais aucun GPS trouvé. Écris le lieu puis récupère la météo.":"Aucune date/GPS lisible. Entre la date et le lieu manuellement.";
    }
  }catch{
    photoStatus.className="status warn";photoStatus.textContent="Métadonnées non lisibles. Entre la date et le lieu manuellement.";
  }
});

aiBtn.addEventListener("click", analyzeFishAI);

async function analyzeFishAI(){
  if(!currentPhoto)return;
  aiBtn.disabled=true;
  aiStatus.style.display="block"; aiStatus.className="status info";
  aiStatus.textContent="Chargement du modèle IA… La première analyse peut prendre 1 à 3 minutes sur iPhone.";
  aiBox.style.display="none";
  try{
    const {pipeline, env}=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm");
    env.allowLocalModels=false;
    aiStatus.textContent="Modèle chargé. Détection des poissons…";

    const detector=await pipeline("zero-shot-object-detection","Xenova/owlvit-base-patch32");
    const labels=[
      "walleye fish","northern pike fish","yellow perch fish","trout fish",
      "smallmouth bass fish","largemouth bass fish","lake sturgeon fish","fish"
    ];
    const raw=await detector(currentPhoto,labels,{threshold:0.045,top_k:30});
    const cleaned=nmsDetections(raw.filter(x=>x&&x.box&&Number(x.score)>=0.045),0.45);

    const fishSpecific=cleaned.filter(x=>x.label!=="fish");
    const detected=fishSpecific.length?fishSpecific:cleaned;
    const count=Math.max(1, detected.length || 1);

    let best=null;
    if(fishSpecific.length) best=[...fishSpecific].sort((a,b)=>b.score-a.score)[0];

    aiStatus.textContent="Détection terminée. Vérification de l'espèce…";
    const classifier=await pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch32");
    const classLabels=[
      "a walleye fish","a northern pike fish","a yellow perch fish","a trout fish",
      "a smallmouth bass fish","a largemouth bass fish","a lake sturgeon fish"
    ];
    const classified=await classifier(currentPhoto,classLabels);
    const classBest=classified&&classified[0]?classified[0]:null;

    const candidates=[];
    if(best)candidates.push({label:best.label,score:Number(best.score)});
    if(classBest)candidates.push({label:classBest.label,score:Number(classBest.score)});
    candidates.sort((a,b)=>b.score-a.score);
    const winner=candidates[0]||{label:"fish",score:0};

    const fr=mapSpecies(winner.label);
    const confidence=Math.max(0,Math.min(1,winner.score||0));

    aiData={count,species:fr,confidence,detections:detected.length};
    countInput.value=String(count);
    if([...species.options].some(o=>o.value===fr))species.value=fr;

    $("aiCount").textContent=String(count);
    $("aiSpecies").textContent=fr;
    $("aiConfidence").textContent=Math.round(confidence*100)+" %";
    $("aiConfidenceBar").style.width=Math.round(confidence*100)+"%";
    aiBox.style.display="block";
    aiStatus.className="status ok";
    aiStatus.textContent="Analyse IA terminée. Confirme les valeurs avant l'enregistrement.";
  }catch(err){
    aiStatus.className="status warn";
    aiStatus.textContent="L'analyse IA n'a pas pu se terminer sur cet appareil ou cette connexion. Tu peux toujours entrer l'espèce et le nombre manuellement.";
    console.error(err);
  }finally{
    aiBtn.disabled=false;
  }
}

function mapSpecies(label){
  const s=String(label||"").toLowerCase();
  if(s.includes("walleye"))return"Doré jaune";
  if(s.includes("northern pike"))return"Grand brochet";
  if(s.includes("yellow perch"))return"Perchaude";
  if(s.includes("smallmouth"))return"Achigan à petite bouche";
  if(s.includes("largemouth"))return"Achigan à grande bouche";
  if(s.includes("sturgeon"))return"Esturgeon";
  if(s.includes("trout"))return"Truite";
  return"Autre";
}
function nmsDetections(items,iouThreshold){
  const sorted=[...items].sort((a,b)=>b.score-a.score), kept=[];
  for(const item of sorted){
    if(!kept.some(k=>iou(item.box,k.box)>iouThreshold)) kept.push(item);
  }
  return kept;
}
function iou(a,b){
  const ax1=a.xmin,ay1=a.ymin,ax2=a.xmax,ay2=a.ymax,bx1=b.xmin,by1=b.ymin,bx2=b.xmax,by2=b.ymax;
  const x1=Math.max(ax1,bx1),y1=Math.max(ay1,by1),x2=Math.min(ax2,bx2),y2=Math.min(ay2,by2);
  const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);
  const aa=Math.max(0,ax2-ax1)*Math.max(0,ay2-ay1),bb=Math.max(0,bx2-bx1)*Math.max(0,by2-by1);
  return inter/(aa+bb-inter||1);
}

$("weatherBtn").addEventListener("click",async()=>{
  weatherData=null;weatherBox.style.display="none";
  if(!dateInput.value){weatherStatus.className="status warn";weatherStatus.textContent="Sélectionne une date.";return}
  if(!(Number.isFinite(lat)&&Number.isFinite(lon))){
    const name=locationInput.value.trim();
    if(!name){weatherStatus.className="status warn";weatherStatus.textContent="Entre un emplacement.";return}
    if(!await geocodeLocation(name))return;
  }
  await fetchWeather();
});

dateInput.addEventListener("change",()=>{weatherData=null;weatherBox.style.display="none";weatherStatus.className="status";weatherStatus.textContent='Date modifiée. Appuie sur « Récupérer la météo ».';
});
locationInput.addEventListener("input",()=>{if(!locationInput.dataset.autoUpdate){lat=null;lon=null;coordsBox.textContent=""}delete locationInput.dataset.autoUpdate});

async function reverseGeocode(){
  try{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=fr&zoom=14`;
    const r=await fetch(url);if(!r.ok)throw new Error();const data=await r.json();const a=data.address||{};
    const place=a.water||a.reservoir||a.lake||a.river||a.village||a.town||a.city||a.municipality||a.county;
    const region=a.state||a.region;
    if(place||region){locationInput.dataset.autoUpdate="1";locationInput.value=[place,region].filter(Boolean).join(", ");locationBadge.innerHTML='<span class="auto-badge">auto</span>'}
  }catch{}
}
async function geocodeLocation(name){
  weatherStatus.className="status";weatherStatus.textContent="Recherche de l'emplacement…";
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&accept-language=fr&q=${encodeURIComponent(name)}`;
    const r=await fetch(url);if(!r.ok)throw new Error();const data=await r.json();
    if(!data.length){weatherStatus.className="status warn";weatherStatus.textContent="Emplacement introuvable. Essaie avec le nom du lac + Québec.";return false}
    lat=Number(data[0].lat);lon=Number(data[0].lon);coordsBox.textContent=`Position météo : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;return true;
  }catch{weatherStatus.className="status warn";weatherStatus.textContent="Impossible de trouver l'emplacement pour le moment.";return false}
}
async function fetchWeather(){
  if(!(Number.isFinite(lat)&&Number.isFinite(lon))||!dateInput.value)return;
  weatherStatus.className="status";weatherStatus.textContent="Téléchargement de la météo historique…";
  const d=dateInput.value;
  const hourly=["temperature_2m","precipitation","rain","weather_code","pressure_msl","cloud_cover","wind_speed_10m","wind_direction_10m","wind_gusts_10m"].join(",");
  const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${d}&end_date=${d}&hourly=${hourly}&timezone=auto`;
  try{
    const r=await fetch(url);if(!r.ok)throw new Error();const data=await r.json();const h=data.hourly;if(!h||!h.time||!h.time.length)throw new Error();
    const windDir=circularMeanDirection(h.wind_direction_10m,h.wind_speed_10m);
    weatherData={
      airTempC:round1(avg(validNums(h.temperature_2m))),
      pressureHpa:round1(avg(validNums(h.pressure_msl))),
      cloudPct:Math.round(avg(validNums(h.cloud_cover))),
      windKmh:round1(avg(validNums(h.wind_speed_10m))),
      gustKmh:round1(max(validNums(h.wind_gusts_10m))),
      precipMm:round1(sum(validNums(h.precipitation))),
      rainMm:round1(sum(validNums(h.rain))),
      windDirectionDeg:Number.isFinite(windDir)?Math.round(windDir):null,
      windDirectionText:Number.isFinite(windDir)?compass(windDir):"—",
      conditionText:conditionFromCodes(validNums(h.weather_code).map(Math.round),validNums(h.cloud_cover),sum(validNums(h.rain)),sum(validNums(h.precipitation)))
    };
    renderWeather();weatherStatus.className="status ok";weatherStatus.textContent="Météo historique récupérée automatiquement.";
  }catch{weatherData=null;weatherBox.style.display="none";weatherStatus.className="status warn";weatherStatus.textContent="Météo historique indisponible pour cette date/emplacement."}
}
function renderWeather(){
  if(!weatherData)return;
  $("airTemp").textContent=finiteText(weatherData.airTempC," °C");$("condition").textContent=weatherData.conditionText||"—";
  $("wind").textContent=finiteText(weatherData.windKmh," km/h");$("gust").textContent=finiteText(weatherData.gustKmh," km/h");
  $("windDir").textContent=weatherData.windDirectionDeg==null?"—":`${weatherData.windDirectionText} (${weatherData.windDirectionDeg}°)`;
  $("pressure").textContent=finiteText(weatherData.pressureHpa," hPa");$("rain").textContent=finiteText(weatherData.precipMm," mm");
  $("clouds").textContent=finiteText(weatherData.cloudPct," %");weatherBox.style.display="grid";
}
function conditionFromCodes(codes,clouds,rain,precip){
  const set=new Set(codes);if([...set].some(c=>c>=95))return"Orageux";if([...set].some(c=>c>=71&&c<=77))return"Neige";
  if([...set].some(c=>(c>=51&&c<=67)||(c>=80&&c<=82)))return"Pluvieux";if([...set].some(c=>c>=45&&c<=48))return"Brouillard";
  if(rain>0.1||precip>0.1)return"Précipitations";const c=avg(validNums(clouds));if(c<25)return"Ensoleillé";if(c<70)return"Partiellement nuageux";return"Nuageux";
}
function circularMeanDirection(directions,speeds){
  if(!Array.isArray(directions))return NaN;let x=0,y=0,w=0;
  for(let i=0;i<directions.length;i++){const d=Number(directions[i]);if(!Number.isFinite(d))continue;const s=Array.isArray(speeds)&&Number.isFinite(Number(speeds[i]))?Math.max(Number(speeds[i]),.1):1;const r=d*Math.PI/180;x+=Math.cos(r)*s;y+=Math.sin(r)*s;w+=s}
  if(!w)return NaN;let deg=Math.atan2(y,x)*180/Math.PI;if(deg<0)deg+=360;return deg;
}
function compass(deg){return["N","NE","E","SE","S","SO","O","NO"][Math.round(deg/45)%8]}
function validNums(a){return Array.isArray(a)?a.map(Number).filter(Number.isFinite):[]}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN}
function sum(a){return a.length?a.reduce((x,y)=>x+y,0):NaN}
function max(a){return a.length?Math.max(...a):NaN}
function round1(n){return Number.isFinite(n)?Math.round(n*10)/10:null}
function finiteText(v,s){return Number.isFinite(Number(v))?`${v}${s}`:"—"}

$("save").addEventListener("click",()=>{
  const loc=locationInput.value.trim();
  if(!dateInput.value){msg.textContent="Sélectionne la date.";return}
  if(!loc&&!(Number.isFinite(lat)&&Number.isFinite(lon))){msg.textContent="Entre ou récupère l'emplacement.";return}
  const n=Math.max(1,Math.min(100,Number(countInput.value)||1));
  const wt=waterUnknown.checked?null:Number(waterTemp.value);
  if(!waterUnknown.checked&&!Number.isFinite(wt)){msg.textContent="Entre la température de l'eau en °F ou sélectionne « inconnue ».";return}
  entries.unshift({
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    photo:currentPhoto,date:dateInput.value,location:loc||`${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lon)?lon:null,
    species:species.value,count:n,waterTempF:waterUnknown.checked?null:wt,waterTempUnknown:waterUnknown.checked,
    weather:weatherData,ai:aiData,createdAt:new Date().toISOString()
  });
  persist();resetForm();msg.textContent="Prise enregistrée. Son dossier d'endroit a été mis à jour.";
});

function resetForm(){
  photo.value="";currentPhoto=null;currentFile=null;preview.removeAttribute("src");preview.style.display="none";
  dateInput.value=localToday();locationInput.value="";dateBadge.innerHTML="";locationBadge.innerHTML="";coordsBox.textContent="";
  lat=null;lon=null;species.value="Doré jaune";countInput.value="1";waterUnknown.checked=true;syncWater();
  weatherData=null;weatherBox.style.display="none";aiData=null;aiBox.style.display="none";aiStatus.style.display="none";aiBtn.disabled=true;
  photoStatus.className="status";photoStatus.textContent="Sélectionne une photo pour commencer.";
  weatherStatus.className="status";weatherStatus.textContent="La météo sera récupérée après la date et l'emplacement.";
}

function renderAll(){renderJournal();renderFolders();renderAverages()}
function renderJournal(){
  const list=$("list"),empty=$("empty");list.innerHTML="";empty.style.display=entries.length?"none":"block";
  let fish=0;const sp=new Set();
  entries.forEach(e=>{fish+=Number(e.count)||0;sp.add(e.species);list.appendChild(makeEntryNode(e,true))});
  $("totalFish").textContent=fish;$("totalTrips").textContent=entries.length;$("speciesCount").textContent=sp.size;
}
function makeEntryNode(e,showDelete){
  const div=document.createElement("div");div.className="entry";const wx=e.weather;
  const weatherLine=wx?`${escapeHtml(wx.conditionText||"")} · ${finiteText(wx.airTempC," °C")} · ${finiteText(wx.pressureHpa," hPa")}`:"Météo non enregistrée";
  const waterLine=e.waterTempF==null?"Eau : inconnue":`Eau : ${escapeHtml(e.waterTempF)} °F`;
  const aiLine=e.ai?` · IA ${Math.round((e.ai.confidence||0)*100)} %`:"";
  div.innerHTML=`${e.photo?`<img class="thumb" src="${e.photo}" alt="Photo de ${escapeHtml(e.species)}">`:`<div class="thumb"></div>`}
    <div><div><span class="pill">${escapeHtml(e.species)}</span> <b>× ${e.count}</b></div>
    <div class="meta">${escapeHtml(e.location)}</div><div class="meta">${escapeHtml(e.date)} · ${waterLine}${aiLine}</div><div class="meta">${weatherLine}</div></div>
    ${showDelete?`<button class="danger" type="button">Supprimer</button>`:""}`;
  if(showDelete)div.querySelector("button").addEventListener("click",()=>{entries=entries.filter(x=>x.id!==e.id);persist()});
  return div;
}
function renderFolders(){
  const wrap=$("foldersList"),empty=$("foldersEmpty");wrap.innerHTML="";
  const groups=new Map();
  for(const e of entries){const key=(e.location||"Lieu inconnu").trim();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
  empty.style.display=groups.size?"none":"block";
  [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],"fr")).forEach(([name,items])=>{
    const folder=document.createElement("div");folder.className="folder";
    const total=items.reduce((s,e)=>s+(Number(e.count)||0),0);
    folder.innerHTML=`<button class="folder-head" type="button"><span>📁 <b>${escapeHtml(name)}</b></span><span class="small">${items.length} entrée${items.length>1?"s":""} · ${total} poisson${total>1?"s":""}</span></button><div class="folder-body"></div>`;
    const body=folder.querySelector(".folder-body");items.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(e=>body.appendChild(makeEntryNode(e,false)));
    folder.querySelector(".folder-head").addEventListener("click",()=>folder.classList.toggle("open"));wrap.appendChild(folder);
  });
}
function meanOf(values){const v=values.map(Number).filter(Number.isFinite);return v.length?round1(v.reduce((a,b)=>a+b,0)/v.length):null}
function renderAverages(){
  const empty=$("avgEmpty"),grid=$("avgGrid");
  if(!entries.length){empty.style.display="block";grid.style.display="none";$("conditionSummary").innerHTML="";$("locationSummary").innerHTML="";return}
  empty.style.display="none";grid.style.display="grid";
  $("avgFish").textContent=finiteText(meanOf(entries.map(e=>e.count)),"");
  $("avgAir").textContent=finiteText(meanOf(entries.map(e=>e.weather?.airTempC))," °C");
  $("avgWater").textContent=finiteText(meanOf(entries.map(e=>e.waterTempF))," °F");
  $("avgWind").textContent=finiteText(meanOf(entries.map(e=>e.weather?.windKmh))," km/h");
  $("avgGust").textContent=finiteText(meanOf(entries.map(e=>e.weather?.gustKmh))," km/h");
  $("avgPressure").textContent=finiteText(meanOf(entries.map(e=>e.weather?.pressureHpa))," hPa");
  $("avgRain").textContent=finiteText(meanOf(entries.map(e=>e.weather?.precipMm))," mm");
  $("avgCloud").textContent=finiteText(meanOf(entries.map(e=>e.weather?.cloudPct))," %");

  const cond={};entries.forEach(e=>{const c=e.weather?.conditionText;if(c)cond[c]=(cond[c]||0)+1});
  const sortedCond=Object.entries(cond).sort((a,b)=>b[1]-a[1]);
  $("conditionSummary").innerHTML=sortedCond.length?`<h3>Condition la plus fréquente</h3><div class="status">${escapeHtml(sortedCond[0][0])} — ${sortedCond[0][1]} entrée${sortedCond[0][1]>1?"s":""}</div>`:"";

  const loc={};entries.forEach(e=>{const k=e.location||"Lieu inconnu";loc[k]=(loc[k]||0)+(Number(e.count)||0)});
  const best=Object.entries(loc).sort((a,b)=>b[1]-a[1])[0];
  $("locationSummary").innerHTML=best?`<h3>Endroit avec le plus de poissons enregistrés</h3><div class="status">${escapeHtml(best[0])} — ${best[1]} poisson${best[1]>1?"s":""}</div>`:"";
}

$("clear").addEventListener("click",()=>{if(confirm("Effacer toutes les prises enregistrées sur cet appareil?")){entries=[];persist()}});
$("export").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="journal-peche-v3.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
renderAll();
