// This is the service worker entry point for the extension.
// It listens for tab navigation events, extracts the domain,
// queries the Tajrobe.wiki API for company data, and updates
// extension state (icons + cached profile info per tab).
// ================================

/**
 * Extracts the domain name (hostname) from a URL.
 * Removes the leading "www." if present.
 *
 * @param {string} url - The full tab URL.
 * @returns {string|null} The normalized domain (e.g. "example.com") or null on failure.
 */
function getDomain(url) {
    try {
        const h = new URL(url).hostname;
        return h.replace(/^www\./, "");
    } catch {
        return null; // invalid or non-http(s) URL
    }
}

// ---------------------------
// Storage key helpers
// ---------------------------
// All state is stored in chrome.storage.local, keyed by tabId.
// This ensures per-tab isolation (each tab maintains its own state).
const KEY = {
    domain: (tabId) => `domain_${tabId}`,
    status: (tabId) => `status_${tabId}`,
    profile: (tabId) => `profile_${tabId}`,
};

// ---------------------------
// Icon mapping
// ---------------------------
// Maps statuses to icon asset paths.
// ⚠️ IMPORTANT: Paths must be relative to extension root (no leading "/").
const ICON = {
    falild: "assets/icons/falild.png", // idle/default state
    searching: "/assets/icons/searching.png", // API lookup in progress
    success: "/assets/icons/success.png", // search success
    data_returned: "/assets/icons/success.png", // profile data fetched
    no_data: "assets/icons/no-data.png", // no company found
};

/**
 * Update the extension toolbar icon for a given tabId and status.
 * If status is unrecognized, falls back to "falild" (idle).
 *
 * @param {number} tabId
 * @param {string} status
 */
function setIcon(tabId, status) {
    chrome.action.setIcon({ tabId, path: ICON[status] || ICON.falild });
}

/**
 * Updates the status value in storage and also refreshes the icon.
 *
 * @param {number} tabId
 * @param {string} status
 */
function setStatus(tabId, status) {
    chrome.storage.local.set({ [KEY.status(tabId)]: status });
    setIcon(tabId, status);
}

/**
 * Clears cached data for a given tab (profile + status).
 * Optionally keeps the last known domain (used for in-domain reloads).
 *
 * @param {number} tabId
 * @param {Object} options
 * @param {boolean} options.keepDomain - If true, domain key is preserved.
 */
function clearTabData(tabId, { keepDomain = false } = {}) {
    const remove = [KEY.profile(tabId), KEY.status(tabId)];
    if (!keepDomain) remove.push(KEY.domain(tabId));
    chrome.storage.local.remove(remove);

    // Reset icon to idle
    setIcon(tabId, "falild");
}

// ---------------------------
// Storage convenience wrappers
// ---------------------------
const getLocal = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const setLocal = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

/**
 * Runs the lookup flow for a given domain:
 * 1. Mark tab status as "searching"
 * 2. Call search endpoint with domain
 * 3. If result exists, fetch full profile by slug
 * 4. Store profile + update status to "data_returned"
 * 5. Otherwise mark as "no_data"
 *
 * Includes race-condition guards: ensures the domain for this tab
 * hasn't changed between fetch calls.
 *
 * @param {number} tabId
 * @param {string} domain
 */
/**
 * Runs the lookup flow for a given domain:
 * 1. Mark tab status as "searching"
 * 2. Call search endpoint with domain
 * 3. Validate that the returned URL includes the real domain
 * 4. If valid → fetch profile
 * 5. Otherwise → mark as "no_data"
 *
 * @param {number} tabId
 * @param {string} domain
 */
