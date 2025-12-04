# Shoe Tracker — User Guide & Setup

Shoe Tracker is a browser-based Progressive Web App (PWA) for managing your shoe inventory.  
It supports adding, editing, exporting, importing, and printing inventory reports — and works fully offline after the first load.  

---

## ✨ Features

- **Add Shoes**: Enter Brand, Color, and Sizes (comma-separated). Supports ranges (`38-40`), halves (`10.5`), fractions (`6/7`), and quantities (`42*3`).  
- **Edit Inventory**: Decrease quantity (➖) or delete (🗑️).  
- **Search & Sort**: Filter by brand, color, or size. Sort any column (Brand, Color, Size, Count) with colored arrows.  
- **Notes**: Add optional notes to include when exporting or printing.  
- **Export Options**: Save data to **Excel**, **JSON**, or **PDF**.  
- **Import Options**: Import JSON backups with Merge or Replace mode.  
- **Print / PDF Export**: Generates a print-friendly PDF inventory report (with notes + totals).  
- **Auto-Save**: Data is auto-saved every 20s if changes are detected, with a visual indicator.  
- **Unsaved Warning**: Alerts before closing the page if unsaved changes exist.  
- **Tutorial**: Step-by-step guided tour on first use (with highlights).  
- **PWA Install**: Prompt to install app on desktop/mobile with dismiss/later options.  
- **Offline Support**: Works offline with service worker cache.  
- **Clear All**: Delete all entries and notes at once (confirmation required).  

---

## 🆕 Recent Updates

**Custom Virtual Keyboard & Input Improvements:**
- **Custom Numeric Keyboard**: No mobile keyboard popups - uses custom virtual keyboard with numbers, symbols (`/`, `*`, `-`, `.`, `,`) and special functions
- **Smart Backspace**: Single tap deletes one character, long-press (>500ms) for rapid deletion
- **Quick Clear**: Double-tap the sizes box or press "C" button to clear all sizes instantly
- **Enter Key Navigation**: Press Enter to move between fields (brand → color → sizes box)
- **Input Count Display**: Shows real-time count of parsed sizes as you type
- **Keyboard Prevention**: Mobile keyboards don't interfere with custom input experience

**Enhanced Size Parsing:**
- **Fractional Ranges**: Now supports `10.5-12.5` creating `10.5, 11, 11.5, 12, 12.5`
- **Half-Size Option**: Checkbox to include/exclude half sizes in ranges (e.g., `38-40` with or without `38.5`, `39.5`)
- **Mixed Format Support**: Combine formats like `38-40, 42*2, 10.5, 6/7*2` in one entry

**Improved User Experience:**
- **Sizes Input Display**: Visual feedback with placeholder text and value display
- **Auto-Clear**: Sizes box automatically clears after saving entry
- **Better Touch Response**: Optimized for mobile devices with responsive custom keyboard
- **Dismissable PWA Prompt**: Install notification can be dismissed permanently or temporarily

---

## ⚙️ Installation / Setup

1. **Download Files**  
   - `index.html`  
   - `app.js`  
   - `service-worker.js`  
   - External libs:  
     - `xlsx.full.min.js` (Excel export)  
     - `html2pdf.bundle.min.js` (PDF export)  

2. **Open in Browser**  
   - Open `index.html` in any modern browser (Chrome, Edge, Firefox, Brave, Safari).  
   - App registers its service worker on first load.  

3. **Offline Usage**  
   - After first load, app works offline.  
   - Data is stored locally in `localStorage`.  

---

## 🖱️ Usage Instructions

### **Adding Shoes (Updated)**
1. Enter **Brand**, **Color**, and **Sizes** using the custom keyboard
   - **Custom Keyboard Features**:
     - Tap number/symbol buttons to enter sizes
     - Use "⌫" for backspace (tap once or hold for rapid delete)
     - Use "C" to clear all sizes instantly
     - Press "Space" for spaces, "Done" to save entry
   - **Advanced Format Examples**:
     - `10.5-12.5` → creates `10.5, 11, 11.5, 12, 12.5`
     - Enable "Include half sizes" checkbox for ranges to include intermediate half sizes
     - `6/7*2` → adds two pairs of fractional size 6/7
     - Mixed: `38-40, 42*2, 10.5, 6/7*2`
2. Click **Save Entry**.  

