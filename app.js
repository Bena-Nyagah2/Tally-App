// App.js - Complete Version with All Fixes Including Tutorial
(function() {
  /* ------------------------
     STORAGE + HELPERS
  ------------------------ */
  const STORE_KEY = "shoe_entries_json_v11.0";
  const NOTES_KEY = "shoe_tracker_notes_v1";
  const HALF_SIZE_KEY = "shoe_tracker_halfsize_v1";
  const CATALOG_KEY = "shoe_master_catalog";
  const AUTO_SAVE_INTERVAL = 20000; // 20 seconds
  
  let hasUnsavedChanges = false;
  let autoSaveTimer = null;
  let masterCatalog = null;

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
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr)) {
        console.warn("Invalid data format in localStorage");
        return [];
      }
      const normalized = arr.map(normalizeRow);
      localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch(e){ 
      console.error("Error loading data:", e);
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
      console.error("Error saving data:", error);
      toast("❌ Error saving data", "#e74c3c");
      return false;
    }
  }

  function mergeKey(row){
    return `${String(row.brand||"").toLowerCase()}|${String(row.color||"").toLowerCase()}|${String(row.size||"").toLowerCase()}`;
  }

  /* ------------------------
     UTILITY FUNCTIONS
  ------------------------ */
  function parseJavaScriptJSON(content) {
    try {
      // Remove comments (both single line and multi-line)
      content = content.replace(/\/\/.*$/gm, ''); // Remove single line comments
      content = content.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
      
      // Remove variable declaration and trailing semicolon
      content = content.trim();
      
      // Remove any variable assignment (const, let, var) with any variable name
      const regex = /^(?:const|let|var)\s+\w+\s*=\s*/;
      if (regex.test(content)) {
        content = content.replace(regex, '');
      }
      
      // Remove trailing semicolon
      if (content.endsWith(';')) {
        content = content.substring(0, content.length - 1);
      }
      
      // Remove any extra whitespace
      content = content.trim();
      
      return JSON.parse(content);
    } catch (error) {
      throw new Error("Invalid JavaScript JSON format: " + error.message);
    }
  }

  function validateCatalog(catalog) {
    if (typeof catalog !== 'object' || catalog === null) {
      return { valid: false, error: "Catalog must be an object" };
    }
    
    if (Array.isArray(catalog)) {
      return { valid: false, error: "Catalog should be an object with brands as keys, not an array" };
    }
    
    const brands = Object.keys(catalog);
    if (brands.length === 0) {
      return { valid: false, error: "Catalog is empty - no brands found" };
    }
    
    // Validate each brand's colors array
    for (const brand of brands) {
      const colors = catalog[brand];
      if (!Array.isArray(colors)) {
        return { valid: false, error: `Brand "${brand}" should have an array of colors` };
      }
      
      // Check if colors are strings
      for (const color of colors) {
        if (typeof color !== 'string') {
          return { valid: false, error: `Brand "${brand}" contains non-string color: ${color}` };
        }
      }
    }
    
    return { valid: true, brands: brands.length };
  }

  /* ------------------------
     MASTER CATALOG MANAGEMENT
  ------------------------ */
  function loadCatalog() {
    try {
      const catalogJson = localStorage.getItem(CATALOG_KEY);
      if (catalogJson) {
        masterCatalog = JSON.parse(catalogJson);
        console.log("Catalog loaded:", Object.keys(masterCatalog).length, "brands");
      } else {
        masterCatalog = null;
      }
    } catch (error) {
      console.error("Error loading catalog:", error);
      masterCatalog = null;
    }
    return masterCatalog;
  }

  function saveCatalog(catalog) {
    try {
      localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
      masterCatalog = catalog;
      console.log("Catalog saved:", Object.keys(catalog).length, "brands");
      return true;
    } catch (error) {
      console.error("Error saving catalog:", error);
      return false;
    }
  }

  function clearCatalog() {
    localStorage.removeItem(CATALOG_KEY);
    masterCatalog = null;
    updateDatalists();
    toast("Catalog cleared", "#888");
  }

  function handleCatalogUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoader("Loading catalog...");
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let content = e.target.result;
        let catalog;
        
        // First try to parse as pure JSON
        try {
          catalog = JSON.parse(content);
        } catch (jsonError) {
          console.log("Trying to parse as JavaScript format...");
          // If that fails, try to extract from JavaScript format
          catalog = parseJavaScriptJSON(content);
        }
        
        // Validate catalog structure
        const validation = validateCatalog(catalog);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        
        // Count entries
        const brandCount = validation.brands;
        let colorCount = 0;
        Object.values(catalog).forEach(colors => {
          colorCount += colors.length;
        });
        
        // Save catalog
        if (saveCatalog(catalog)) {
          hideLoader();
          
          openModal({
            message: `🎉 Catalog Updated Successfully!`,
            subtext: `Loaded ${brandCount} brands with ${colorCount} total color options.`,
            buttons: [
              { 
                label: "OK", 
                color: "var(--ok)", 
                onClick: () => {
                  updateDatalists();
                  updateColorDatalist(document.getElementById("brand").value.trim());
                  toast("✅ Catalog loaded successfully!", "#27ae60");
                }
              },
              { 
                label: "Clear Catalog", 
                color: "var(--danger)", 
                onClick: () => clearCatalog()
              }
            ]
          });
        } else {
          hideLoader();
          toast("❌ Error saving catalog to browser storage", "#e74c3c");
        }
      } catch (error) {
        hideLoader();
        console.error("Catalog parse error:", error);
        toast(`❌ ${error.message || "Invalid catalog file format"}`, "#e74c3c");
      }
    };
    
    reader.onerror = function() {
      hideLoader();
      toast("❌ Error reading file", "#e74c3c");
    };
    
    reader.readAsText(file);
    event.target.value = "";
  }

  function getAllBrands() {
    const brands = new Set();
    
    // Add brands from catalog
    if (masterCatalog) {
      Object.keys(masterCatalog).forEach(brand => {
        if (brand && brand.trim()) brands.add(brand.trim());
      });
    }
    
    // Add brands from existing data
    const data = loadData();
    data.forEach(item => {
      if (item.brand && item.brand.trim()) brands.add(item.brand.trim());
    });
    
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }

  function getColorsForBrand(brand) {
    if (!brand) return [];
    
    const colors = new Set();
    
    // Add colors from catalog
    if (masterCatalog && masterCatalog[brand]) {
      masterCatalog[brand].forEach(color => {
        if (color && color.trim()) colors.add(color.trim());
      });
    }
    
    // Add colors from existing data for this brand
    const data = loadData();
    data.filter(item => item.brand === brand).forEach(item => {
      if (item.color && item.color.trim()) colors.add(item.color.trim());
    });
    
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
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
    try {
      const notes = localStorage.getItem(NOTES_KEY);
      if (notes) {
        document.getElementById("exportNotes").value = notes;
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }

  function saveNotes() {
    try {
      const notes = document.getElementById("exportNotes").value.trim();
      localStorage.setItem(NOTES_KEY, notes);
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  }

  function loadHalfSizePreference() {
    try {
      const saved = localStorage.getItem(HALF_SIZE_KEY);
      const checkbox = document.getElementById("includeHalfSizes");
      if (saved !== null) {
        checkbox.checked = saved === 'true';
      } else {
        checkbox.checked = false;
        localStorage.setItem(HALF_SIZE_KEY, 'false');
      }
    } catch (error) {
      console.error("Error loading half-size preference:", error);
    }
  }

  function saveHalfSizePreference() {
    try {
      const checkbox = document.getElementById("includeHalfSizes");
      localStorage.setItem(HALF_SIZE_KEY, checkbox.checked.toString());
    } catch (error) {
      console.error("Error saving half-size preference:", error);
    }
  }

  /* ------------------------
     LOADER FUNCTIONS
  ------------------------ */
  function showLoader(text = "Loading...") {
    try {
      const loader = document.getElementById("loader");
      const loaderText = document.getElementById("loader-text");
      if (loader) {
        loaderText.textContent = text;
        loader.style.display = "flex";
      }
    } catch (error) {
      console.error("Error showing loader:", error);
    }
  }

  function hideLoader() {
    try {
      const loader = document.getElementById("loader");
      if (loader) {
        loader.style.display = "none";
      }
    } catch (error) {
      console.error("Error hiding loader:", error);
    }
  }

  /* ------------------------
     INPUT COUNT CALCULATION
  ------------------------ */
  function calculateInputCount(input) {
    if (!input || !input.trim()) return 0;
    
    try {
      // Simple counting - count commas + 1 for items, handle ranges and multipliers
      const parts = input.split(',').filter(p => p.trim().length > 0);
      let count = 0;
      
      for (const part of parts) {
        const trimmed = part.trim();
        
        // Handle multipliers (e.g., "42*3")
        if (trimmed.includes('*')) {
          const subParts = trimmed.split('*');
          if (subParts.length === 2 && !isNaN(subParts[1])) {
            const multiplier = parseInt(subParts[1], 10);
            const sizePart = subParts[0].trim();
            
            // Check if it's a range with multiplier (e.g., "38-40*2")
            if (sizePart.includes('-')) {
              const rangeParts = sizePart.split('-').map(p => parseFloat(p.trim()));
              if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
                const start = Math.min(rangeParts[0], rangeParts[1]);
                const end = Math.max(rangeParts[0], rangeParts[1]);
                const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
                const step = includeHalfSizes ? 0.5 : 1;
                const rangeCount = Math.floor((end - start) / step) + 1;
                count += rangeCount * multiplier;
              } else {
                count += multiplier;
              }
            } else {
              count += multiplier;
            }
          } else {
            count++;
          }
        } 
        // Handle ranges (e.g., "38-40")
        else if (trimmed.includes('-')) {
          const rangeParts = trimmed.split('-').map(p => parseFloat(p.trim()));
          if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
            const start = Math.min(rangeParts[0], rangeParts[1]);
            const end = Math.max(rangeParts[0], rangeParts[1]);
            const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
            const step = includeHalfSizes ? 0.5 : 1;
            count += Math.floor((end - start) / step) + 1;
          } else {
            count++;
          }
        } 
        // Single size
        else {
          count++;
        }
      }
      
      return count;
    } catch (err) {
      console.error("Error calculating input count:", err);
      return 0;
    }
  }

  function updateInputCount() {
    try {
      const input = document.getElementById("sizes").value;
      const count = calculateInputCount(input);
      const inputCount = document.getElementById("inputCount");
      if (inputCount) {
        inputCount.textContent = `Input count: ${count}`;
      }
    } catch (error) {
      console.error("Error updating input count:", error);
    }
  }

  /* ------------------------
     ENHANCED SIZE PARSING
  ------------------------ */
  function parseSizes(input) {
    try {
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
            
            // Parse the size value
            const parsedSizes = parseSingleSize(sizeValue, step);
            
            for (let i = 0; i < quantity; i++) {
              parsedSizes.forEach(s => sizes.push(s));
            }
            continue;
          }
        }
        
        // Handle regular sizes
        const parsed = parseSingleSize(size, step);
        parsed.forEach(s => sizes.push(s));
      }
      
      return sizes;
    } catch (error) {
      console.error("Error parsing sizes:", error);
      throw new Error("Invalid size format. Please check your input.");
    }
  }

  function parseSingleSize(size, step) {
    const sizes = [];
    
    // Handle size ranges like "6/7" (treat as a single size)
    if (size.includes('/') && !size.includes('-')) {
      sizes.push(size);
      return sizes;
    }
    
    // Handle size ranges like "38-40" or "10.5-12.5"
    if (size.includes('-')) {
      const parts = size.split('-').map(s => s.trim());
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        const start = parseFloat(parts[0]);
        const end = parseFloat(parts[1]);
        
        if (start !== end) {
          const isAscending = start < end;
          const stepSize = isAscending ? step : -step;
          const compareFunc = isAscending ? (a, b) => a <= b : (a, b) => a >= b;
          
          // Handle floating point precision
          const precision = step === 0.5 ? 1 : 0;
          
          for (let s = start; compareFunc(s, end); s += stepSize) {
            // Round to avoid floating point errors
            const rounded = Math.round(s * Math.pow(10, precision)) / Math.pow(10, precision);
            sizes.push(rounded.toString());
          }
          return sizes;
        } else {
          sizes.push(start.toString());
          return sizes;
        }
      }
    }
    
    // Handle decimal sizes
    if (!isNaN(parseFloat(size)) && isFinite(size)) {
      const num = parseFloat(size);
      sizes.push(num.toString());
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
    try {
      const t = $("toast");
      if (!t) return;
      
      t.textContent = message;
      t.style.background = color;
      t.classList.add("show");
      t.style.opacity = "1";
      clearTimeout(t._hideTimer);
      t._hideTimer = setTimeout(()=>{
        t.style.opacity = "0";
        t.classList.remove("show");
      }, 3000);
    } catch (error) {
      console.error("Error showing toast:", error);
    }
  }

  function openModal({message, subtext="", buttons=[]}){
    try {
      const modal = $("confirmModal");
      if (!modal) return;
      
      $("confirmMessage").textContent = message;
      $("confirmSub").textContent = subtext || "";
      const btns = $("confirmButtons");
      btns.innerHTML = "";
      buttons.forEach(b=>{
        const el = document.createElement("button");
        el.textContent = b.label;
        el.className = "confirm-btn";
        el.style.background = b.color || "#888";
        el.onclick = ()=>{ 
          closeModal(); 
          if(typeof b.onClick === "function") b.onClick(); 
        };
        btns.appendChild(el);
      });
      modal.style.display = "flex";
      setTimeout(()=> modal.classList.add("show"), 8);
    } catch (error) {
      console.error("Error opening modal:", error);
    }
  }

  function closeModal(){
    try {
      const modal = $("confirmModal");
      if (!modal) return;
      
      modal.classList.remove("show");
      setTimeout(()=> modal.style.display = "none", 180);
    } catch (error) {
      console.error("Error closing modal:", error);
    }
  }

  /* ------------------------
   IMPROVED TUTORIAL SYSTEM - FIXED
------------------------ */
let tutorialActive = false;
let currentTutorialStep = 0;

