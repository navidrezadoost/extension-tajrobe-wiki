function setRatingStars(rating) {
  const starImg = document.getElementById("rating-star-image");
  const rounded = Math.round(parseInt(rating)); // round 0–5
  starImg.src = `/assets/icons/stars-${rounded}.svg`;
}



/**
 * updateUI – Renders the popup interface depending on the current extension state
 *
 * @param {string} status  - Current status of the lookup process:
 *                           "searching" | "success" | "data_returned" | "no_data" | "default"
 * @param {Object|null} profile - The profile object fetched from tajrobe.wiki API (or null if not available)
 */
function updateUI(status, profile = null) {
    const statusElement = document.getElementById("status");
    const loadingState = document.getElementById("loading-state");
    const companyInfo = document.getElementById("company-info");
    const noDataState = document.getElementById("no-data-state");
    const resultsList = document.getElementById("results-list");
    const backButton = document.getElementById("back-button");

    // Reset all sections
    loadingState.classList.add("hidden");
    companyInfo.classList.add("hidden");
    noDataState.classList.add("hidden");
    resultsList.classList.add("hidden");
    backButton.classList.add("hidden");

    switch (status) {
        case "searching":
            statusElement.textContent = "در حال جستجو...";
            loadingState.classList.remove("hidden");
            break;

        case "success":
            statusElement.textContent = "یافتن پروفایل";
            loadingState.classList.remove("hidden");
            break;

        case "multiple_results":
            statusElement.textContent = "چند نتیجه یافت شد";
            resultsList.classList.remove("hidden");
            resultsList.innerHTML = "";

            profile.forEach((result, index) => {
                const item = document.createElement("div");
                item.className = "result-item slide-up";
                item.style.animationDelay = `${index * 0.05}s`; // stagger animation
                item.textContent = result.name || result.url;

                item.addEventListener("click", async () => {
                    const pRes = await fetch(`https://tajrobe.wiki/api/client/profile/${encodeURIComponent(result.slug)}`);
                    const pJson = await pRes.json();
                    const tab = await getCurrentTab();

                    chrome.storage.local.set({
                        ["profile_" + tab.id]: pJson?.data ?? null,
                        ["status_" + tab.id]: "data_returned",
                        ["last_results_" + tab.id]: profile,
                    });
                });

                resultsList.appendChild(item);
            });
            break;

        case "data_returned":
            statusElement.textContent = "یافت شد";
            companyInfo.classList.remove("hidden");
            companyInfo.classList.add("fade-in");

            // check if we came from multiple results → show back button
            getCurrentTab().then((tab) => {
                chrome.storage.local.get(["last_results_" + tab.id], (res) => {
                    if (res["last_results_" + tab.id]) {
                        backButton.classList.remove("hidden");
                        backButton.onclick = () => {
                            chrome.storage.local.set({
                                ["profile_" + tab.id]: res["last_results_" + tab.id],
                                ["status_" + tab.id]: "multiple_results",
                            });
                        };
                    }
                });
            });

            if (profile) {
                document.getElementById("company-name").textContent = profile.name || "Unknown";
                const logoImg = document.getElementById("company-logo");
                const logoPlaceholder = document.getElementById("company-logo-placeholder");
                if (profile.logo) {
                    logoImg.src = profile.logo;
                    logoImg.style.display = "block";
                    logoPlaceholder.style.display = "none";
                } else {
                    logoImg.style.display = "none";
                    logoPlaceholder.style.display = "flex";
                }

                const ratingVal = Number(profile.rating) || 0;
                document.getElementById("rating-value").textContent = ratingVal.toFixed(1);
                setRatingStars(ratingVal.toFixed(1));
                
                document.getElementById("review-count").textContent = `(${profile.total_reviews || 0} تجربه)`;

                const verificationBadge = document.getElementById("verification-badge");
                verificationBadge.classList.toggle("hidden", !profile.is_verified);

                document.getElementById("description").innerHTML = profile.description || "";

                const categoriesEl = document.getElementById("categories");
                categoriesEl.innerHTML = "";
                if (profile.categories && profile.categories.length > 0) {
                    categoriesEl.classList.remove("hidden");
                    profile.categories.forEach((cat) => {
                        const tag = document.createElement("div");
                        tag.className = "category-tag";
                        tag.textContent = cat.name;
                        categoriesEl.appendChild(tag);
                    });
                } else {
                    categoriesEl.classList.add("hidden");
                }

                const visitBtn = document.getElementById("visit-site");
                if (profile.slug) {
                    visitBtn.href = `https://tajrobe.wiki/profile/${profile.slug}?page=1&sort=most_relevant`;
                    visitBtn.style.display = "flex";
                } else {
                    visitBtn.style.display = "none";
                }
            }
            break;

        case "no_data":
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