async function runLookup(tabId, domain) {
    try {
        // Guard: make sure the tab still matches this domain
        const { [KEY.domain(tabId)]: domNow } = await getLocal([KEY.domain(tabId)]);
        if (domNow !== domain) return;

        setStatus(tabId, "searching");

        // 1. Search request
        const sRes = await fetch(`https://tajrobe.wiki/api/client/search?q=${encodeURIComponent(domain)}&citySlug=iran`);
        const sJson = await sRes.json();

        // Guard again after network roundtrip
        const { [KEY.domain(tabId)]: domAfterSearch } = await getLocal([KEY.domain(tabId)]);
        if (domAfterSearch !== domain) return;

        // 2. Validate data exists
        if (sJson && Array.isArray(sJson.data) && sJson.data.length > 0) {
            // ✅ Case A: Multiple results → let popup show a list
            if (sJson.data.length > 1) {
                await setLocal({
                    [KEY.status(tabId)]: "multiple_results",
                    [KEY.profile(tabId)]: sJson.data, // store array for popup
                });
                setIcon(tabId, "success");
                return;
            }

            // ✅ Case B: Only one result → validate + fetch profile
            const candidate = sJson.data[0];

            // Extract hostname from candidate.url
            let candidateHost;
            try {
                candidateHost = new URL(candidate.url).hostname.replace(/^www\./, "").toLowerCase();
            } catch {
                candidateHost = "";
            }

            const realDomain = domain.toLowerCase();
            const isMatch = candidateHost === realDomain || candidateHost.endsWith("." + realDomain);

            if (!isMatch) {
                // Example: domain = "youtube.com"
                // candidateHost = "kajyoutube.com" → ❌ not a match
                setStatus(tabId, "no_data");
                return;
            }

            // Passed validation → continue with profile fetch
            setStatus(tabId, "success");

            const slug = candidate.slug;
            const pRes = await fetch(`https://tajrobe.wiki/api/client/profile/${encodeURIComponent(slug)}`);
            const pJson = await pRes.json();

            // Guard again (domain may have changed mid-fetch)
            const { [KEY.domain(tabId)]: domAfterProfile } = await getLocal([KEY.domain(tabId)]);
            if (domAfterProfile !== domain) return;

            // Store profile + status
            await setLocal({
                [KEY.profile(tabId)]: pJson?.data ?? null,
                [KEY.status(tabId)]: "data_returned",
            });
            setIcon(tabId, "data_returned");
        } else {
            // No company data for this domain
            setStatus(tabId, "no_data");
        }
    } catch (e) {
        console.error("Lookup failed:", e);
        setStatus(tabId, "no_data");
    }
}

/**
 * handleNav – Main navigation handler for a tab.
 *
 * Called whenever a navigation is committed (new URL loaded).
 * - Clears tab data when leaving HTTP(S) or invalid domain
 * - If domain changed → clear profile/status
 * - Always re-run lookup for the new domain
 *
 * @param {number} tabId
 * @param {string} url
 */
async function handleNav(tabId, url) {
    const isHttp = /^https?:/i.test(url);
    if (!isHttp) {
        clearTabData(tabId);
        return;
    }

    const newDomain = getDomain(url);
    if (!newDomain) {
        clearTabData(tabId);
        return;
    }

    // -----------------------------
    // Skip rule: ignore google.com and all subdomains (*.google.com)
    // -----------------------------
    if (newDomain === "google.com" || newDomain.endsWith(".google.com")) {
        // Instead of searching, just mark as no_data
        await setLocal({
            [KEY.domain(tabId)]: newDomain,
            [KEY.status(tabId)]: "no_data",
        });
        setIcon(tabId, "no_data");
        return;
    }

    const { [KEY.domain(tabId)]: oldDomain } = await getLocal([KEY.domain(tabId)]);

    if (oldDomain && oldDomain !== newDomain) {
        clearTabData(tabId, { keepDomain: true });
    }

    await setLocal({ [KEY.domain(tabId)]: newDomain });
    runLookup(tabId, newDomain);
}

// ---------------------------
// Event listeners
// ---------------------------

// Fires for *main frame* navigations (back/forward/reload/new URL)
chrome.webNavigation.onCommitted.addListener(({ tabId, url, frameId }) => {
    if (frameId === 0) handleNav(tabId, url);
});

// When a tab is closed, clean up its storage keys
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove([KEY.profile(tabId), KEY.status(tabId), KEY.domain(tabId)]);
});
