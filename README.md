# 🌐 Tajrobe Wiki Chrome Extension  
<img src="assets/icons/icon.png" alt="Tajrobe Wiki Logo" width="1000"/>

A modern **Chrome Extension** (Manifest V3) that automatically detects the website you are visiting and fetches its profile from [Tajrobe.wiki](https://tajrobe.wiki).  
See company ratings, reviews, categories, and verification status instantly — right from your browser toolbar.  

---

## ✨ Features  

- 🔍 **Automatic domain detection** – identifies the active site’s domain in real time.  
- 🌐 **Instant Tajrobe lookup** – queries the [Tajrobe.wiki API](https://tajrobe.wiki) for matching company profiles.  
- 📊 **Profile at a glance** – shows company name, logo, description, rating, review count, and categories.  
- 🖼 **Dynamic toolbar icon** – status-aware icons for searching, success, data found, or no data.  
- 📌 **Popup interface** – clean RTL-friendly UI with Persian font support (`Vazirmatn`).  
- 🗂 **Per-tab storage** – profile and status are cached per tab and auto-cleared when switching domains.  

---

## 📸 Screenshots  

![Extension Popup](https://s34.picofile.com/file/8486768942/Screenshot_from_2025_09_03_01_46_38.png)
![Extension Popup](https://s34.picofile.com/file/8486768968/Screenshot_from_2025_09_03_01_47_22.png)
![Extension Popup](https://s34.picofile.com/file/8486768976/Screenshot_from_2025_09_03_01_48_43.png)
![Extension Popup](https://s34.picofile.com/file/8486768984/Screenshot_from_2025_09_03_01_49_00.png)
![Extension Popup](https://s34.picofile.com/file/8486768934/Screenshot_from_2025_09_03_01_46_28.png)


---

## 🛠️ Tech Stack  

- **Manifest V3** Chrome Extension  
- **JavaScript (ES6+)**  
- **Chrome APIs**: `storage`, `tabs`, `webNavigation`, `action`  
- **HTML / CSS** for popup interface  
- **Google Fonts** – [Vazirmatn](https://fonts.google.com/specimen/Vazirmatn) for Persian-friendly typography  

---

## 📂 Project Structure  

.
├── manifest.json # Extension manifest (MV3)
├── assets/
│ └── icons/ # Toolbar & status icons
├── src/
│ ├── util.js # Background service worker (domain lookup, API calls, storage)
│ ├── popup.html # Popup interface markup
│ ├── popup.js # Popup logic (UI updates, storage listener)
│ └── popup.css # Popup styling (RTL, responsive)




---

## 🚀 Installation (Developer Mode)  

1. Clone the repository:  
   ```bash
   git clone https://github.com/navidrezadoost/extension-tajrobe-wiki.git
   cd tajrobe-wiki-extension