const tutorialSteps = [
  {
    title: "Welcome to TRM Shoe Tracker 👟",
    content: "This app helps you track your shoe inventory efficiently. Let's take a quick tour!",
    icon: "👟"
  },
  {
    title: "Adding Shoes",
    content: "1. Enter brand name<br>2. Enter color<br>3. Use the custom keyboard for sizes (e.g., '38-40' or '42*3')<br>4. Click Save",
    icon: "➕"
  },
  {
    title: "Managing Inventory",
    content: "Your shoes appear in the table below:<br>• Click ➕ to increase count<br>• Click ➖ to decrease count<br>• Click 🗑️ to delete an item",
    icon: "📊"
  },
  {
    title: "Search & Sort",
    content: "• Use the search box to filter by brand, color, or size<br>• Click column headers to sort (▲ for ascending, ▼ for descending)",
    icon: "🔍"
  },
  {
    title: "Export & Import",
    content: "• <strong>Export Options</strong>: Create JSON or Excel files<br>• <strong>Import JSON</strong>: Add or replace data<br>• <strong>Print Inventory</strong>: Generate PDF report",
    icon: "📁"
  },
  {
    title: "Catalog & Smart Suggestions",
    content: "• Click <strong>Update Catalog</strong> to upload brand/color data<br>• Get smart auto-complete suggestions as you type!",
    icon: "📚"
  }
];

