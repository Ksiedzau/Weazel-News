// app.js - logowanie (Supabase + Discord), zakładki, baza newsów + Panel Admina

function normalizeTag(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let supabaseInstance = null;
let currentUser = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseLib = window.supabase;
  if (!supabaseLib) {
    console.error("Supabase CDN nie jest załadowany (window.supabase = undefined).");
    return null;
  }

  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_KEY;

  if (!url || !key) {
    console.error("Brak window.SUPABASE_URL lub window.SUPABASE_KEY w config.js");
    return null;
  }

  supabaseInstance = supabaseLib.createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseInstance;
}

function getDiscordIdFromUser(user) {
  if (!user) return null;

  // najpewniejsze: identities dla provider="discord"
  const identities = user.identities || [];
  const discordIdentity = identities.find(i => i.provider === "discord");
  if (discordIdentity?.id) return String(discordIdentity.id);

  // fallback (czasem może być inaczej)
  if (user.id) return String(user.id);

  return null;
}

function isUserInDiscordList(user, list) {
  const ids = Array.isArray(list) ? list.map(String) : [];
  const did = getDiscordIdFromUser(user);
  return !!did && ids.includes(String(did));
}

// --- TAB SWITCHING (działa z Twoim menu na podstawie data-tab) ---
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(`tab-${tabId}`) || document.getElementById(tabId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    const t = btn.getAttribute("data-tab");
    if (t === tabId) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // w mobile jak masz sidebar-btn
  document.querySelectorAll(".sidebar-btn").forEach(btn => {
    const t = btn.getAttribute("data-tab");
    if (t === tabId) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

function setupTabSwitching() {
  // desktop nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) switchTab(tabId);
    });
  });

  // mobile sidebar (jeśli masz)
  document.querySelectorAll(".sidebar-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) switchTab(tabId);
    });
  });

  // jeśli masz onclick="switchTab('...')" to i tak działa, ale to nic nie szkodzi
}

// --- UI LOGOWANIA ---
function applyRoleVisibility(user) {
  const adminIds = window.ADMIN_DISCORD_IDS || [];
  const isAdmin = isUserInDiscordList(user, adminIds);

  const navAdmin =
    document.getElementById("nav-admin") ||
    document.querySelector('[data-tab="admin"]');

  const tabAdmin =
    document.getElementById("tab-admin") ||
    document.getElementById("admin") ||
    document.querySelector('#tab-admin, [data-tab="admin"]');

  if (navAdmin) navAdmin.style.display = isAdmin ? "" : "none";
  if (tabAdmin) {
    if (!isAdmin) {
      tabAdmin.classList.remove("active");
      // powrót na stronę główną
      const active = document.querySelector(".tab-content.active");
      if (active && (active.id === "tab-admin" || active.getAttribute("data-tab") === "admin")) {
        switchTab("home");
      }
    }
  }
}

function updateUI(user) {
  const loginBtn = document.getElementById("btn-login");
  const userInfo = document.getElementById("user-info");

  if (!loginBtn || !userInfo) {
    // Jeśli masz inne ID w index.html, daj znać jakie - dopasuję 1:1
    return;
  }

  if (user) {
    currentUser = user;
    loginBtn.style.display = "none";
    userInfo.style.display = "flex";

    const meta = user.user_metadata || {};
    const nickname =
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      user.email ||
      "Użytkownik";

    const avatarUrl = meta.avatar_url || meta.picture || "";

    const userNameEl = document.getElementById("user-name");
    const userAvatarEl = document.getElementById("user-avatar");

    if (userNameEl) userNameEl.textContent = nickname;
    if (userAvatarEl && avatarUrl) userAvatarEl.src = avatarUrl;

    applyRoleVisibility(user);
  } else {
    currentUser = null;
    loginBtn.style.display = "flex";
    userInfo.style.display = "none";
    applyRoleVisibility(null);
    switchTab("home");
  }
}

async function loginWithDiscord() {
  const supabase = getSupabase();
  if (!supabase) return alert("Supabase nie jest gotowy.");

  const redirectUrl = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: redirectUrl }
  });

  if (error) {
    console.error(error);
    alert("Błąd logowania: " + error.message);
  }
}

async function logout() {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) console.error(error);

  window.location.href = window.location.origin + window.location.pathname;
}

// --- BAZA DANYCH ---
const NEWS_TABLE = "news"; // jeśli masz inną nazwę tabeli, zmień tutaj