### **Custom Keyboard Usage**
- **Click the sizes box** to activate custom keyboard (no mobile keyboard appears)
- **Double-click the sizes box** to clear all entered sizes
- **Use Enter key** to navigate between fields without touching mouse
- **Real-time counting** shows how many sizes will be created as you type

### **Editing / Deleting / Adding**
- **➖ Decrease**: Reduces count by 1. If count reaches 1, confirmation is asked before deletion.  
- **➕ Add**:Adds Count by 1  
- **🗑️ Delete**: Permanently deletes row (confirmation required).  

### **Searching & Sorting**
- Use the search box to filter inventory.  
- Click table headers to sort with arrows:  
  - Green ▲ = Ascending  
  - Red ▼ = Descending  

### **Exporting Data**
1. Click **Export Options**.  
2. Choose:  
   - **Excel** → Saves `.xlsx` file. Notes included at bottom.  
   - **JSON** → Saves `.json` file. Notes included under `notes`.  
   - **PDF** → Saves a styled report with table, notes, totals, and date.  

### **Importing Data**
1. Click **Import JSON** → choose a `.json` file.  
2. Choose import type:  
   - **Merge** → Combines with existing inventory.  
   - **Replace** → Overwrites inventory completely.  

### **Printing / PDF**
- Use **Print Inventory** button → automatically downloads PDF with report.  

### **Auto-Save**
- Data auto-saves every **20 seconds** if unsaved changes exist.  
- A temporary **Saved** indicator appears in the top corner.  

### **Tutorial**
- On first visit, a guided tutorial starts automatically.  
- Can be navigated step-by-step with highlighted UI elements.  

### **Clearing All Data**
- Click **Clear All**.  
- Confirmation required before deleting all entries.  

### **PWA Installation (Updated)**
- On supported browsers, a **dismissable install notification** appears in bottom-left
- **Three options**:
  - **Install Now** → Adds to home screen/app drawer
  - **Not Now** → Hides for 7 days, then shows again
  - **× Dismiss** → Never shows again (can reset in browser settings)
- If notification doesn't appear, use browser menu: **More Options → "Add to Home Screen"**

---

## 🛠️ Technical Details

- **Storage**: `localStorage` key: `shoe_entries_json_v11.0`.  
- **Service Worker**: Offline-first caching of app shell.  
- **Custom Input System**: Virtual keyboard prevents mobile keyboard interference
- **Enhanced Parsing**: Supports fractional ranges and improved size format handling
- **Touch Optimization**: Responsive custom keyboard with proper touch event handling
- **Excel Export**: via [XLSX.js](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js).  
- **PDF Export**: via [html2pdf.js](https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js).  
- **Auto-Save**: Every 20s, if data changed.  
- **UID Generation**: `crypto.randomUUID()` (or fallback).  
- **Data Normalization**: Cleans strings, ensures numeric counts.  
- **Sorting**: Special handling for fractional and range-based sizes.  

---

## 🔧 Troubleshooting

**Custom Keyboard Not Responding:**
- Ensure you're clicking the actual size box area
- Try double-tap instead of single tap if experiencing delays
- Check that no other input field has focus

**Mobile Keyboard Still Appears:**
- This happens on some browsers that ignore `readonly` attributes
- Solution: Manually dismiss the keyboard and use the custom keyboard
- The app will work correctly regardless

**Backspace Deletes Multiple Characters:**
- Quick tap: Deletes one character
- Long press (>500ms): Starts rapid deletion
- If deleting too many, use shorter taps

**Data Not Saving:**
- Check browser storage permissions
- Ensure all required fields are filled (brand, color, sizes)
- Look for auto-save indicator (top-right corner)

**Offline Mode Issues:**
- First load must be online to cache resources
- Service worker version: `shoe-tracker-cache-v11.0`
- Clear browser cache if updates aren't showing

---

## 📦 Dependencies

- [XLSX.js v0.18.5](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js)  
- [html2pdf.js v0.9.3](https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js)  
- Modern browsers (Chrome, Edge, Brave, Firefox, Safari).  

---

## 📝 Notes

- Fully offline-capable after first load.  
- Data persists in browser, never sent externally.  
- Notes are preserved in all exports/imports.  
- Guided tutorial only shows once (stored in localStorage).
- Custom keyboard designed for mobile-first experience without popup keyboard interference.
- All size parsing happens locally - no data leaves your device.