function showTutorial() {
  tutorialActive = true;
  currentTutorialStep = 0;
  showTutorialStep(currentTutorialStep);
}

function showTutorialStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
    hideTutorial();
    return;
  }
  
  currentTutorialStep = stepIndex;
  const step = tutorialSteps[stepIndex];
  
  // Remove existing tutorial modal if any
  const existingModal = document.getElementById("tutorialModal");
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create new tutorial modal
  const tutorialModal = document.createElement("div");
  tutorialModal.id = "tutorialModal";
  tutorialModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;
  
  const modalContent = `
    <div style="
      background: white;
      border-radius: 15px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      position: relative;
      animation: fadeIn 0.3s ease;
    ">
      <button id="tutorialClose" style="
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      ">&times;</button>
      
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="
          background: var(--accent);
          color: white;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 32px;
          box-shadow: 0 4px 15px rgba(41, 128, 185, 0.3);
        ">
          ${step.icon}
        </div>
        <h3 style="margin: 0 0 15px 0; color: var(--accent); font-size: 1.4rem;">${step.title}</h3>
        <p style="color: #555; line-height: 1.6; text-align: left; font-size: 1rem;">
          ${step.content}
        </p>
      </div>
      
      <div style="
        display: flex;
        justify-content: center;
        margin-top: 25px;
        gap: 8px;
      ">
        ${tutorialSteps.map((_, i) => `
          <div id="stepDot${i}" style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${i === stepIndex ? 'var(--accent)' : '#ddd'};
            cursor: pointer;
            transition: background 0.3s;
          " data-step="${i}"></div>
        `).join('')}
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 30px;">
        <button id="tutorialPrev" style="
          padding: 12px 25px;
          background: ${stepIndex === 0 ? '#f0f0f0' : 'var(--accent)'};
          color: ${stepIndex === 0 ? '#999' : 'white'};
          border: none;
          border-radius: 10px;
          font-weight: bold;
          cursor: ${stepIndex === 0 ? 'not-allowed' : 'pointer'};
          font-size: 1rem;
          opacity: ${stepIndex === 0 ? '0.6' : '1'};
          transition: all 0.2s;
        " ${stepIndex === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        
        <button id="tutorialNext" style="
          padding: 12px 30px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        ">
          ${stepIndex === tutorialSteps.length - 1 ? 'Finish 🎉' : 'Next →'}
        </button>
      </div>
      
      <div style="text-align: center; margin-top: 20px;">
        <button id="tutorialSkip" style="
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 0.9rem;
          text-decoration: underline;
        ">
          Skip Tutorial
        </button>
      </div>
    </div>
  `;
  
  tutorialModal.innerHTML = modalContent;
  document.body.appendChild(tutorialModal);
  
  // Add event listeners
  document.getElementById("tutorialClose").addEventListener("click", hideTutorial);
  document.getElementById("tutorialSkip").addEventListener("click", hideTutorial);
  
  document.getElementById("tutorialPrev").addEventListener("click", function() {
    if (currentTutorialStep > 0) {
      showTutorialStep(currentTutorialStep - 1);
    }
  });
  
  document.getElementById("tutorialNext").addEventListener("click", function() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
      showTutorialStep(currentTutorialStep + 1);
    } else {
      hideTutorial();
    }
  });
  
  // Add click listeners for step dots
  tutorialSteps.forEach((_, i) => {
    document.getElementById(`stepDot${i}`).addEventListener('click', () => {
      showTutorialStep(i);
    });
  });
}