function guessContainerByTag(tagNorm) {
  // Dopasowujemy pod typowe tagi z Twojej strony
  // home: domyślnie
  const containers = {
    home: document.getElementById("home-container"),
    wiadomosci: document.getElementById("wiadomosci-container"),
    artykuly: document.getElementById("artykuly-container"),
    tiktoki: document.getElementById("tiktoki-container"),
    cityhall: document.getElementById("cityhall-container")
  };

  if (!containers.home && !containers.wiadomosci && !containers.artykuly && !containers.tiktoki && !containers.cityhall) {
    return null;
  }

  if (tagNorm === "STRONAGLOWNA") return containers.home;
  if (tagNorm === "WIADOMOSCI") return containers.wiadomosci;
  if (tagNorm === "ARTYKUŁY" || tagNorm === "ARTYKUY" || tagNorm === "ARTYKULY") return containers.artykuly;
  if (tagNorm === "TIKTOKI") return containers.tiktoki;

  // city hall / rządowe
  if (tagNorm === "CITYHALL" || tagNorm === "CITYHALL(RZADOWE)" || tagNorm === "RZADOWE") return containers.cityhall;

  return containers.home;
}

function renderPostCard(post) {
  const title = escapeHtml(post.title || "");
  const tag = escapeHtml(post.tag || "");
  const author = escapeHtml(post.author || "Admin");
  const content = escapeHtml(post.content || "");

  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString("pl-PL")
    : "";

  const img = post.image_url ? escapeHtml(post.image_url) : "https://i.imgur.com/vHdfC1B.png";

  return `
    <div class="card">
      <img class="card-media" src="${img}" alt="News image">
      <div class="card-body">
        <span class="card-tag">${tag}</span>
        <h2 class="card-title">${title}</h2>
        <div class="card-meta">Autor: ${author} | ${dateStr}</div>
        <p class="card-text">${content}</p>
      </div>
    </div>
  `;
}

async function fetchPosts() {
  const supabase = getSupabase();
  if (!supabase) return;

  const cHome = document.getElementById("home-container");
  const cW = document.getElementById("wiadomosci-container");
  const cA = document.getElementById("artykuly-container");
  const cT = document.getElementById("tiktoki-container");
  const cC = document.getElementById("cityhall-container");

  [cHome, cW, cA, cT, cC].forEach(el => { if (el) el.innerHTML = ""; });

  const { data, error } = await supabase
    .from(NEWS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchPosts error:", error);
    return;
  }

  if (!data || data.length === 0) {
    if (cHome) cHome.innerHTML = `<p style="color: var(--text-muted);">Brak wpisów.</p>`;
    return;
  }

  for (const post of data) {
    const tagNorm = normalizeTag(post.tag);
    const container = guessContainerByTag(tagNorm) || cHome;
    if (container) container.innerHTML += renderPostCard(post);
  }
}

// --- ADMIN: dodawanie ---
async function handleCreatePost(e) {
  e.preventDefault();

  const supabase = getSupabase();
  if (!supabase) return;

  if (!currentUser) return alert("Musisz być zalogowany.");

  const adminIds = window.ADMIN_DISCORD_IDS || [];
  if (!isUserInDiscordList(currentUser, adminIds)) {
    return alert("Brak uprawnień do Panelu Admina.");
  }

  const title = document.getElementById("news-title")?.value || "";
  const tag = document.getElementById("news-tag")?.value || "";
  const imageUrl = document.getElementById("news-image")?.value || "";
  const content = document.getElementById("news-content")?.value || "";

  if (!title || !tag || !content) return alert("Uzupełnij wymagane pola.");

  const meta = currentUser.user_metadata || {};
  const authorName = meta.full_name || meta.name || "Admin";

  const { error } = await supabase.from(NEWS_TABLE).insert([
    {
      title,
      tag,
      image_url: imageUrl,
      content,
      author: authorName,
      created_at: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error(error);
    alert("Błąd publikacji: " + error.message);
    return;
  }

  document.getElementById("news-form")?.reset();
  await fetchPosts();
}

// --- START ---
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = getSupabase();
  if (!supabase) return;

  setupTabSwitching();

  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");

  if (loginBtn) loginBtn.addEventListener("click", loginWithDiscord);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const newsForm = document.getElementById("news-form");
  if (newsForm) newsForm.addEventListener("submit", handleCreatePost);

  // on-load session
  try {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data?.session?.user || null;
    updateUI(sessionUser);
  } catch (err) {
    console.error("getSession error:", err);
  }

  // live auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null;
    updateUI(user);
  });

  // load data
  await fetchPosts();
});
