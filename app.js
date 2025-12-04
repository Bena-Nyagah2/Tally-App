//App.js
(function() {
  /* ------------------------
     STORAGE + HELPERS
  ------------------------ */
  const STORE_KEY = "shoe_entries_json_v11.0";
  const NOTES_KEY = "shoe_tracker_notes_v1";
  const HALF_SIZE_KEY = "shoe_tracker_halfsize_v1";
  const AUTO_SAVE_INTERVAL = 20000; // 20 seconds
  let hasUnsavedChanges = false;
  let autoSaveTimer = null;
  let backspaceInterval = null;
  let isBackspaceLongPress = false;

  function uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  }

  function normalizeRow(r){
    return {
      id: r.id || uid(),
      brand: String(r.brand||"").trim(),
      color: String(r.color||"").trim(),
      size: String(r.size||"").trim(),
      count: Number(r.count) || 1
    };
  }

  function loadData(){
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return [];
    try{
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return [];
      const normalized = arr.map(normalizeRow);
      localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
      return normalized;
    }catch(e){ console.warn("loadData parse error", e); return []; }
  }

  function saveData(arr){
    const clean = arr.map(normalizeRow);
    localStorage.setItem(STORE_KEY, JSON.stringify(clean));
    saveNotes(); // Save notes along with data
    hasUnsavedChanges = false;
    updateUnsavedWarning();
  }

  function mergeKey(row){
    return `${String(row.brand||"").toLowerCase()}|${String(row.color||"").toLowerCase()}|${String(row.size||"").toLowerCase()}`;
  }

  /* ------------------------
     HTML ESCAPE FUNCTION
  ------------------------ */
  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  /* ------------------------
     NOTES AND PREFERENCES MANAGEMENT
  ------------------------ */
  function loadNotes() {
    const notes = localStorage.getItem(NOTES_KEY);
    if (notes) {
      document.getElementById("exportNotes").value = notes;
    }
  }

  function saveNotes() {
    const notes = document.getElementById("exportNotes").value.trim();
    localStorage.setItem(NOTES_KEY, notes);
  }

  function loadHalfSizePreference() {
    const saved = localStorage.getItem(HALF_SIZE_KEY);
    const checkbox = document.getElementById("includeHalfSizes");
    if (saved !== null) {
      checkbox.checked = saved === 'true';
    } else {
      checkbox.checked = false; // Default to unchecked
      localStorage.setItem(HALF_SIZE_KEY, 'false');
    }
  }

  function saveHalfSizePreference() {
    const checkbox = document.getElementById("includeHalfSizes");
    localStorage.setItem(HALF_SIZE_KEY, checkbox.checked.toString());
  }

  /* ------------------------
     INPUT COUNT CALCULATION
  ------------------------ */
  function calculateInputCount(input) {
  if (!input.trim()) return 0;
  
  try {
    const sizes = parseSizes(input);
    return sizes.length;
  } catch (err) {
    console.error("Error calculating input count:", err);
    return 0;
  }
}

  function updateInputCount() {
    const input = document.getElementById("sizes").value;
    const count = calculateInputCount(input);
    document.getElementById("inputCount").textContent = `Input count: ${count}`;
  }

  /* ------------------------
     ENHANCED SIZE PARSING
  ------------------------ */
  function parseSizes(input) {
    const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
    const step = includeHalfSizes ? 0.5 : 1;
    const rawSizes = input.split(',').map(s => s.trim()).filter(Boolean);
    const sizes = [];
    
    for (const size of rawSizes) {
      // Handle quantity specification with * (e.g., "42*3", "6/7*2")
      if (size.includes('*')) {
        const parts = size.split('*').map(s => s.trim());
        if (parts.length === 2 && !isNaN(parts[1])) {
          const sizeValue = parts[0];
          const quantity = parseInt(parts[1], 10);
          
          // Parse the size value (could be a range, fraction, etc.)
          const parsedSizes = parseSingleSize(sizeValue, step);
          
          for (let i = 0; i < quantity; i++) {
            parsedSizes.forEach(s => sizes.push(s));
          }
          continue;
        }
      }
      
      // Handle regular sizes (ranges, fractions, etc.)
      const parsed = parseSingleSize(size, step);
      parsed.forEach(s => sizes.push(s));
    }
    
    return sizes;
  }

  function parseSingleSize(size, step) {
  const sizes = [];
  
  // Handle size ranges like "6/7" (treat as a single size)
  if (size.includes('/')) {
    sizes.push(size);
    return sizes;
  }
  
  // Handle size ranges like "38-40" or "10.5-12.5"
  if (size.includes('-')) {
    const parts = size.split('-').map(s => s.trim());
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      const start = parseFloat(parts[0]);
      const end = parseFloat(parts[1]);
      
      // Handle both ascending and descending ranges
      if (start !== end) {
        const isAscending = start < end;
        const stepSize = isAscending ? step : -step;
        const compareFunc = isAscending ? (a, b) => a <= b : (a, b) => a >= b;
        
        // Add all sizes in the range
        for (let s = start; compareFunc(s, end); s += stepSize) {
          // Check if it's a whole number or needs decimal
          sizes.push(s % 1 === 0 ? s.toString() : s.toFixed(1));
        }
        return sizes;
      } else {
        // Single size with dash? Just add it once
        sizes.push(start.toString());
        return sizes;
      }
    }
  }
  
  // Handle decimal sizes like "10.5"
  if (!isNaN(parseFloat(size)) && isFinite(size)) {
    sizes.push(parseFloat(size).toString());
    return sizes;
  }
  
  // If none of the above, just add the raw value
  sizes.push(size);
  return sizes;
}

  /* ------------------------
     UI: toast + modal
  ------------------------ */
  const $ = id => document.getElementById(id);

  function toast(message, color="#222"){
    const t = $("toast");
    t.textContent = message;
    t.style.background = color;
    t.classList.add("show");
    t.style.opacity = "1";
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(()=>{
      t.style.opacity = "0";
      t.classList.remove("show");
    }, 3000);
  }

  function openModal({message, subtext="", buttons=[]}){
    const modal = $("confirmModal");
    $("confirmMessage").textContent = message;
    $("confirmSub").textContent = subtext || "";
    const btns = $("confirmButtons");
    btns.innerHTML = "";
    buttons.forEach(b=>{
      const el = document.createElement("button");
      el.textContent = b.label;
      el.className = "confirm-btn";
      el.style.background = b.color || "#888";
      el.onclick = ()=>{ closeModal(); if(typeof b.onClick === "function") b.onClick(); };
      btns.appendChild(el);
    });
    modal.style.display = "flex";
    setTimeout(()=> modal.classList.add("show"), 8);
  }

  function closeModal(){
    const modal = $("confirmModal");
    modal.classList.remove("show");
    setTimeout(()=> modal.style.display = "none", 180);
  }

  /* ------------------------
     AUTO-SAVE FUNCTIONALITY
  ------------------------ */
  function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    
    autoSaveTimer = setInterval(() => {
      if (hasUnsavedChanges) {
        const data = loadData();
        saveData(data);
        saveNotes(); // Also save notes on auto-save
        showAutoSaveIndicator();
      }
    }, AUTO_SAVE_INTERVAL);
  }
  
  function showAutoSaveIndicator() {
    const indicator = $("autoSaveIndicator");
    indicator.classList.add("show");
    setTimeout(() => {
      indicator.classList.remove("show");
    }, 2000);
  }
  
  function updateUnsavedWarning() {
    const warning = $("unsavedWarning");
    if (hasUnsavedChanges) {
      warning.style.display = "block";
    } else {
      warning.style.display = "none";
    }
  }
  
  function markAsUnsaved() {
    hasUnsavedChanges = true;
    updateUnsavedWarning();
  }

  /* ------------------------
     RENDER / SORT / FILTER
  ------------------------ */
  let currentSort = { key: null, dir: "asc" };

  function updateDatalists(){
    const data = loadData();
    const brands = [...new Set(data.map(d=>d.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const colors = [...new Set(data.map(d=>d.color).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const bDL = $("brands"), cDL = $("colors");
    if(bDL && cDL){
      bDL.innerHTML = ""; cDL.innerHTML = "";
      brands.forEach(b=> bDL.append(new Option(b,b)));
      colors.forEach(c=> cDL.append(new Option(c,c)));
    }
  }

  function highlightText(text, searchTerm) {
    if (!searchTerm) return escapeHtml(text);
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
  }

  function render(filter="", highlightIds=[]){
    const tbody = $("tableBody");
    tbody.innerHTML = "";
    let rows = loadData();

    if(currentSort.key){
      const k = currentSort.key;
      rows = rows.slice().sort((a,b)=>{
        let A = a[k], B = b[k];
        
        // Special sorting for sizes that might be fractions or ranges
        if (k === 'size') {
          // Convert fractions to decimals for proper sorting
          if (A.includes('/')) {
            const parts = A.split('/');
            A = parts[0] / parts[1];
          }
          if (B.includes('/')) {
            const parts = B.split('/');
            B = parts[0] / parts[1];
          }
        }
        
        if(typeof A === "string") A = A.toLowerCase();
        if(typeof B === "string") B = B.toLowerCase();
        if(A < B) return currentSort.dir === "asc" ? -1 : 1;
        if(A > B) return currentSort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const q = String(filter||"").trim().toLowerCase();
    const view = q ? rows.filter(r => 
      r.brand.toLowerCase().includes(q) || 
      r.color.toLowerCase().includes(q) || 
      r.size.toLowerCase().includes(q)
    ) : rows;

    view.forEach(r => {
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;
      tr.className = "data-row";
      
      // Highlight search terms in the table
      const brandHtml = highlightText(r.brand, q);
      const colorHtml = highlightText(r.color, q);
      const sizeHtml = highlightText(r.size, q);
      
      tr.innerHTML = `
        <td>${brandHtml}</td>
        <td>${colorHtml}</td>
        <td>${sizeHtml}</td>
        <td>${r.count}</td>
        <td class="no-print" style="display:flex;gap:8px; justify-content:center">
          <button class="btn-increase" data-id="${r.id}" style="background:#27ae60;padding:6px 10px;border-radius:8px;color:#fff;font-weight:800">➕</button>
          <button class="btn-decrease" data-id="${r.id}" style="background:#f39c12;padding:6px 10px;border-radius:8px;color:#fff;font-weight:800">➖</button>
          <button class="btn-delete" data-id="${r.id}" style="background:#e74c3c;padding:6px 10px;border-radius:8px;color:#fff;font-weight:800">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });

    if(Array.isArray(highlightIds) && highlightIds.length){
      highlightIds.forEach(id=>{
        const row = tbody.querySelector(`tr[data-id="${id}"]`);
        if(row){
          row.classList.add("row-add");
          setTimeout(()=> row.classList.remove("row-add"), 1200);
        }
      });
    }

    // Update sorting arrows with colors and directions
    document.querySelectorAll("th[data-key]").forEach(th=>{
      const arrow = th.querySelector(".arrow");
      if(currentSort.key === th.dataset.key){
        if(currentSort.dir === "asc"){
          th.classList.add("sort-asc");
          th.classList.remove("sort-desc");
          arrow.textContent = "▲"; // up triangle
          arrow.style.color = "var(--ok)"; // green
        } else {
          th.classList.add("sort-desc");
          th.classList.remove("sort-asc");
          arrow.textContent = "▼"; // down triangle
          arrow.style.color = "var(--danger)"; // red
        }
      } else {
        arrow.textContent = "▲";
        arrow.style.color = "#aaa"; // neutral color
        th.classList.remove("sort-asc","sort-desc");
      }
    });

    updateDatalists();
  }

  /* ------------------------
     INCREASE / DECREASE / DELETE
  ------------------------ */
  function increaseById(id){
    const data = loadData();
    const idx = data.findIndex(x => x.id === id);
    if (idx === -1) return;
    
    data[idx].count += 1;
    saveData(data);
    markAsUnsaved();
    render(document.getElementById("searchBox").value);
  }

  function decreaseById(id){
    const data = loadData();
    const idx = data.findIndex(x=>x.id===id);
    if(idx===-1) return;
    if(data[idx].count > 1){
      data[idx].count -= 1;
      saveData(data);
      markAsUnsaved();
      render($("searchBox").value);
    } else {
      openModal({
        message: `Delete ${data[idx].brand} ${data[idx].color} size ${data[idx].size}?`,
        buttons:[
          { label:"Delete", color: "var(--danger)", onClick: ()=> animateDeleteById(id) },
          { label:"Cancel", color:"#888", onClick: ()=>{} }
        ]
      });
    }
  }

  function animateDeleteById(id){
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if(!row){
      const newData = loadData().filter(r=>r.id!==id);
      saveData(newData);
      markAsUnsaved();
      render($("searchBox").value);
      toast("🗑️ Deleted", "#e74c3c");
      return;
    }
    row.classList.add("row-delete-flash");
    setTimeout(()=>{
      row.classList.add("fade-out");
      row.addEventListener("animationend", ()=>{
        const newData = loadData().filter(r=>r.id!==id);
        saveData(newData);
        markAsUnsaved();
        render($("searchBox").value);
        toast("🗑️ Deleted", "#e74c3c");
      }, {once:true});
    }, 700);
  }

  function deleteById(id){
    const data = loadData();
    const item = data.find(r=>r.id===id);
    if(!item) return;
    openModal({
      message: `Delete ${item.brand} ${item.color} size ${item.size}?`,
      buttons:[
        { label:"Delete", color: "var(--danger)", onClick: ()=> animateDeleteById(id) },
        { label:"Cancel", color:"#888", onClick: ()=> {} }
      ]
    });
  }

  /* ------------------------
     CUSTOM KEYBOARD MANAGEMENT
  ------------------------ */
  function clearSizesInput() {
    updateRealInput('');
  }

  function activateSizesBox(showKeyboard = false) {
  const sizesDisplay = document.getElementById("sizes-display");
  
  if (sizesDisplay) {
    sizesDisplay.style.borderColor = "var(--accent)";
    sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
  }
  
  // Don't focus anything - that's what causes keyboard to show
  // But don't aggressively blur everything, just inputs
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    document.activeElement.blur();
  }
}

  /* ------------------------
     KEYBOARD PREVENTION
  ------------------------ */
  
function preventMobileKeyboard() {
  const sizesHiddenInput = document.getElementById('sizes-hidden');
  if (!sizesHiddenInput) return;
  
  // Only prevent focus on the hidden input
  sizesHiddenInput.addEventListener('focus', function(e) {
    e.preventDefault();
    this.blur();
    return false;
  });
  
  // Don't prevent touchstart on the hidden input itself - let it through
  // But prevent the default keyboard behavior
  sizesHiddenInput.addEventListener('touchstart', function(e) {
    // Don't prevent default here, just blur immediately
    this.blur();
  });
  
  // Don't prevent mousedown/click on the display div
  // Only prevent on the actual hidden input
  
  // For custom keyboard buttons, don't prevent events entirely
  // Just prevent the default behavior that might trigger keyboard
  document.querySelectorAll('.key-btn').forEach(button => {
    button.addEventListener('touchstart', function(e) {
      // Don't prevent default - let the click event fire
      // Just ensure no input gets focus
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    });
  });
}
  function updateRealInput(value) {
    const sizesRealInput = document.getElementById("sizes");
    const sizesValueSpan = document.getElementById("sizes-value");
    const sizesPlaceholderSpan = document.getElementById("sizes-placeholder");
    const sizesDisplay = document.getElementById("sizes-display");
    
    if (sizesRealInput) {
      sizesRealInput.value = value;
    }
    
    if (sizesValueSpan && sizesPlaceholderSpan) {
      if (value) {
        sizesValueSpan.textContent = value;
        sizesValueSpan.style.display = 'inline';
        sizesPlaceholderSpan.style.display = 'none';
        if (sizesDisplay) {
          sizesDisplay.style.borderColor = "var(--accent)";
          sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
        }
      } else {
        sizesValueSpan.textContent = '';
        sizesValueSpan.style.display = 'none';
        sizesPlaceholderSpan.style.display = 'inline';
        if (sizesDisplay) {
          sizesDisplay.style.borderColor = "";
          sizesDisplay.style.boxShadow = "";
        }
      }
    }
    
    updateInputCount();
  }

  /* ------------------------
     EVENT DELEGATION - EXECUTE IMMEDIATELY
  ------------------------ */

  // Start auto-save functionality
  startAutoSave();
  
  // Load saved notes and half-size preference on startup
  loadNotes();
  loadHalfSizePreference();
  
  // Fix for table body event delegation
  const tableBody = document.getElementById("tableBody");
  if (tableBody) {
    tableBody.addEventListener("click", function(ev) {
      const inc = ev.target.closest(".btn-increase");
      const dec = ev.target.closest(".btn-decrease");
      const del = ev.target.closest(".btn-delete");
      if(inc){ increaseById(inc.dataset.id); return; }
      if(dec){ decreaseById(dec.dataset.id); return; }
      if(del){ deleteById(del.dataset.id); return; }
    });
  }

  // Fix for table header sorting
  document.querySelectorAll("th[data-key]").forEach(th=>{
    th.addEventListener("click", function(){
      const key = th.dataset.key;
      if(currentSort.key === key) currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
      else currentSort = { key, dir: "asc" };
      render(document.getElementById("searchBox").value);
    });
  });

  // Fix for search box
  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.addEventListener("input", function(e) { 
      render(e.target.value); 
    });
  }

  // Save notes when they change
  const exportNotes = document.getElementById("exportNotes");
  if (exportNotes) {
    exportNotes.addEventListener("input", function() {
      saveNotes();
      markAsUnsaved();
    });
  }

  // Save half-size preference when checkbox changes
  const includeHalfSizes = document.getElementById("includeHalfSizes");
  if (includeHalfSizes) {
    includeHalfSizes.addEventListener("change", function() {
      saveHalfSizePreference();
      updateInputCount(); // Recalculate count when checkbox changes
    });
  }

  // Add input event listener for sizes input to update count
  const sizesInput = document.getElementById("sizes");
  if (sizesInput) {
    sizesInput.addEventListener("input", function() {
      updateInputCount();
    });
  }

  // Fix for form submission
  const entryForm = document.getElementById("entryForm");
  if (entryForm) {
    entryForm.addEventListener("submit", function(e){
      e.preventDefault();
      const brand = document.getElementById("brand").value.trim();
      const color = document.getElementById("color").value.trim();
      const sizesInput = document.getElementById("sizes").value.trim();
      
      if(!brand || !color || !sizesInput){
        toast("Please fill all fields", "#e74c3c");
        return;
      }
      
      try {
        const sizes = parseSizes(sizesInput);
        if(sizes.length === 0){
          toast("No valid sizes found", "#e74c3c");
          return;
        }
        
        const data = loadData();
        const newIds = [];
        
        sizes.forEach(size => {
          const newRow = { brand, color, size, count: 1 };
          const key = mergeKey(newRow);
          const existing = data.findIndex(r => mergeKey(r) === key);
          
          if(existing >= 0){
            data[existing].count += 1;
          } else {
            newRow.id = uid();
            data.push(newRow);
            newIds.push(newRow.id);
          }
        });
        
        saveData(data);
        markAsUnsaved();
        document.getElementById("entryForm").reset();
        clearSizesInput(); // Clear the sizes input after saving
        render(searchBox.value, newIds);
        toast("✅ Saved", "#27ae60");
      } catch(err) {
        console.error("Error parsing sizes:", err);
        toast("Error parsing sizes. Check the format.", "#e74c3c");
      }
    });
  }

  // Handle Enter key navigation in form fields
  const brandInput = document.getElementById("brand");
  const colorInput = document.getElementById("color");
  const sizesRealInput = document.getElementById("sizes");

  if (brandInput) {
    brandInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        colorInput.focus();
      }
    });
  }

  if (colorInput) {
    colorInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        activateSizesBox(true); // Activate sizes box but don't show keyboard
      }
    });
  }

  // Fix for export button
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", function(){
      openModal({
        message: "Export Options",
        buttons:[
          { label:"Export to JSON", color:"#8e44ad", onClick: ()=> exportJson() },
          { label:"Export to Excel", color:"#27ae60", onClick: ()=> exportExcel() },
          { label:"Cancel", color:"#888", onClick: ()=>{} }
        ]
      });
    });
  }

  // Fix for import button - now asks to merge or replace
  const importBtn = document.getElementById("importBtn");
  const jsonFileInput = document.getElementById("jsonFileInput");
  if (importBtn && jsonFileInput) {
    importBtn.addEventListener("click", function(){
      jsonFileInput.click();
    });
    
    jsonFileInput.addEventListener("change", function(e){
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = function(ev){
        try{
          const json = JSON.parse(ev.target.result);
          if(!Array.isArray(json)) throw new Error("Invalid format");
          
          openModal({
            message: `Import ${json.length} items?`,
            subtext: "Would you like to merge with existing data or replace it?",
            buttons:[
              { label:"Merge", color:"#27ae60", onClick: ()=> { 
                mergeData(json); 
                toast("✅ Data merged", "#27ae60"); 
              }},
              { label:"Replace", color:"#e74c3c", onClick: ()=> { 
                saveData(json); 
                // Keep existing notes when replacing data
                render(); 
                toast("✅ Data replaced", "#27ae60"); 
              }},
              { label:"Cancel", color:"#888", onClick: ()=>{} }
            ]
          });
        }catch(err){
          console.error("Import error", err);
          toast("Invalid JSON file", "#e74c3c");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // Fix for clear button
  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", function(){
      const data = loadData();
      if(data.length === 0){
        toast("Already empty", "#888");
        return;
      }
      openModal({
        message: `Clear all ${data.length} items?`,
        subtext: "This cannot be undone.",
        buttons:[
          { label:"Clear All", color:"#e74c3c", onClick: ()=> { 
            saveData([]); 
            // Clear notes too
            document.getElementById("exportNotes").value = "";
            saveNotes();
            render(); 
            toast("🧹 Cleared", "#888"); 
          }},
          { label:"Cancel", color:"#888", onClick: ()=>{} }
        ]
      });
    });
  }

  // Fix for print button - improved functionality
  const printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function(){
      const data = loadData();
      if (data.length === 0) {
        toast("No data to print", "#e74c3c");
        return;
      }

      const notes = document.getElementById("exportNotes").value.trim();

      // Build PDF content
      const pdfContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="text-align:center; color:#2c3e50;">TRM Shoe Tracker - Inventory Report</h1>
          <table border="1" cellspacing="0" cellpadding="6" 
                 style="width:100%; border-collapse:collapse; margin-bottom:20px; text-align:center; font-size:0.9rem;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th>Brand</th><th>Color</th><th>Size</th><th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  <td>${escapeHtml(row.brand)}</td>
                  <td>${escapeHtml(row.color)}</td>
                  <td>${escapeHtml(row.size)}</td>
                  <td>${row.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${notes ? `<div style="padding:10px; border-left:4px solid #2980b9; background:#f9f9f9; margin-top:20px;">
            <strong>Notes:</strong><br>${escapeHtml(notes)}
          </div>` : ''}
          <p style="margin-top:30px; font-size:0.85rem; text-align:center; color:#666;">
            Generated on: ${new Date().toLocaleString()}<br>
            Total items: ${data.reduce((sum, item) => sum + item.count, 0)}
          </p>
        </div>
      `;

      // PDF options
      const opt = {
        margin: 0.5,
        filename: `shoe-inventory-${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      // Generate & save PDF
      html2pdf().from(pdfContent).set(opt).save();
    });
  }

  /* ------------------------
     EXPORT FUNCTIONS
  ------------------------ */
  function exportJson(){
    const data = loadData();
    const notes = document.getElementById("exportNotes").value.trim();
    const exportData = notes ? { notes, data } : data;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shoe-inventory-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast("📥 JSON exported", "#27ae60");
  }

  function exportExcel(){
    const data = loadData();
    const notes = document.getElementById("exportNotes").value.trim();
    
    // Prepare worksheet data
    const wsData = [
      ["Brand", "Color", "Size", "Count"]
    ];
    
    data.forEach(item => {
      wsData.push([item.brand, item.color, item.size, item.count]);
    });
    
    // Add notes if available
    if (notes) {
      wsData.push([]);
      wsData.push(["Notes:", notes]);
    }
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shoe Inventory");
    
    // Generate file and download
    const fileName = `shoe-inventory-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast("📊 Excel exported", "#27ae60");
  }

  /* ------------------------
     IMPORT MERGE FUNCTION
  ------------------------ */
  function mergeData(importedData) {
    const existingData = loadData();
    const mergedData = [...existingData];
    const newIds = [];
    
    importedData.forEach(importedItem => {
      const normalizedItem = normalizeRow(importedItem);
      const key = mergeKey(normalizedItem);
      const existingIndex = mergedData.findIndex(item => mergeKey(item) === key);
      
      if (existingIndex >= 0) {
        // Item exists, update count
        mergedData[existingIndex].count += normalizedItem.count;
      } else {
        // New item, add to array
        mergedData.push(normalizedItem);
        newIds.push(normalizedItem.id);
      }
    });
    
    saveData(mergedData);
    // Don't override existing notes during merge
    render(document.getElementById("searchBox").value, newIds);
  }

  /* ------------------------
     PWA INSTALLATION - Improved as dismissable popup
  ------------------------ */
  let deferredPrompt;
  const installNotification = document.getElementById("installNotification");
  const installConfirm = document.getElementById("installConfirm");
  const installDismiss = document.getElementById("installDismiss");
  const installLater = document.getElementById("installLater");

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Only show if not previously dismissed
    if (!localStorage.getItem('installDismissed')) {
      setTimeout(() => {
        installNotification.style.display = 'block';
      }, 3000);
    }
  });

  if (installConfirm) {
    installConfirm.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      // We've used the prompt, and can't use it again, throw it away
      deferredPrompt = null;
      
      // Hide the notification
      installNotification.style.display = 'none';
    });
  }

  if (installDismiss) {
    installDismiss.addEventListener('click', () => {
      // Hide the notification
      installNotification.style.display = 'none';
      
      // Remember that the user has dismissed the prompt permanently
      localStorage.setItem('installDismissed', 'true');
    });
  }

  if (installLater) {
    installLater.addEventListener('click', () => {
      // Hide the notification
      installNotification.style.display = 'none';
      
      // Show again after 7 days
      setTimeout(() => {
        localStorage.removeItem('installDismissed');
      }, 7 * 24 * 60 * 60 * 1000);
    });
  }

  window.addEventListener('appinstalled', () => {
    // Hide the notification
    installNotification.style.display = 'none';
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    
    // Show success message
    toast('App installed successfully!', '#27ae60');
  });

  /* ------------------------
     TUTORIAL FUNCTIONALITY - Fixed highlighting
  ------------------------ */
  const tutorialSteps = [
    {
      title: "Welcome to TRM Shoe Tracker",
      content: "This app helps you track your shoe inventory. Let's take a quick tour to learn how to use it.",
      element: null
    },
    {
      title: "Adding Shoes",
      content: "Use the form at the top to add shoes. Enter the brand, color, and sizes (you can use ranges like 38-40).",
      element: "#entryForm"
    },
    {
      title: "Viewing Your Inventory",
      content: "Your shoes will appear in the table below. You can sort by any column by clicking the header.",
      element: "table"
    },
    {
      title: "Searching",
      content: "Use the search box to filter your inventory by brand, color, or size.",
      element: "#searchBox"
    },
    {
      title: "Exporting Data",
      content: "Use the export buttons to save your data as JSON or Excel files for backup or analysis.",
      element: ".top-row"
    },
    {
      title: "Install the App",
      content: "You can install this app on your device for easier access. Look for the install prompt in the bottom left.",
      element: "#installNotification"
    }
  ];

  let currentTutorialStep = 0;
  const tutorialOverlay = document.getElementById("tutorialOverlay");
  const tutorialContainer = document.getElementById("tutorialContainer");
  const tutorialTitle = document.getElementById("tutorialTitle");
  const tutorialContent = document.getElementById("tutorialContent");
  const prevTutorialBtn = document.getElementById("prevTutorial");
  const nextTutorialBtn = document.getElementById("nextTutorial");

  function showTutorialStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
      hideTutorial();
      return;
    }
    
    currentTutorialStep = stepIndex;
    const step = tutorialSteps[stepIndex];
    
    // Update tutorial content
    tutorialTitle.textContent = step.title;
    tutorialContent.textContent = step.content;
    
    // Position the highlight if there's a target element
    if (step.element) {
      const targetElement = document.querySelector(step.element);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const highlight = document.createElement("div");
        highlight.className = "tutorial-highlight";
        highlight.style.width = `${rect.width + 20}px`;
        highlight.style.height = `${rect.height + 20}px`;
        highlight.style.top = `${rect.top - 10}px`;
        highlight.style.left = `${rect.left - 10}px`;
        
        // Remove any existing highlight
        const existingHighlight = document.querySelector(".tutorial-highlight");
        if (existingHighlight) existingHighlight.remove();
        
        document.body.appendChild(highlight);
        
        // Scroll to the element if needed
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      // Remove highlight if no target element
      const existingHighlight = document.querySelector(".tutorial-highlight");
      if (existingHighlight) existingHighlight.remove();
    }
    
    // Show tutorial UI
    tutorialOverlay.style.display = "block";
    tutorialContainer.style.display = "block";
    
    // Update button states
    prevTutorialBtn.style.display = stepIndex > 0 ? "block" : "none";
    nextTutorialBtn.textContent = stepIndex < tutorialSteps.length - 1 ? "Next" : "Finish";
  }

  function hideTutorial() {
    tutorialOverlay.style.display = "none";
    tutorialContainer.style.display = "none";
    
    // Remove highlight
    const existingHighlight = document.querySelector(".tutorial-highlight");
    if (existingHighlight) existingHighlight.remove();
    
    // Remember that the user has completed the tutorial
    localStorage.setItem('tutorialCompleted', 'true');
  }

  // Set up tutorial event listeners
  if (prevTutorialBtn && nextTutorialBtn) {
    prevTutorialBtn.addEventListener("click", () => {
      showTutorialStep(currentTutorialStep - 1);
    });
    
    nextTutorialBtn.addEventListener("click", () => {
      if (currentTutorialStep < tutorialSteps.length - 1) {
        showTutorialStep(currentTutorialStep + 1);
      } else {
        hideTutorial();
      }
    });
  }

  // Start tutorial on first visit
  if (!localStorage.getItem('tutorialCompleted')) {
    setTimeout(() => {
      showTutorialStep(0);
    }, 1000);
  }

  /* ------------------------
     WINDOW BEFOREUNLOAD
  ------------------------ */
  window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  // Initialize input count on startup
  setTimeout(() => {
    updateInputCount();
  }, 100);

  // Initial render
  render();
  
// ========================
// CUSTOM KEYBOARD FUNCTIONALITY - FIXED VERSION
// ========================

// Custom keyboard functionality
// Custom keyboard functionality
document.addEventListener('DOMContentLoaded', function() {
  const sizesHiddenInput = document.getElementById('sizes-hidden');
  const sizesDisplay = document.getElementById('sizes-display');
  const sizesValueSpan = document.getElementById('sizes-value');
  const sizesPlaceholderSpan = document.getElementById('sizes-placeholder');
  const sizesRealInput = document.getElementById('sizes');
  const keyButtons = document.querySelectorAll('.key-btn');
  const backspaceBtn = document.querySelector('.key-btn.backspace');
  const doneBtn = document.querySelector('.key-btn.done');
  const clearBtn = document.querySelector('.key-btn.clear');
  
  if (!sizesRealInput) return;
  
  // Call the keyboard prevention function
  preventMobileKeyboard();
  
  // Initialize display
  updateRealInput(sizesRealInput.value || '');
  
  // Handle clicks on the display div - simplified
  sizesDisplay.addEventListener('click', function(e) {
    // Just highlight without any prevention
    sizesDisplay.style.borderColor = "var(--accent)";
    sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
    
    // Blur any focused input elements
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
  });
  
  // Double click to clear all sizes
  sizesDisplay.addEventListener('dblclick', function(e) {
    updateRealInput('');
  });
  
  // Handle blur on hidden input
  sizesHiddenInput.addEventListener('blur', function() {
    sizesDisplay.style.borderColor = sizesRealInput.value ? "var(--accent)" : "";
    sizesDisplay.style.boxShadow = sizesRealInput.value ? "0 0 0 2px rgba(41, 128, 185, 0.2)" : "";
  });
  
  // Handle key presses for number/symbol buttons - simplified
  keyButtons.forEach(button => {
    if (button.classList.contains('backspace') || 
        button.classList.contains('done') || 
        button.classList.contains('clear')) return;
    
    button.addEventListener('click', function() {
      const key = this.getAttribute('data-key');
      const currentValue = sizesRealInput.value;
      updateRealInput(currentValue + key);
      
      // Ensure no input has focus
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    });
  });
  
  // Handle backspace with long press for rapid deletion - simplified
  // Handle backspace with long press for rapid deletion - FIXED VERSION
if (backspaceBtn) {
  let backspaceTimeout = null;
  let backspaceInterval = null;
  let isLongPressActive = false;
  
  const startBackspace = () => {
    const currentValue = sizesRealInput.value;
    if (currentValue.length > 0) {
      updateRealInput(currentValue.slice(0, -1));
    }
  };
  
  const handleBackspaceStart = (e) => {
    // Prevent the single character deletion on initial press
    // We'll handle it in the click event instead
    isLongPressActive = false;
    
    backspaceTimeout = setTimeout(() => {
      isLongPressActive = true;
      startBackspace(); // Delete first character after long press starts
      backspaceInterval = setInterval(startBackspace, 100);
    }, 500);
  };
  
  const handleBackspaceEnd = () => {
    clearTimeout(backspaceTimeout);
    clearInterval(backspaceInterval);
    backspaceTimeout = null;
    backspaceInterval = null;
    isLongPressActive = false;
  };
  
  // For mouse devices
  backspaceBtn.addEventListener('mousedown', handleBackspaceStart);
  backspaceBtn.addEventListener('mouseup', handleBackspaceEnd);
  backspaceBtn.addEventListener('mouseleave', handleBackspaceEnd);
  
  // For touch devices
  backspaceBtn.addEventListener('touchstart', handleBackspaceStart);
  backspaceBtn.addEventListener('touchend', handleBackspaceEnd);
  backspaceBtn.addEventListener('touchcancel', handleBackspaceEnd);
  
  // Handle regular click - this should delete ONE character
  backspaceBtn.addEventListener('click', function(e) {
    // Only delete if NOT in a long press
    if (!isLongPressActive && !backspaceInterval) {
      startBackspace();
    }
  });
}
  
  // Add clear button if it exists
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      updateRealInput('');
    });
  }
  
  // Handle done button - submits the form
  if (doneBtn) {
    doneBtn.addEventListener('click', function() {
      // Check if form is valid and submit it
      setTimeout(() => {
        const brand = document.getElementById("brand").value.trim();
        const color = document.getElementById("color").value.trim();
        const sizesValue = sizesRealInput.value.trim();
        
        if (brand && color && sizesValue) {
          // Click the Save Entry button
          const saveButton = document.querySelector('button[type="submit"]');
          if (saveButton) {
            saveButton.click();
          }
        } else {
          // Show error message
          toast("Please fill brand, color, and sizes before saving", "#e74c3c");
        }
      }, 100);
    });
  }
  
  // Update form validation to use the real input
  const originalFormSubmit = document.getElementById("entryForm").onsubmit;
  document.getElementById("entryForm").onsubmit = function(e) {
    return originalFormSubmit ? originalFormSubmit.call(this, e) : true;
  };
});
})();