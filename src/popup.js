/**
 * updateUI – Renders the popup interface depending on the current extension state
 *
 * @param {string} status  - Current status of the lookup process:
 *                           "searching" | "success" | "data_returned" | "no_data" | "default"
 * @param {Object|null} profile - The profile object fetched from tajrobe.wiki API (or null if not available)
 */
function updateUI(status, profile = null) {
  // Grab key DOM elements once at the top
  const statusElement = document.getElementById("status");
  const loadingState = document.getElementById("loading-state");
  const companyInfo = document.getElementById("company-info");
  const noDataState = document.getElementById("no-data-state");

  // Reset: hide all major sections before rendering the current one
  loadingState.classList.add("hidden");
  companyInfo.classList.add("hidden");
  noDataState.classList.add("hidden");

  switch (status) {
    case "searching":
      // User has just navigated, API request in-flight
      statusElement.textContent = "در حال جستجو...";
      loadingState.classList.remove("hidden");
      break;

    case "success":
      // Search API returned a company slug; profile fetch will follow
      statusElement.textContent = "یافتن پروفایل";
      loadingState.classList.remove("hidden");
      break;

    case "data_returned":
      // Full profile successfully fetched and ready to display
      statusElement.textContent = "متصل";
      companyInfo.classList.remove("hidden");

      if (profile) {
        // --- Company Name ---
        document.getElementById("company-name").textContent = profile.name || "Unknown";

        // --- Logo handling ---
        const logoImg = document.getElementById("company-logo");
        const logoPlaceholder = document.getElementById("company-logo-placeholder");
        if (profile.logo) {
          // Use provided logo URL
          logoImg.src = profile.logo;
          logoImg.style.display = "block";
          logoPlaceholder.style.display = "none";
        } else {
          // Fallback: hide <img>, show SVG placeholder
          logoImg.style.display = "none";
          logoPlaceholder.style.display = "flex";
        }

        // --- Rating and review count ---
        const ratingVal = Number(profile.rating) || 0;
        document.getElementById("rating-value").textContent = ratingVal.toFixed(1);
        document.getElementById("review-count").textContent = `(${profile.total_reviews || 0} تجربه)`;

        // --- Verification badge ---
        const verificationBadge = document.getElementById("verification-badge");
        if (profile.is_verified) {
          verificationBadge.classList.remove("hidden");
        } else {
          verificationBadge.classList.add("hidden");
        }

        // --- Description (HTML provided by API, so it is inserted directly) ---
        const descEl = document.getElementById("description");
        descEl.innerHTML = profile.description || "";

        // --- Categories (array of objects: {id, name, slug, icon,...}) ---
        const categoriesEl = document.getElementById("categories");
        categoriesEl.innerHTML = "";
        if (profile.categories && profile.categories.length > 0) {
          categoriesEl.classList.remove("hidden");
          profile.categories.forEach(cat => {
            const tag = document.createElement("div");
            tag.className = "category-tag";
            tag.textContent = cat.name;
            categoriesEl.appendChild(tag);
          });
        } else {
          categoriesEl.classList.add("hidden");
        }

        // --- External link to Tajrobe profile ---
        const visitBtn = document.getElementById("visit-site");
        if (profile.url) {
          // Link to the official Tajrobe profile page using slug
          visitBtn.href = `https://tajrobe.wiki/profile/${profile.slug}?page=1&sort=most_relevant`;
          visitBtn.style.display = "flex";
        } else {
          visitBtn.style.display = "none";
        }
      }
      break;

    case "no_data":
      // API returned no matches for this domain
      statusElement.textContent = "یافت نشد";
      noDataState.classList.remove("hidden");
      break;

    case "idle":
      statusElement.textContent = "غیرفعال";
      noDataState.classList.remove("hidden");
      noDataState.querySelector("h3").textContent = "اتصال افزودنه برقرار است";
      noDataState.querySelector("p").textContent = "برای بهترین انتخابات ما تجربیات مون را باهات به اشتراک میگذاریم";
      break;


    default:
      // Initialization state (before any lookup starts)
      statusElement.textContent = "Initializing...";
      loadingState.classList.remove("hidden");
      break;
  }
}

/**
 * getCurrentTab – Utility to fetch the active tab in the current window
 *
 * @returns {Promise<Tab>} Resolves with the current active tab object
 */
function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

/**
 * init – Popup bootstrap
 *
 * - Fetches current tab’s profile/status from chrome.storage.local
 * - Renders UI immediately
 * - Subscribes to chrome.storage.onChanged for live updates
 */
// Initialize popup
(async function init() {
  const tab = await getCurrentTab();
  if (!tab) return;

  const profileKey = "profile_" + tab.id;
  const statusKey = "status_" + tab.id;

  chrome.storage.local.get([profileKey, statusKey], (res) => {
    let status = res[statusKey];
    let profile = res[profileKey];

    // ✅ Handle case: no navigation yet (chrome://newtab or blank page)
    const isHttp = /^https?:/i.test(tab.url || "");
    if (!isHttp) {
      status = "idle"; // new state for idle/inactive
    }

    updateUI(status || "idle", profile);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[statusKey] || changes[profileKey]) {
      chrome.storage.local.get([profileKey, statusKey], (res) => {
        updateUI(res[statusKey] || "idle", res[profileKey]);
      });
    }
  });
})();

