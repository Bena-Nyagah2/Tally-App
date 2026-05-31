// App.js - V12.1 (The Fully Restored Master Edition)
(function() {
  /* ------------------------
     STORAGE + HELPERS
  ------------------------ */
  const STORE_KEY = "shoe_entries_json_v12.1";
  const NOTES_KEY = "shoe_tracker_notes_v1";
  const HALF_SIZE_KEY = "shoe_tracker_halfsize_v1";
  const CATALOG_KEY = "shoe_master_catalog";
  const AUTO_SAVE_INTERVAL = 20000; 
  
  let hasUnsavedChanges = false;
  let autoSaveTimer = null;
  let masterCatalog = null;

  const $ = id => document.getElementById(id);

  function uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  }

  function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  function normalizeRow(r){
    return {
      id: r.id || uid(),
      brand: toTitleCase(String(r.brand||"").trim()),
      color: toTitleCase(String(r.color||"").trim()),
      size: String(r.size||"").trim(),
      count: Number(r.count) || 1
    };
  }

  function loadData(){
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return [];
      return arr.map(normalizeRow);
    } catch(e){ 
      toast("❌ Error loading data from storage", "#e74c3c");
      return []; 
    }
  }

  function saveData(arr){
    try {
      const clean = arr.map(normalizeRow);
      localStorage.setItem(STORE_KEY, JSON.stringify(clean));
      saveNotes();
      hasUnsavedChanges = false;
      updateUnsavedWarning();
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
          toast("🛑 STORAGE FULL! Please export and clear data.", "#e74c3c");
      } else {
          toast("❌ Error saving data", "#e74c3c");
      }
      return false;
    }
  }

  function mergeKey(row){
    return `${String(row.brand||"").trim().toLowerCase()}|${String(row.color||"").trim().toLowerCase()}|${String(row.size||"").trim().toLowerCase()}`;
  }

  /* ------------------------
     PREFERENCES & NOTES
  ------------------------ */
  function loadNotes() {
    try {
      const notes = localStorage.getItem(NOTES_KEY);
      if (notes && $("exportNotes")) $("exportNotes").value = notes;
    } catch (error) {}
  }

  function saveNotes() {
    try { if ($("exportNotes")) localStorage.setItem(NOTES_KEY, $("exportNotes").value.trim()); } catch (error) {}
  }

  function loadHalfSizePreference() {
    try {
      const saved = localStorage.getItem(HALF_SIZE_KEY);
      const checkbox = $("includeHalfSizes");
      if (checkbox) {
        if (saved !== null) checkbox.checked = saved === 'true';
        else { checkbox.checked = false; localStorage.setItem(HALF_SIZE_KEY, 'false'); }
      }
    } catch (error) {}
  }

  function saveHalfSizePreference() {
    try { if ($("includeHalfSizes")) localStorage.setItem(HALF_SIZE_KEY, $("includeHalfSizes").checked.toString()); } catch (error) {}
  }

  /* ------------------------
     SMART CATALOG (JSON + CSV)
  ------------------------ */
  function parseCSV(text) {
      const rows = []; let row = [], inQuotes = false, val = "";
      for (let i = 0; i < text.length; i++) {
          let char = text[i];
          if (char === '"' && text[i+1] === '"') { val += '"'; i++; } 
          else if (char === '"') { inQuotes = !inQuotes; } 
          else if (char === ',' && !inQuotes) { row.push(val.trim()); val = ""; } 
          else if (char === '\n' && !inQuotes) { row.push(val.trim()); rows.push(row); row = []; val = ""; } 
          else if (char !== '\r') { val += char; }
      }
      if (val || row.length > 0) { row.push(val.trim()); rows.push(row); }
      return rows;
  }

  function parseJavaScriptJSON(content) {
    try {
      content = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const regex = /^(?:const|let|var)\s+\w+\s*=\s*/;
      if (regex.test(content)) content = content.replace(regex, '');
      if (content.endsWith(';')) content = content.substring(0, content.length - 1);
      return JSON.parse(content.trim());
    } catch (error) { throw new Error("Invalid format"); }
  }

  function loadCatalog() {
    try {
      const catalogJson = localStorage.getItem(CATALOG_KEY);
      masterCatalog = catalogJson ? JSON.parse(catalogJson) : null;
    } catch (error) { masterCatalog = null; }
    return masterCatalog;
  }

  function saveCatalog(catalog) {
    try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); masterCatalog = catalog; return true; } 
    catch (error) { return false; }
  }

  function clearCatalog() {
    localStorage.removeItem(CATALOG_KEY); masterCatalog = null; updateDatalists(); toast("Catalog cleared", "#888");
  }

  function handleCatalogUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoader("Extracting Catalog...");
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        let content = e.target.result;
        let generatedCatalog = {};

        if (file.name.toLowerCase().endsWith('.csv')) {
            const rows = parseCSV(content);
            rows.forEach(r => {
                if (r.length >= 21 && r[13] && r[13].includes("Style Code")) {
                    let desc = toTitleCase(r[16].trim()); 
                    let color = toTitleCase(r[18].trim()); 
                    if (!generatedCatalog[desc]) generatedCatalog[desc] = new Set();
                    generatedCatalog[desc].add(color);
                }
            });
            Object.keys(generatedCatalog).forEach(brand => {
                generatedCatalog[brand] = Array.from(generatedCatalog[brand]).sort();
            });
            if (Object.keys(generatedCatalog).length === 0) throw new Error("No valid products found in this CSV.");
        } else if (file.name.toLowerCase().endsWith('.json')) {
            try { generatedCatalog = JSON.parse(content); } 
            catch(err) { generatedCatalog = parseJavaScriptJSON(content); }
        } else {
            throw new Error("Please upload a .csv or .json file.");
        }
        
        const brandCount = Object.keys(generatedCatalog).length;
        let colorCount = 0;
        Object.values(generatedCatalog).forEach(colors => { colorCount += colors.length; });
        
        if (saveCatalog(generatedCatalog)) {
          hideLoader();
          openModal({
            message: `🎉 Catalog Built Successfully!`,
            subtext: `Extracted ${brandCount} models and ${colorCount} colors.`,
            buttons: [{ label: "Awesome!", color: "var(--success)", onClick: () => { updateDatalists(); toast("✅ Catalog loaded!", "#27ae60"); } }]
          });
        }
      } catch (error) {
        hideLoader(); toast(`❌ ${error.message}`, "#e74c3c");
      }
    };
    reader.onerror = function() { hideLoader(); toast("❌ Error reading file", "#e74c3c"); };
    reader.readAsText(file);
    event.target.value = "";
  }

  function getAllBrands() {
    const brands = new Set();
    if (masterCatalog) Object.keys(masterCatalog).forEach(b => brands.add(toTitleCase(b.trim())));
    loadData().forEach(item => brands.add(item.brand));
    return Array.from(brands).sort();
  }

  function getColorsForBrand(brand) {
    if (!brand) return [];
    const colors = new Set();
    if (masterCatalog && masterCatalog[brand]) {
      masterCatalog[brand].forEach(c => colors.add(toTitleCase(c.trim())));
    }
    loadData().filter(item => item.brand.toLowerCase() === brand.toLowerCase()).forEach(item => colors.add(item.color));
    return Array.from(colors).sort();
  }

  /* ------------------------
     SIZE PARSING & COUNTING
  ------------------------ */
  function calculateInputCount(input) {
    if (!input || !input.trim()) return 0;
    try {
      const parts = input.split(',').filter(p => p.trim().length > 0);
      let count = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('*')) {
          const subParts = trimmed.split('*');
          if (subParts.length === 2 && !isNaN(subParts[1])) {
            const multiplier = parseInt(subParts[1], 10);
            const sizePart = subParts[0].trim();
            if (sizePart.includes('-')) {
              const rangeParts = sizePart.split('-').map(p => parseFloat(p.trim()));
              if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
                const start = Math.min(rangeParts[0], rangeParts[1]), end = Math.max(rangeParts[0], rangeParts[1]);
                const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
                const step = includeHalfSizes ? 0.5 : 1;
                count += (Math.floor((end - start) / step) + 1) * multiplier;
              } else count += multiplier;
            } else count += multiplier;
          } else count++;
        } else if (trimmed.includes('-')) {
          const rangeParts = trimmed.split('-').map(p => parseFloat(p.trim()));
          if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
            const start = Math.min(rangeParts[0], rangeParts[1]), end = Math.max(rangeParts[0], rangeParts[1]);
            const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
            const step = includeHalfSizes ? 0.5 : 1;
            count += Math.floor((end - start) / step) + 1;
          } else count++;
        } else count++;
      }
      return count;
    } catch (err) { return 0; }
  }

  function updateInputCount() {
    try {
      const input = document.getElementById("sizes").value;
      const count = calculateInputCount(input);
      const inputCount = document.getElementById("inputCount");
      if (inputCount) inputCount.textContent = `Input count: ${count}`;
    } catch (error) {}
  }

  function parseSizes(input) {
    const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
    const step = includeHalfSizes ? 0.5 : 1;
    const rawSizes = input.split(',').map(s => s.trim()).filter(Boolean);
    const sizes = [];
    for (const size of rawSizes) {
      if (size.includes('*')) {
        const parts = size.split('*').map(s => s.trim());
        if (parts.length === 2 && !isNaN(parts[1])) {
          const parsedSizes = parseSingleSize(parts[0], step);
          for (let i = 0; i < parseInt(parts[1], 10); i++) parsedSizes.forEach(s => sizes.push(s));
          continue;
        }
      }
      parseSingleSize(size, step).forEach(s => sizes.push(s));
    }
    return sizes;
  }

  function parseSingleSize(size, step) {
    const sizes = [];
    if (size.includes('/') && !size.includes('-')) { sizes.push(size); return sizes; }
    if (size.includes('-')) {
      const parts = size.split('-').map(s => s.trim());
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        const start = parseFloat(parts[0]), end = parseFloat(parts[1]);
        if (start !== end) {
          const isAscending = start < end, stepSize = isAscending ? step : -step;
          const compareFunc = isAscending ? (a, b) => a <= b : (a, b) => a >= b;
          const precision = step === 0.5 ? 1 : 0;
          for (let s = start; compareFunc(s, end); s += stepSize) {
            sizes.push((Math.round(s * Math.pow(10, precision)) / Math.pow(10, precision)).toString());
          }
          return sizes;
        } else { sizes.push(start.toString()); return sizes; }
      }
    }
    if (!isNaN(parseFloat(size)) && isFinite(size)) { sizes.push(parseFloat(size).toString()); return sizes; }
    sizes.push(size); return sizes;
  }

  /* ------------------------
     UI & MODALS
  ------------------------ */
  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/[&<>"']/g, function(m) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[m]; });
  }

  function highlightText(text, searchTerm) {
    const safeText = escapeHtml(text);
    if (!searchTerm) return safeText;
    try {
      const escapedSearch = escapeHtml(searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedSearch})`, 'gi');
      return safeText.replace(regex, '<span class="highlight">$1</span>');
    } catch (error) { return safeText; }
  }

  function toast(message, color="#222"){
    const t = $("toast"); if (!t) return;
    t.textContent = message; t.style.background = color; t.classList.add("show"); t.style.opacity = "1";
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(()=>{ t.style.opacity = "0"; t.classList.remove("show"); }, 3000);
  }

  function openModal({message, subtext="", buttons=[]}){
    const modal = $("confirmModal"); if (!modal) return;
    $("confirmMessage").textContent = message; $("confirmSub").textContent = subtext;
    const btns = $("confirmButtons"); btns.innerHTML = "";
    buttons.forEach(b=>{
      const el = document.createElement("button");
      el.textContent = b.label; el.className = "confirm-btn"; el.style.background = b.color || "#888";
      el.onclick = ()=>{ closeModal(); if(typeof b.onClick === "function") b.onClick(); };
      btns.appendChild(el);
    });
    modal.style.display = "flex"; setTimeout(()=> modal.classList.add("show"), 8);
  }

  function closeModal(){
    const modal = $("confirmModal"); if (!modal) return;
    modal.classList.remove("show"); setTimeout(()=> modal.style.display = "none", 180);
  }

  function showLoader(text = "Loading...") {
      const loader = $("loader"), loaderText = $("loader-text");
      if (loader) { loaderText.textContent = text; loader.style.display = "flex"; }
  }
  function hideLoader() { if ($("loader")) $("loader").style.display = "none"; }

  /* ------------------------
     TUTORIAL SYSTEM
  ------------------------ */
  let tutorialActive = false;
  let currentTutorialStep = 0;

  const tutorialSteps = [
    { title: "Welcome to TRM Shoe Tracker 👟", content: "This app helps you track your shoe inventory efficiently. Let's take a quick tour!", icon: `👟` },
    { title: "Adding Shoes", content: "1. Enter brand name<br>2. Enter color<br>3. Use the custom keyboard for sizes (e.g., '38-40' or '42*3')<br>4. Click Save", icon: `⌨️` },
    { title: "Managing Inventory", content: "Your shoes appear in the table below:<br>• Click ➕ to increase count<br>• Click ➖ to decrease count<br>• Click 🗑️ to delete an item", icon: `📊` },
    { title: "Search & Sort", content: "• Use the search box to filter by brand, color, or size<br>• Click column headers to sort (▲ for ascending, ▼ for descending)", icon: `🔍` },
    { title: "Export & Import", content: "• <strong>Export Options</strong>: Create JSON or Excel files<br>• <strong>Import JSON</strong>: Add or replace data<br>• <strong>Print Inventory</strong>: Generate PDF report", icon: `📥` },
    { title: "Catalog & Smart Suggestions", content: "• Click <strong>Update Catalog</strong> to upload your Official System CSV<br>• Get smart auto-complete suggestions as you type!", icon: `📚` }
  ];

  function showTutorial() { tutorialActive = true; currentTutorialStep = 0; showTutorialStep(currentTutorialStep); }

  function showTutorialStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= tutorialSteps.length) { hideTutorial(); return; }
    currentTutorialStep = stepIndex;
    const step = tutorialSteps[stepIndex];
    
    if ($("tutorialModal")) $("tutorialModal").remove();
    
    const tutorialModal = document.createElement("div");
    tutorialModal.id = "tutorialModal"; tutorialModal.className = "tutorial-modal";
    tutorialModal.innerHTML = `
      <div class="tutorial-content">
        <button id="tutorialClose" class="tutorial-close">&times;</button>
        <div class="tutorial-header"><div class="tutorial-icon">${step.icon}</div><h3 class="tutorial-title">${step.title}</h3><div class="tutorial-text">${step.content}</div></div>
        <div class="tutorial-dots">
            ${tutorialSteps.map((_, i) => `<div class="tutorial-dot ${i === stepIndex ? 'active' : ''}" onclick="showTutorialStep(${i})"></div>`).join('')}
        </div>
        <div class="tutorial-actions">
          <button id="tutorialPrev" class="btn-secondary" ${stepIndex === 0 ? 'disabled style="opacity:0.5"' : ''}>← Previous</button>
          <button id="tutorialNext" class="btn-primary">${stepIndex === tutorialSteps.length - 1 ? 'Finish 🎉' : 'Next →'}</button>
        </div>
        <div class="tutorial-skip"><button id="tutorialSkip" class="tutorial-skip-btn">Skip Tutorial</button></div>
      </div>
    `;
    document.body.appendChild(tutorialModal);
    
    $("tutorialClose").addEventListener("click", hideTutorial);
    $("tutorialSkip").addEventListener("click", hideTutorial);
    $("tutorialPrev").addEventListener("click", () => { if (currentTutorialStep > 0) showTutorialStep(currentTutorialStep - 1); });
    $("tutorialNext").addEventListener("click", () => { if (currentTutorialStep < tutorialSteps.length - 1) showTutorialStep(currentTutorialStep + 1); else hideTutorial(); });
  }

  function hideTutorial() {
    if ($("tutorialModal")) $("tutorialModal").remove();
    tutorialActive = false; localStorage.setItem('tutorialCompleted', 'true');
    addTutorialButton();
  }

  function addTutorialButton() {
    if ($("showTutorialBtn")) $("showTutorialBtn").remove();
    const headerActions = document.getElementById('header-actions');
    if (headerActions) {
      const tutorialBtn = document.createElement('button');
      tutorialBtn.id = 'showTutorialBtn'; tutorialBtn.className = 'btn-secondary'; tutorialBtn.textContent = 'ℹ️ Tutorial';
      tutorialBtn.style.padding = '0.5rem 1rem'; tutorialBtn.addEventListener('click', showTutorial);
      headerActions.appendChild(tutorialBtn);
    }
  }

  /* ------------------------
     SAVE & RENDER LOGIC
  ------------------------ */
  function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(() => {
      if (hasUnsavedChanges) { saveData(loadData()); $("autoSaveIndicator").classList.add("show"); setTimeout(() => $("autoSaveIndicator").classList.remove("show"), 2000); }
    }, AUTO_SAVE_INTERVAL);
  }
  function updateUnsavedWarning() { if ($("unsavedWarning")) $("unsavedWarning").style.display = hasUnsavedChanges ? "block" : "none"; }
  function markAsUnsaved() { hasUnsavedChanges = true; updateUnsavedWarning(); }

  function saveFormEntry() {
    const brandRaw = $("brand").value.trim(); const colorRaw = $("color").value.trim(); const sizesInput = $("sizes").value.trim();
    if(!brandRaw || !colorRaw || !sizesInput) return toast("❌ Please fill all fields", "#e74c3c");

    const brand = toTitleCase(brandRaw); const color = toTitleCase(colorRaw);

    if (masterCatalog) {
        const knownBrands = Object.keys(masterCatalog).map(b => b.toLowerCase());
        if (!knownBrands.includes(brand.toLowerCase())) {
            return openModal({
                message: "Brand Not Found", subtext: `"${brand}" is not in your catalog. Did you misspell it?`,
                buttons: [ { label: "Add Anyway", color: "var(--warning)", onClick: () => executeSave(brand, color, sizesInput) }, { label: "Fix Typo", color: "#888", onClick: () => $("brand").focus() } ]
            });
        }
        const knownColors = getColorsForBrand(brand).map(c => c.toLowerCase());
        if (knownColors.length > 0 && !knownColors.includes(color.toLowerCase())) {
             return openModal({
                message: "Color Not Found", subtext: `"${color}" is not a logged color for ${brand}.`,
                buttons: [ { label: "Add Anyway", color: "var(--warning)", onClick: () => executeSave(brand, color, sizesInput) }, { label: "Fix Typo", color: "#888", onClick: () => $("color").focus() } ]
            });
        }
    }
    executeSave(brand, color, sizesInput);
  }

  function executeSave(brand, color, sizesInput) {
      try {
          const sizes = parseSizes(sizesInput);
          if(sizes.length === 0) return toast("❌ No valid sizes found", "#e74c3c");

          const data = loadData(); const newIds = [];
          sizes.forEach(size => {
            const newRow = { brand, color, size, count: 1 };
            const key = mergeKey(newRow);
            const existing = data.findIndex(r => mergeKey(r) === key);
            if(existing >= 0) data[existing].count += 1;
            else { newRow.id = uid(); data.push(newRow); newIds.push(newRow.id); }
          });
          
          if (!saveData(data)) return false;
          markAsUnsaved();
          $("brand").value = ''; $("color").value = ''; $("sizes").value = '';
          if (window.clearSizesDisplay) window.clearSizesDisplay();
          render($("searchBox").value, newIds);
          toast("✅ Saved successfully", "#27ae60");
      } catch(err) { toast(`❌ ${err.message}`, "#e74c3c"); }
  }

  let currentSort = { key: null, dir: "asc" };

  function render(filter="", highlightIds=[]){
    const tbody = $("tableBody"); if (!tbody) return;
    tbody.innerHTML = ""; let rows = loadData();

    const totalPairs = rows.reduce((acc, r) => acc + (parseInt(r.count) || 0), 0);
    const uniqueBrands = new Set(rows.map(r => r.brand.toLowerCase())).size;
    if($("stat-total-items")) $("stat-total-items").textContent = totalPairs;
    if($("stat-total-brands")) $("stat-total-brands").textContent = uniqueBrands;
    if($("totalCount")) $("totalCount").textContent = totalPairs;

    if(currentSort.key){
      const k = currentSort.key;
      rows = rows.sort((a,b)=>{
        let A = a[k], B = b[k];
        if (k === 'size') {
            A = parseFloat(A.includes('/') ? A.split('/')[0]/A.split('/')[1] : A) || A;
            B = parseFloat(B.includes('/') ? B.split('/')[0]/B.split('/')[1] : B) || B;
        }
        if (typeof A === "string") A = A.toLowerCase(); if (typeof B === "string") B = B.toLowerCase();
        if(A < B) return currentSort.dir === "asc" ? -1 : 1;
        if(A > B) return currentSort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const q = String(filter||"").trim().toLowerCase();
    const view = q ? rows.filter(r => r.brand.toLowerCase().includes(q) || r.color.toLowerCase().includes(q) || r.size.toLowerCase().includes(q)) : rows;
    const fragment = document.createDocumentFragment();

    if (view.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">${q ? 'No items match your search' : 'No shoes in inventory.'}</td>`;
      fragment.appendChild(tr);
    } else {
      view.forEach(r => {
        const tr = document.createElement("tr");
        tr.dataset.id = r.id; tr.className = highlightIds.includes(r.id) ? "data-row row-add" : "data-row";
        tr.innerHTML = `
          <td data-label="Brand">${highlightText(r.brand, q)}</td>
          <td data-label="Color">${highlightText(r.color, q)}</td>
          <td data-label="Size">${highlightText(r.size, q)}</td>
          <td data-label="Count">${r.count}</td>
          <td class="no-print" style="display:flex; gap:0.5rem; justify-content:center;">
            <button class="btn-increase btn-icon" data-id="${r.id}" style="background:var(--success); color:white;">➕</button>
            <button class="btn-decrease btn-icon" data-id="${r.id}" style="background:var(--warning); color:white;">➖</button>
            <button class="btn-delete btn-icon" data-id="${r.id}" style="background:var(--danger); color:white;">🗑️</button>
          </td>`;
        fragment.appendChild(tr);
      });
    }

    tbody.appendChild(fragment);
    if(highlightIds.length) setTimeout(() => document.querySelectorAll('.row-add').forEach(el => el.classList.remove('row-add')), 1200); 
    updateDatalists();
    
    document.querySelectorAll("th[data-key]").forEach(th=>{
      const arrow = th.querySelector(".arrow"); if (!arrow) return;
      if(currentSort.key === th.dataset.key){ arrow.textContent = currentSort.dir === "asc" ? "▲" : "▼"; arrow.style.color = "var(--primary)"; } 
      else { arrow.textContent = "↕"; arrow.style.color = "var(--border)"; }
    });
  }

  function updateDatalists(){
      const bDL = $("brands"); if(bDL){ bDL.innerHTML = ""; getAllBrands().forEach(b=> bDL.append(new Option(b, b))); }
      updateColorDatalist($("brand")?.value?.trim() || "");
  }

  function updateColorDatalist(brand) {
      const cDL = $("colors"); if (cDL) { cDL.innerHTML = ""; getColorsForBrand(brand).forEach(c => cDL.append(new Option(c, c))); }
  }

  // Row operations
  function increaseById(id){
    const data = loadData(); const idx = data.findIndex(x => x.id === id);
    if (idx === -1) return; data[idx].count += 1; saveData(data); markAsUnsaved(); render($("searchBox").value);
  }

  function decreaseById(id){
    const data = loadData(); const idx = data.findIndex(x=>x.id===id);
    if(idx===-1) return;
    if(data[idx].count > 1){ data[idx].count -= 1; saveData(data); markAsUnsaved(); render($("searchBox").value); } 
    else { deleteById(id); }
  }

  function deleteById(id){
    const data = loadData(); const item = data.find(r=>r.id===id); if(!item) return;
    openModal({ message: `Delete ${item.brand} ${item.color} size ${item.size}?`, buttons:[ 
        { label:"Delete", color: "var(--danger)", onClick: ()=>{
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if(row){
                row.classList.add("fade-out");
                row.addEventListener("animationend", ()=>{
                    saveData(loadData().filter(r=>r.id!==id)); markAsUnsaved(); render($("searchBox").value); toast("🗑️ Deleted", "#e74c3c");
                }, {once:true});
            } else { saveData(loadData().filter(r=>r.id!==id)); markAsUnsaved(); render($("searchBox").value); }
        }}, 
        { label:"Cancel", color:"#888", onClick: ()=> {} } 
    ]});
  }

  /* ------------------------
     IMPORT, EXPORT & MERGE
  ------------------------ */
  function exportJson(){
    const data = loadData(); if(!data.length) return toast("❌ No data", "#e74c3c");
    const blob = new Blob([JSON.stringify({notes: $("exportNotes")?.value, data}, null, 2)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Tally_${new Date().toISOString().slice(0,10)}.json`; a.click();
  }

  function exportExcel(){
    const data = loadData(); if(!data.length) return toast("❌ No data", "#e74c3c");
    showLoader("Generating Excel...");
    setTimeout(() => {
        const wsData = [["Brand", "Color", "Size", "Count"]];
        data.forEach(item => wsData.push([item.brand, item.color, item.size, item.count]));
        if(typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
            XLSX.writeFile(wb, `Tally_${new Date().toISOString().slice(0,10)}.xlsx`);
            hideLoader(); toast("📊 Excel exported", "#27ae60");
        } else { hideLoader(); toast("❌ XLSX Library missing", "#e74c3c"); }
    }, 500);
  }

  function printPDF(){
    const data = loadData(); if(!data.length) return toast("❌ No data", "#e74c3c");
    showLoader("Generating PDF...");
    setTimeout(() => {
        const notes = $("exportNotes").value.trim();
        const pdfContent = `
          <div style="font-family: Arial, sans-serif; color: #000; background: #fff;">
            <style> body, table, th, td, div, p { color: #000 !important; background: #fff !important; } table { border-color: #000 !important; } th, td { border: 1px solid #000 !important; } th { background-color: #f0f0f0 !important; font-weight: bold; } </style>
            <h1 style="text-align:center; color:#000;">TRM Shoe Tracker - Inventory Report</h1>
            <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; margin-bottom:20px; text-align:center; font-size:0.9rem; border: 1px solid #000;">
              <thead><tr style="background:#f0f0f0;"><th>Brand</th><th>Color</th><th>Size</th><th>Count</th></tr></thead>
              <tbody>${data.map(row => `<tr><td>${escapeHtml(row.brand)}</td><td>${escapeHtml(row.color)}</td><td>${escapeHtml(row.size)}</td><td>${row.count}</td></tr>`).join('')}</tbody>
            </table>
            ${notes ? `<div style="padding:10px; border-left:4px solid #2980b9; background:#f9f9f9; margin-top:20px; color: #000;"><strong>Notes:</strong><br>${escapeHtml(notes)}</div>` : ''}
          </div>`;
        const opt = { margin: 0.5, filename: `Report_${new Date().toISOString().slice(0,10)}.pdf`, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        if(typeof html2pdf !== 'undefined') html2pdf().from(pdfContent).set(opt).save().then(() => hideLoader());
        else { hideLoader(); toast("❌ PDF Library missing", "#e74c3c"); }
    }, 500);
  }

  function mergeData(importedData) {
    try {
      const existingData = loadData();
      const mergedData = [...existingData];
      const newIds = [];
      importedData.forEach(importedItem => {
        const normalizedItem = normalizeRow(importedItem);
        const key = mergeKey(normalizedItem);
        const existingIndex = mergedData.findIndex(item => mergeKey(item) === key);
        if (existingIndex >= 0) mergedData[existingIndex].count += normalizedItem.count;
        else { mergedData.push(normalizedItem); newIds.push(normalizedItem.id); }
      });
      if (saveData(mergedData)) { render($("searchBox").value, newIds); return true; }
      return false;
    } catch (error) { return false; }
  }

  // --- INITIALIZATION ---
  function initialize() {
    loadCatalog(); 
    loadNotes();
    loadHalfSizePreference();
    startAutoSave();
    
    // Table Listeners
    if ($("tableBody")) $("tableBody").addEventListener("click", ev => {
        const inc = ev.target.closest(".btn-increase"), dec = ev.target.closest(".btn-decrease"), del = ev.target.closest(".btn-delete");
        if(inc) return increaseById(inc.dataset.id); if(dec) return decreaseById(dec.dataset.id); if(del) return deleteById(del.dataset.id);
    });

    document.querySelectorAll("th[data-key]").forEach(th=>{
      th.addEventListener("click", function(){
        if(currentSort.key === th.dataset.key) currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
        else currentSort = { key: th.dataset.key, dir: "asc" };
        render($("searchBox").value);
      });
    });

    if ($("searchBox")) $("searchBox").addEventListener("input", e => render(e.target.value));
    
    // Notes Toolbar
    if($("exportNotes")) $("exportNotes").addEventListener("input", () => { saveNotes(); markAsUnsaved(); });
    
    if($("fmtBold") && $("fmtItalic") && $("fmtList")) {
      const insertFormat = (before, after) => {
        const en = $("exportNotes"); const start = en.selectionStart; const end = en.selectionEnd;
        const text = en.value; const selection = text.substring(start, end);
        en.value = text.substring(0, start) + before + selection + after + text.substring(end);
        en.focus(); en.selectionStart = start + before.length; en.selectionEnd = end + before.length;
        saveNotes(); markAsUnsaved();
      };
      $("fmtBold").addEventListener("click", () => insertFormat("**", "**"));
      $("fmtItalic").addEventListener("click", () => insertFormat("*", "*"));
      $("fmtList").addEventListener("click", () => {
         const en = $("exportNotes"); const start = en.selectionStart; const end = en.selectionEnd; const text = en.value;
         if(start === end) insertFormat("\n- ", "");
         else {
           const formatted = text.substring(start, end).split('\n').map(l => `- ${l}`).join('\n');
           en.value = text.substring(0, start) + formatted + text.substring(end); saveNotes(); markAsUnsaved();
         }
      });
    }

    // Half Sizes Checkbox
    if ($("includeHalfSizes")) $("includeHalfSizes").addEventListener("change", function() { saveHalfSizePreference(); updateInputCount(); });

    // Buttons
    if ($("exportBtn")) {
      $("exportBtn").addEventListener("click", function(){
        openModal({ message: "Export Options", buttons:[
            { label:"JSON", color:"#8e44ad", onClick: exportJson },
            { label:"Excel", color:"#27ae60", onClick: exportExcel },
            { label:"Cancel", color:"#888", onClick: ()=>{} }
        ]});
      });
    }

    if ($("importBtn") && $("jsonFileInput")) {
      $("importBtn").addEventListener("click", () => $("jsonFileInput").click());
      $("jsonFileInput").addEventListener("change", e => {
          const file = e.target.files[0]; if(!file) return;
          showLoader("Importing...");
          const reader = new FileReader();
          reader.onload = ev => {
              try {
                  const json = JSON.parse(ev.target.result);
                  if(json.length === 0) { hideLoader(); return toast("⚠️ Empty file", "#f39c12"); }
                  hideLoader();
                  openModal({ message: "Import Options", subtext: "Merge with current data, or replace everything?", buttons:[
                      { label:"Merge", color:"#27ae60", onClick: ()=> { if(mergeData(json)) toast("✅ Merged", "#27ae60"); } },
                      { label:"Replace", color:"#e74c3c", onClick: ()=> { if(saveData(json)) { render(); toast("✅ Replaced", "#27ae60"); } } },
                      { label:"Cancel", color:"#888", onClick: ()=>{} }
                  ]});
              } catch(err) { hideLoader(); toast("❌ Invalid JSON", "#e74c3c"); }
          };
          reader.readAsText(file); e.target.value = "";
      });
    }

    if ($("clearBtn")) {
      $("clearBtn").addEventListener("click", () => {
          if(!loadData().length) return toast("ℹ️ Already empty", "#888");
          openModal({ message: "Clear all items?", subtext: "This cannot be undone.", buttons:[
              { label:"Clear All", color:"#e74c3c", onClick: ()=> { saveData([]); $("exportNotes").value = ""; saveNotes(); render(); toast("🧹 Cleared", "#888"); } },
              { label:"Cancel", color:"#888", onClick: ()=>{} }
          ]});
      });
    }

    if ($("printBtn")) $("printBtn").addEventListener("click", printPDF);

    if ($("updateCatalogBtn") && $("catalogFileInput")) {
      $("updateCatalogBtn").addEventListener("click", () => $("catalogFileInput").click());
      $("catalogFileInput").addEventListener("change", handleCatalogUpload);
    }

    // Theme Switcher
    if ($("themeToggleBtn")) {
        const savedTheme = localStorage.getItem("shoe_tracker_theme");
        if (savedTheme) document.body.classList.add(savedTheme);
        $("themeToggleBtn").addEventListener("click", () => {
            const isDark = document.body.classList.contains("dark-mode");
            document.body.classList.remove(isDark ? "dark-mode" : "light-mode");
            document.body.classList.add(isDark ? "light-mode" : "dark-mode");
            localStorage.setItem("shoe_tracker_theme", isDark ? "light-mode" : "dark-mode");
        });
    }

    // Inputs
    if ($("brand")) {
      $("brand").addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $("color").focus(); } });
      $("brand").addEventListener('input', e => updateColorDatalist(e.target.value.trim()));
    }
    if ($("color")) {
      $("color").addEventListener('keydown', e => { 
          if (e.key === 'Enter') { e.preventDefault(); if ($("sizes-display")) $("sizes-display").style.borderColor = "var(--primary)"; } 
      });
    }

    if (!localStorage.getItem('tutorialCompleted')) setTimeout(showTutorial, 1500); else addTutorialButton();
    window.addEventListener('beforeunload', e => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; return ''; } });
    
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize); else initialize();

  window.saveFormEntry = saveFormEntry; 
  window.calculateInputCount = calculateInputCount;
})();

// ========================
// CUSTOM KEYBOARD FUNCTIONALITY
// ========================

document.addEventListener('DOMContentLoaded', function() {
  try {
    const sizesHiddenInput = document.getElementById('sizes-hidden');
    const sizesDisplay = document.getElementById('sizes-display');
    const sizesValueSpan = document.getElementById('sizes-value');
    const sizesPlaceholderSpan = document.getElementById('sizes-placeholder');
    const sizesRealInput = document.getElementById('sizes');
    const cursorSpan = document.getElementById('sizes-cursor');
    const textBeforeSpan = document.getElementById('sizes-text-before');
    const textAfterSpan = document.getElementById('sizes-text-after');
    const keyButtons = document.querySelectorAll('.key-btn');
    const backspaceBtn = document.querySelector('.key-btn.backspace');
    const doneBtn = document.querySelector('.key-btn.done');
    const clearBtn = document.querySelector('.key-btn.clear');
    const arrowLeftBtn = document.querySelector('.key-btn.arrow-left');
    const arrowRightBtn = document.querySelector('.key-btn.arrow-right');
    
    if (!sizesRealInput) return;
    
    let cursorPosition = 0;
    let isCursorVisible = false;
    
    updateRealInput(sizesRealInput.value || '');
    
    function updateCursor() {
      try {
        const value = sizesRealInput.value;
        const beforeText = value.substring(0, cursorPosition);
        const afterText = value.substring(cursorPosition);
        
        if (value) {
          sizesValueSpan.textContent = '';
          sizesPlaceholderSpan.style.display = 'none';
          textBeforeSpan.textContent = beforeText;
          textAfterSpan.textContent = afterText;
          textBeforeSpan.style.display = 'inline';
          cursorSpan.style.display = 'inline-block';
          textAfterSpan.style.display = 'inline';
          if (!isCursorVisible) {
            isCursorVisible = true;
            cursorSpan.style.animation = 'blink 1s infinite';
          }
        } else {
          sizesValueSpan.textContent = '';
          textBeforeSpan.style.display = 'none';
          cursorSpan.style.display = 'none';
          textAfterSpan.style.display = 'none';
          sizesPlaceholderSpan.style.display = 'inline';
        }
      } catch (error) {}
    }
    
    function updateRealInput(value) {
      try {
        if (sizesRealInput) sizesRealInput.value = value;
        cursorPosition = Math.min(cursorPosition, value.length);
        updateCursor();
        
        const inputCount = document.getElementById("inputCount");
        if (inputCount) {
          const count = window.calculateInputCount ? window.calculateInputCount(value) : 0;
          inputCount.textContent = `Input count: ${count}`;
        }
        
        if (value) {
          sizesDisplay.style.borderColor = "var(--accent)";
          sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
        } else {
          sizesDisplay.style.borderColor = "";
          sizesDisplay.style.boxShadow = "";
        }
      } catch (error) {}
    }
    
    function clearSizesDisplay() { cursorPosition = 0; updateRealInput(''); }
    
    sizesDisplay.addEventListener('click', function(e) {
      try {
        if (!sizesRealInput.value) {
          sizesDisplay.style.borderColor = "var(--accent)";
          sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
          return;
        }
        const rect = sizesDisplay.getBoundingClientRect();
        const clickX = e.clientX - rect.left - 10;
        const approxChars = Math.floor(clickX / 8);
        cursorPosition = Math.max(0, Math.min(sizesRealInput.value.length, approxChars));
        updateCursor();
        sizesDisplay.style.borderColor = "var(--accent)";
        sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
        if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
      } catch (error) {}
    });
    
    keyButtons.forEach(button => {
      if (button.classList.contains('backspace') || button.classList.contains('done') || button.classList.contains('clear') || button.classList.contains('arrow-left') || button.classList.contains('arrow-right')) return;
      button.addEventListener('click', function() {
        try {
          const key = this.getAttribute('data-key');
          const currentValue = sizesRealInput.value;
          const newValue = currentValue.substring(0, cursorPosition) + key + currentValue.substring(cursorPosition);
          cursorPosition += key.length;
          updateRealInput(newValue);
          if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
        } catch (error) {}
      });
    });
    
    if (arrowLeftBtn) arrowLeftBtn.addEventListener('click', function() { if (cursorPosition > 0) { cursorPosition--; updateCursor(); } });
    if (arrowRightBtn) arrowRightBtn.addEventListener('click', function() { if (cursorPosition < sizesRealInput.value.length) { cursorPosition++; updateCursor(); } });
    
    if (backspaceBtn) {
      let backspaceTimeout = null, backspaceInterval = null, isLongPressActive = false;
      const startBackspace = () => {
        if (cursorPosition > 0) {
          const currentValue = sizesRealInput.value;
          const newValue = currentValue.substring(0, cursorPosition - 1) + currentValue.substring(cursorPosition);
          cursorPosition--; updateRealInput(newValue);
        }
      };
      const handleBackspaceStart = (e) => {
        isLongPressActive = false;
        backspaceTimeout = setTimeout(() => { isLongPressActive = true; startBackspace(); backspaceInterval = setInterval(startBackspace, 100); }, 500);
      };
      const handleBackspaceEnd = () => { clearTimeout(backspaceTimeout); clearInterval(backspaceInterval); backspaceTimeout = null; backspaceInterval = null; isLongPressActive = false; };
      
      backspaceBtn.addEventListener('mousedown', handleBackspaceStart);
      backspaceBtn.addEventListener('mouseup', handleBackspaceEnd);
      backspaceBtn.addEventListener('mouseleave', handleBackspaceEnd);
      backspaceBtn.addEventListener('touchstart', handleBackspaceStart);
      backspaceBtn.addEventListener('touchend', handleBackspaceEnd);
      backspaceBtn.addEventListener('touchcancel', handleBackspaceEnd);
      backspaceBtn.addEventListener('click', function(e) { if (!isLongPressActive && !backspaceInterval) startBackspace(); });
    }
    
    if (clearBtn) clearBtn.addEventListener('click', clearSizesDisplay);
    
    if (doneBtn) {
      doneBtn.addEventListener('click', function() {
        try {
          if (typeof window.saveFormEntry === 'function') window.saveFormEntry();
          else { const form = document.getElementById('entryForm'); if (form) form.dispatchEvent(new Event('submit')); }
          sizesDisplay.style.borderColor = ""; sizesDisplay.style.boxShadow = "";
          if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
        } catch (error) {}
      });
    }
    
    sizesDisplay.addEventListener('dblclick', clearSizesDisplay);
    updateCursor();
    
    window.clearSizesDisplay = clearSizesDisplay;
    window.updateCursor = updateCursor;
    window.cursorPosition = cursorPosition;
    window.updateRealInput = updateRealInput;
    
  } catch (error) {}
});