function hideTutorial() {
  const tutorialModal = document.getElementById("tutorialModal");
  if (tutorialModal) {
    tutorialModal.remove();
  }
  tutorialActive = false;
  localStorage.setItem('tutorialCompleted', 'true');
  
  // Add tutorial button to top row
  addTutorialButton();
}

function addTutorialButton() {
  // Remove existing tutorial button if any
  const existingBtn = document.getElementById("showTutorialBtn");
  if (existingBtn) existingBtn.remove();
  
  // Add tutorial button to top row
  const topRow = document.querySelector('.top-row');
  if (topRow && !document.getElementById("showTutorialBtn")) {
    const tutorialBtn = document.createElement('button');
    tutorialBtn.id = 'showTutorialBtn';
    tutorialBtn.className = 'btn-install';
    tutorialBtn.textContent = 'Show Tutorial';
    tutorialBtn.style.background = '#16a085';
    tutorialBtn.addEventListener('click', showTutorial);
    
    // Insert after export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.parentNode.insertBefore(tutorialBtn, exportBtn.nextSibling);
    } else {
      topRow.appendChild(tutorialBtn);
    }
  }
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
        showAutoSaveIndicator();
      }
    }, AUTO_SAVE_INTERVAL);
  }
  
  function showAutoSaveIndicator() {
    try {
      const indicator = $("autoSaveIndicator");
      if (!indicator) return;
      
      indicator.classList.add("show");
      setTimeout(() => {
        indicator.classList.remove("show");
      }, 2000);
    } catch (error) {
      console.error("Error showing auto-save indicator:", error);
    }
  }
  
  function updateUnsavedWarning() {
    try {
      const warning = $("unsavedWarning");
      if (!warning) return;
      
      if (hasUnsavedChanges) {
        warning.style.display = "block";
      } else {
        warning.style.display = "none";
      }
    } catch (error) {
      console.error("Error updating unsaved warning:", error);
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
    try {
      const brands = getAllBrands();
      const bDL = $("brands");
      
      if(bDL){
        bDL.innerHTML = "";
        brands.forEach(b=> bDL.append(new Option(b, b)));
      }
      
      // Update color datalist based on current brand
      const currentBrand = document.getElementById("brand")?.value?.trim();
      updateColorDatalist(currentBrand || "");
    } catch (error) {
      console.error("Error updating datalists:", error);
    }
  }

  function updateColorDatalist(brand) {
    try {
      const colors = getColorsForBrand(brand);
      const cDL = $("colors");
      
      if (cDL) {
        cDL.innerHTML = "";
        
        // If no brand selected or brand not in catalog, show all colors from data
        if (!brand || colors.length === 0) {
          const allColors = new Set();
          const data = loadData();
          
          // Add all colors from data
          data.forEach(item => {
            if (item.color && item.color.trim()) allColors.add(item.color.trim());
          });
          
          // Add colors from catalog (all brands)
          if (masterCatalog) {
            Object.values(masterCatalog).forEach(colorArray => {
              if (Array.isArray(colorArray)) {
                colorArray.forEach(color => {
                  if (color && color.trim()) allColors.add(color.trim());
                });
              }
            });
          }
          
          const allColorsArray = Array.from(allColors).sort((a, b) => a.localeCompare(b));
          allColorsArray.forEach(c => cDL.append(new Option(c, c)));
        } else {
          // Show colors for the specific brand
          colors.forEach(c => cDL.append(new Option(c, c)));
        }
      }
    } catch (error) {
      console.error("Error updating color datalist:", error);
    }
  }

  function highlightText(text, searchTerm) {
    if (!searchTerm) return escapeHtml(text);
    
    try {
      const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedSearch})`, 'gi');
      return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
    } catch (error) {
      return escapeHtml(text);
    }
  }

  function render(filter="", highlightIds=[]){
    try {
      const tbody = $("tableBody");
      if (!tbody) return;
      
      tbody.innerHTML = "";
      let rows = loadData();

      if(currentSort.key){
        const k = currentSort.key;
        rows = rows.slice().sort((a,b)=>{
          let A = a[k], B = b[k];
          
          if (k === 'size') {
            // Convert fractions to decimals for proper sorting
            if (A && A.includes('/') && !A.includes('-')) {
              const parts = A.split('/');
              A = parts[0] / parts[1];
            }
            if (B && B.includes('/') && !B.includes('-')) {
              const parts = B.split('/');
              B = parts[0] / parts[1];
            }
            
            // Try to parse as numbers for numeric comparison
            const numA = parseFloat(A);
            const numB = parseFloat(B);
            if (!isNaN(numA) && !isNaN(numB)) {
              A = numA;
              B = numB;
            }
          }
          
          if (typeof A === "string") A = A.toLowerCase();
          if (typeof B === "string") B = B.toLowerCase();
          
          // Handle undefined/null values
          if (A == null) A = '';
          if (B == null) B = '';
          
          if(A < B) return currentSort.dir === "asc" ? -1 : 1;
          if(A > B) return currentSort.dir === "asc" ? 1 : -1;
          return 0;
        });
      }

      const q = String(filter||"").trim().toLowerCase();
      const view = q ? rows.filter(r => 
        (r.brand && r.brand.toLowerCase().includes(q)) || 
        (r.color && r.color.toLowerCase().includes(q)) || 
        (r.size && r.size.toLowerCase().includes(q))
      ) : rows;

      if (view.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td colspan="5" style="text-align:center; padding:40px; color:#888;">
            ${q ? 'No items match your search' : 'No items yet. Add some shoes!'}
          </td>
        `;
        tbody.appendChild(tr);
      } else {
        view.forEach(r => {
          const tr = document.createElement("tr");
          tr.dataset.id = r.id;
          tr.className = "data-row";
          
          const brandHtml = highlightText(r.brand || "", q);
          const colorHtml = highlightText(r.color || "", q);
          const sizeHtml = highlightText(r.size || "", q);
          
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
      }

      if(Array.isArray(highlightIds) && highlightIds.length){
        highlightIds.forEach(id=>{
          const row = tbody.querySelector(`tr[data-id="${id}"]`);
          if(row){
            row.classList.add("row-add");
            setTimeout(()=> row.classList.remove("row-add"), 1200);
          }
        });
      }

      // Update sorting arrows
      document.querySelectorAll("th[data-key]").forEach(th=>{
        const arrow = th.querySelector(".arrow");
        if (!arrow) return;
        
        if(currentSort.key === th.dataset.key){
          if(currentSort.dir === "asc"){
            th.classList.add("sort-asc");
            th.classList.remove("sort-desc");
            arrow.textContent = "▲";
            arrow.style.color = "var(--ok)";
          } else {
            th.classList.add("sort-desc");
            th.classList.remove("sort-asc");
            arrow.textContent = "▼";
            arrow.style.color = "var(--danger)";
          }
        } else {
          arrow.textContent = "▲";
          arrow.style.color = "#aaa";
          th.classList.remove("sort-asc","sort-desc");
        }
      });

      updateDatalists();
    } catch (error) {
      console.error("Error rendering table:", error);
    }
  }

  /* ------------------------
     INCREASE / DECREASE / DELETE
  ------------------------ */
  function increaseById(id){
    try {
      const data = loadData();
      const idx = data.findIndex(x => x.id === id);
      if (idx === -1) return;
      
      data[idx].count += 1;
      saveData(data);
      markAsUnsaved();
      render(document.getElementById("searchBox").value);
    } catch (error) {
      console.error("Error increasing count:", error);
      toast("❌ Error increasing count", "#e74c3c");
    }
  }

  function decreaseById(id){
    try {
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
    } catch (error) {
      console.error("Error decreasing count:", error);
      toast("❌ Error decreasing count", "#e74c3c");
    }
  }

  function animateDeleteById(id){
    try {
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
    } catch (error) {
      console.error("Error deleting item:", error);
      toast("❌ Error deleting item", "#e74c3c");
    }
  }

  function deleteById(id){
    try {
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
    } catch (error) {
      console.error("Error in delete dialog:", error);
      toast("❌ Error showing delete dialog", "#e74c3c");
    }
  }

  /* ------------------------
     FORM SAVE FUNCTION
  ------------------------ */
  function saveFormEntry() {
    try {
      const brand = document.getElementById("brand").value.trim();
      const color = document.getElementById("color").value.trim();
      const sizesInput = document.getElementById("sizes").value.trim();
      
      if(!brand || !color || !sizesInput){
        toast("❌ Please fill all fields", "#e74c3c");
        return false;
      }
      
      const sizes = parseSizes(sizesInput);
      if(sizes.length === 0){
        toast("❌ No valid sizes found", "#e74c3c");
        return false;
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
      
      if (!saveData(data)) {
        return false;
      }
      
      markAsUnsaved();
      
      // Reset form
      document.getElementById("brand").value = '';
      document.getElementById("color").value = '';
      document.getElementById("sizes").value = '';
      
      // Clear the display
      if (window.clearSizesDisplay) {
        window.clearSizesDisplay();
      }
      
      // Update cursor position
      if (window.cursorPosition !== undefined) {
        window.cursorPosition = 0;
      }
      
      // Update display
      if (window.updateCursor) {
        window.updateCursor();
      }
      
      render(searchBox.value, newIds);
      toast("✅ Saved successfully", "#27ae60");
      return true;
    } catch(err) {
      console.error("Error saving entry:", err);
      toast(`❌ ${err.message || "Error saving entry"}`, "#e74c3c");
      return false;
    }
  }

  /* ------------------------
     EXPORT FUNCTIONS
  ------------------------ */
  function exportJson(){
    try {
      const data = loadData();
      
      // Check if there's any data to export
      if (!data || data.length === 0) {
        toast("❌ No data to export. Please add some shoes first.", "#e74c3c");
        return;
      }
      
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
      toast("📥 JSON exported successfully", "#27ae60");
    } catch (error) {
      console.error("Export error:", error);
      toast("❌ Error exporting JSON", "#e74c3c");
    }
  }

  function exportExcel(){
    try {
      const data = loadData();
      
      // Check if there's any data to export
      if (!data || data.length === 0) {
        toast("❌ No data to export. Please add some shoes first.", "#e74c3c");
        return;
      }
      
      showLoader("Generating Excel file...");
      
      setTimeout(() => {
        try {
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
          
          hideLoader();
          toast("📊 Excel exported successfully", "#27ae60");
        } catch (error) {
          hideLoader();
          console.error("Excel export error:", error);
          toast("❌ Error exporting Excel file", "#e74c3c");
        }
      }, 500);
    } catch (error) {
      console.error("Error in exportExcel:", error);
      toast("❌ Error preparing export", "#e74c3c");
    }
  }

  /* ------------------------
     IMPORT MERGE FUNCTION
  ------------------------ */
  function mergeData(importedData) {
    try {
      const existingData = loadData();
      const mergedData = [...existingData];
      const newIds = [];
      
      importedData.forEach(importedItem => {
        const normalizedItem = normalizeRow(importedItem);
        const key = mergeKey(normalizedItem);
        const existingIndex = mergedData.findIndex(item => mergeKey(item) === key);
        
        if (existingIndex >= 0) {
          mergedData[existingIndex].count += normalizedItem.count;
        } else {
          mergedData.push(normalizedItem);
          newIds.push(normalizedItem.id);
        }
      });
      
      if (saveData(mergedData)) {
        render(document.getElementById("searchBox").value, newIds);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error merging data:", error);
      toast("❌ Error merging data", "#e74c3c");
      return false;
    }
  }

  /* ------------------------
     CATALOG INFO FUNCTION
  ------------------------ */
  function showCatalogInfo() {
    try {
      if (!masterCatalog) {
        toast("ℹ️ No catalog loaded. Please upload a catalog file first.", "#f39c12");
        return;
      }
      
      const brandCount = Object.keys(masterCatalog).length;
      let colorCount = 0;
      Object.values(masterCatalog).forEach(colors => {
        if (Array.isArray(colors)) {
          colorCount += colors.length;
        }
      });
      
      openModal({
        message: `📚 Current Catalog: ${brandCount} Brands`,
        subtext: `Total color options: ${colorCount}\nCatalog is stored locally in your browser.`,
        buttons: [
          { 
            label: "Clear Catalog", 
            color: "var(--danger)", 
            onClick: () => clearCatalog()
          },
          { 
            label: "Update Catalog", 
            color: "#2c3e50", 
            onClick: () => {
              const catalogFileInput = document.getElementById("catalogFileInput");
              if (catalogFileInput) catalogFileInput.click();
            }
          },
          { 
            label: "OK", 
            color: "#888", 
            onClick: () => {} 
          }
        ]
      });
    } catch (error) {
      console.error("Error showing catalog info:", error);
      toast("❌ Error showing catalog info", "#e74c3c");
    }
  }

  /* ------------------------
     INITIALIZATION
  ------------------------ */
  function initialize() {
    try {
      // Load all data
      loadCatalog();
      loadNotes();
      loadHalfSizePreference();
      
      // Start auto-save
      startAutoSave();
      
      // Set up event delegation for table
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

      // Table header sorting
      document.querySelectorAll("th[data-key]").forEach(th=>{
        th.addEventListener("click", function(){
          const key = th.dataset.key;
          if(currentSort.key === key) {
            currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
          } else {
            currentSort = { key, dir: "asc" };
          }
          render(document.getElementById("searchBox").value);
        });
      });

      // Search box
      const searchBox = document.getElementById("searchBox");
      if (searchBox) {
        searchBox.addEventListener("input", function(e) { 
          render(e.target.value); 
        });
      }

      // Notes auto-save
      const exportNotes = document.getElementById("exportNotes");
      if (exportNotes) {
        exportNotes.addEventListener("input", function() {
          saveNotes();
          markAsUnsaved();
        });
      }

      // Half-size preference
      const includeHalfSizes = document.getElementById("includeHalfSizes");
      if (includeHalfSizes) {
        includeHalfSizes.addEventListener("change", function() {
          saveHalfSizePreference();
          updateInputCount();
        });
      }

      // Form submission
      const entryForm = document.getElementById("entryForm");
      if (entryForm) {
        entryForm.addEventListener("submit", function(e){
          e.preventDefault();
          saveFormEntry();
        });
      }

      // Enter key navigation
      const brandInput = document.getElementById("brand");
      const colorInput = document.getElementById("color");

      if (brandInput) {
        brandInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            colorInput.focus();
          }
        });
        
        // Update color datalist when brand changes
        brandInput.addEventListener('input', function(e) {
          const brand = e.target.value.trim();
          updateColorDatalist(brand);
        });
        
        brandInput.addEventListener('change', function(e) {
          const brand = e.target.value.trim();
          updateColorDatalist(brand);
        });
      }

      if (colorInput) {
        colorInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            // Focus on sizes display
            const sizesDisplay = document.getElementById("sizes-display");
            if (sizesDisplay) {
              sizesDisplay.style.borderColor = "var(--accent)";
              sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
            }
          }
        });
      }

      // Export button
      const exportBtn = document.getElementById("exportBtn");
      if (exportBtn) {
        exportBtn.addEventListener("click", function(){
          openModal({
            message: "Export Options & Catalog",
            buttons:[
              { label:"Export to JSON", color:"#8e44ad", onClick: ()=> exportJson() },
              { label:"Export to Excel", color:"#27ae60", onClick: ()=> exportExcel() },
              { 
                label: masterCatalog ? `Catalog (${Object.keys(masterCatalog).length} brands)` : "No Catalog", 
                color: masterCatalog ? "#f39c12" : "#888", 
                onClick: ()=> showCatalogInfo() 
              },
              { label:"Cancel", color:"#888", onClick: ()=>{} }
            ]
          });
        });
      }

      // Import button
      const importBtn = document.getElementById("importBtn");
      const jsonFileInput = document.getElementById("jsonFileInput");
      if (importBtn && jsonFileInput) {
        importBtn.addEventListener("click", function(){
          jsonFileInput.click();
        });
        
        jsonFileInput.addEventListener("change", function(e){
          const file = e.target.files[0];
          if(!file) return;
          
          // Check file size (max 10MB)
          if (file.size > 10 * 1024 * 1024) {
            toast("❌ File is too large (max 10MB)", "#e74c3c");
            e.target.value = "";
            return;
          }
          
          // Check file type
          if (!file.name.endsWith('.json')) {
            toast("❌ Please select a JSON file", "#e74c3c");
            e.target.value = "";
            return;
          }
          
          showLoader("Importing data...");
          
          const reader = new FileReader();
          reader.onload = function(ev){
            try{
              let json = JSON.parse(ev.target.result);
              
              // Try to parse as JavaScript format if regular JSON fails
              if (!Array.isArray(json)) {
                try {
                  json = parseJavaScriptJSON(ev.target.result);
                } catch (jsError) {
                  throw new Error("Invalid JSON format. File should contain an array of shoe entries.");
                }
              }
              
              if(!Array.isArray(json)) {
                throw new Error("Invalid format: data should be an array");
              }
              
              if (json.length === 0) {
                hideLoader();
                toast("⚠️ File is empty - nothing to import", "#f39c12");
                return;
              }
              
              hideLoader();
              
              openModal({
                message: `Import ${json.length} items?`,
                subtext: "Would you like to merge with existing data or replace it?",
                buttons:[
                  { 
                    label:"Merge", 
                    color:"#27ae60", 
                    onClick: ()=> { 
                      if (mergeData(json)) {
                        toast("✅ Data merged successfully", "#27ae60"); 
                      }
                    }
                  },
                  { 
                    label:"Replace", 
                    color:"#e74c3c", 
                    onClick: ()=> { 
                      if (saveData(json)) {
                        render(); 
                        toast("✅ Data replaced successfully", "#27ae60"); 
                      }
                    }
                  },
                  { 
                    label:"Cancel", 
                    color:"#888", 
                    onClick: ()=>{} 
                  }
                ]
              });
            }catch(err){
              hideLoader();
              console.error("Import error", err);
              toast(`❌ ${err.message || "Invalid JSON file"}`, "#e74c3c");
            }
          };
          reader.onerror = function() {
            hideLoader();
            toast("❌ Error reading file", "#e74c3c");
          };
          reader.readAsText(file);
          e.target.value = "";
        });
      }

      // Clear button
      const clearBtn = document.getElementById("clearBtn");
      if (clearBtn) {
        clearBtn.addEventListener("click", function(){
          const data = loadData();
          if(data.length === 0){
            toast("ℹ️ Already empty", "#888");
            return;
          }
          openModal({
            message: `Clear all ${data.length} items?`,
            subtext: "This cannot be undone.",
            buttons:[
              { 
                label:"Clear All", 
                color:"#e74c3c", 
                onClick: ()=> { 
                  showLoader("Clearing data...");
                  setTimeout(() => {
                    if (saveData([])) {
                      document.getElementById("exportNotes").value = "";
                      saveNotes();
                      render(); 
                      hideLoader();
                      toast("🧹 Cleared successfully", "#888"); 
                    } else {
                      hideLoader();
                      toast("❌ Error clearing data", "#e74c3c");
                    }
                  }, 500);
                }
              },
              { label:"Cancel", color:"#888", onClick: ()=>{} }
            ]
          });
        });
      }

      // Print button
      const printBtn = document.getElementById("printBtn");
      if (printBtn) {
        printBtn.addEventListener("click", function(){
          const data = loadData();
          if (!data || data.length === 0) {
            toast("❌ No data to print. Please add some shoes first.", "#e74c3c");
            return;
          }

          showLoader("Generating PDF...");
          
          setTimeout(() => {
            try {
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
              html2pdf().from(pdfContent).set(opt).save().then(() => {
                hideLoader();
              }).catch(err => {
                hideLoader();
                console.error("PDF generation error:", err);
                toast("❌ Error generating PDF", "#e74c3c");
              });
            } catch (error) {
              hideLoader();
              console.error("Print error:", error);
              toast("❌ Error preparing print data", "#e74c3c");
            }
          }, 500);
        });
      }

      // Update Catalog button
      const updateCatalogBtn = document.getElementById("updateCatalogBtn");
      const catalogFileInput = document.getElementById("catalogFileInput");
      
      if (updateCatalogBtn && catalogFileInput) {
        updateCatalogBtn.addEventListener("click", function() {
          catalogFileInput.click();
        });
        
        catalogFileInput.addEventListener("change", handleCatalogUpload);
      }

      // Tutorial on first visit
      const tutorialCompleted = localStorage.getItem('tutorialCompleted');
      if (!tutorialCompleted) {
        setTimeout(() => {
          showTutorial();
        }, 1500);
      } else {
        // Add tutorial button for returning users
        addTutorialButton();
      }

      // Beforeunload warning
      window.addEventListener('beforeunload', function (e) {
        if (hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      });

      // Initial render
      render();
      
      // Initial input count
      setTimeout(() => {
        updateInputCount();
      }, 100);
    } catch (error) {
      console.error("Error initializing app:", error);
      toast("❌ Error initializing application", "#e74c3c");
    }
  }

  // Start everything when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
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
    
    // Initialize display
    updateRealInput(sizesRealInput.value || '');
    
    // Function to update the visual cursor
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
          
          // Ensure cursor is visible
          if (!isCursorVisible) {
            isCursorVisible = true;
            cursorSpan.style.animation = 'blink 1s infinite';
          }
        } else {
          // No value, show placeholder
          sizesValueSpan.textContent = '';
          textBeforeSpan.style.display = 'none';
          cursorSpan.style.display = 'none';
          textAfterSpan.style.display = 'none';
          sizesPlaceholderSpan.style.display = 'inline';
        }
      } catch (error) {
        console.error("Error updating cursor:", error);
      }
    }
    
    // Modified updateRealInput function
    function updateRealInput(value) {
      try {
        if (sizesRealInput) {
          sizesRealInput.value = value;
        }
        
        // Ensure cursor stays within bounds
        cursorPosition = Math.min(cursorPosition, value.length);
        
        updateCursor();
        
        // Update input count
        const inputCount = document.getElementById("inputCount");
        if (inputCount) {
          // Use the calculateInputCount function from the main app
          const count = window.calculateInputCount ? window.calculateInputCount(value) : 0;
          inputCount.textContent = `Input count: ${count}`;
        }
        
        // Update display styling
        if (value) {
          sizesDisplay.style.borderColor = "var(--accent)";
          sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
        } else {
          sizesDisplay.style.borderColor = "";
          sizesDisplay.style.boxShadow = "";
        }
      } catch (error) {
        console.error("Error updating real input:", error);
      }
    }
    
    // Clear display function
    function clearSizesDisplay() {
      cursorPosition = 0;
      updateRealInput('');
    }
    
    // Handle clicks on the display div - set cursor position
    sizesDisplay.addEventListener('click', function(e) {
      try {
        if (!sizesRealInput.value) {
          sizesDisplay.style.borderColor = "var(--accent)";
          sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
          return;
        }
        
        // Get click position relative to the text
        const rect = sizesDisplay.getBoundingClientRect();
        const clickX = e.clientX - rect.left - 10;
        
        // Simple approximation - each character ~8px wide
        const approxChars = Math.floor(clickX / 8);
        cursorPosition = Math.max(0, Math.min(sizesRealInput.value.length, approxChars));
        
        updateCursor();
        
        sizesDisplay.style.borderColor = "var(--accent)";
        sizesDisplay.style.boxShadow = "0 0 0 2px rgba(41, 128, 185, 0.2)";
        
        // Blur any focused input elements
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      } catch (error) {
        console.error("Error handling click on sizes display:", error);
      }
    });
    
    // Handle key presses with cursor positioning
    keyButtons.forEach(button => {
      if (button.classList.contains('backspace') || 
          button.classList.contains('done') || 
          button.classList.contains('clear') ||
          button.classList.contains('arrow-left') ||
          button.classList.contains('arrow-right')) return;
      
      button.addEventListener('click', function() {
        try {
          const key = this.getAttribute('data-key');
          const currentValue = sizesRealInput.value;
          
          // Insert at cursor position
          const newValue = currentValue.substring(0, cursorPosition) + 
                          key + 
                          currentValue.substring(cursorPosition);
          
          cursorPosition += key.length;
          updateRealInput(newValue);
          
          // Ensure no input has focus
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur();
          }
        } catch (error) {
          console.error("Error handling key press:", error);
        }
      });
    });
    
    // Handle arrow left button
    if (arrowLeftBtn) {
      arrowLeftBtn.addEventListener('click', function() {
        try {
          if (cursorPosition > 0) {
            cursorPosition--;
            updateCursor();
          }
        } catch (error) {
          console.error("Error handling arrow left:", error);
        }
      });
    }
    
    // Handle arrow right button
    if (arrowRightBtn) {
      arrowRightBtn.addEventListener('click', function() {
        try {
          if (cursorPosition < sizesRealInput.value.length) {
            cursorPosition++;
            updateCursor();
          }
        } catch (error) {
          console.error("Error handling arrow right:", error);
        }
      });
    }
    
    // Handle backspace
    if (backspaceBtn) {
      let backspaceTimeout = null;
      let backspaceInterval = null;
      let isLongPressActive = false;
      
      const startBackspace = () => {
        try {
          if (cursorPosition > 0) {
            const currentValue = sizesRealInput.value;
            const newValue = currentValue.substring(0, cursorPosition - 1) + 
                            currentValue.substring(cursorPosition);
            
            cursorPosition--;
            updateRealInput(newValue);
          }
        } catch (error) {
          console.error("Error in backspace:", error);
        }
      };
      
      const handleBackspaceStart = (e) => {
        isLongPressActive = false;
        
        backspaceTimeout = setTimeout(() => {
          isLongPressActive = true;
          startBackspace();
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
      
      // Handle regular click
      backspaceBtn.addEventListener('click', function(e) {
        try {
          if (!isLongPressActive && !backspaceInterval) {
            startBackspace();
          }
        } catch (error) {
          console.error("Error in backspace click:", error);
        }
      });
    }
    
    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        try {
          clearSizesDisplay();
        } catch (error) {
          console.error("Error clearing sizes:", error);
        }
      });
    }
    
    // Save/Done button
    if (doneBtn) {
      doneBtn.addEventListener('click', function() {
        try {
          // Call saveFormEntry if it exists
          if (typeof window.saveFormEntry === 'function') {
            window.saveFormEntry();
          } else {
            // Fallback: just submit the form
            const form = document.getElementById('entryForm');
            if (form) form.dispatchEvent(new Event('submit'));
          }
          
          sizesDisplay.style.borderColor = "";
          sizesDisplay.style.boxShadow = "";
          
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur();
          }
        } catch (error) {
          console.error("Error in done button:", error);
        }
      });
    }
    
    // Double click to clear all sizes
    sizesDisplay.addEventListener('dblclick', function(e) {
      try {
        clearSizesDisplay();
      } catch (error) {
        console.error("Error in double click:", error);
      }
    });
    
    // Initialize cursor
    updateCursor();
    
    // Make functions available globally
    window.clearSizesDisplay = clearSizesDisplay;
    window.updateCursor = updateCursor;
    window.cursorPosition = cursorPosition;
    window.updateRealInput = updateRealInput;
    
    // Expose calculateInputCount if not already exposed
    if (!window.calculateInputCount) {
      window.calculateInputCount = function(input) {
        if (!input || !input.trim()) return 0;
        
        try {
          const parts = input.split(',').filter(p => p.trim().length > 0);
          let count = 0;
          
          for (const part of parts) {
            const trimmed = part.trim();
            
            if (trimmed.includes('*')) {
              const subParts = trimmed.split('*');
              if (subParts.length === 2 && !isNaN(subParts[1])) {
                count += parseInt(subParts[1], 10);
              } else {
                count++;
              }
            } else if (trimmed.includes('-')) {
              const rangeParts = trimmed.split('-').map(p => parseFloat(p.trim()));
              if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
                const start = Math.min(rangeParts[0], rangeParts[1]);
                const end = Math.max(rangeParts[0], rangeParts[1]);
                const includeHalfSizes = document.getElementById('includeHalfSizes').checked;
                const step = includeHalfSizes ? 0.5 : 1;
                count += Math.floor((end - start) / step) + 1;
              } else {
                count++;
              }
            } else {
              count++;
            }
          }
          
          return count;
        } catch (err) {
          console.error("Error calculating input count:", err);
          return 0;
        }
      };
    }
  } catch (error) {
    console.error("Error initializing custom keyboard:", error);
  }
});