// app.js - Weazel News: logowanie, zakładki, baza, panel admina, wideo, rangi, ticker, usuwanie

function normalizeTag(s) {
  return String(s || "").trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractYoutubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

let supabaseInstance = null;
let currentUser = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  const supabaseLib = window.supabase;
  if (!supabaseLib) { console.error("Brak window.supabase (CDN)"); return null; }
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_KEY;
  if (!url || !key) { console.error("Brak SUPABASE_URL/KEY w config.js"); return null; }
  supabaseInstance = supabaseLib.createClient(url, key, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return supabaseInstance;
}

function getDiscordIdFromUser(user) {
  if (!user) return null;
  const identities = user.identities || [];
  const d = identities.find(i => i.provider === "discord");
  if (d && d.id) return String(d.id);
  return user.id ? String(user.id) : null;
}

function isUserInList(user, list) {
  const ids = Array.isArray(list) ? list.map(String) : [];
  const did = getDiscordIdFromUser(user);
  return !!did && ids.includes(did);
}

// --- RANGI ---
function getUserRole(user) {
  if (!user) return { label: "", cls: "role-default" };
  if (isUserInList(user, window.BOSS_DISCORD_IDS || [])) return { label: "Szef", cls: "role-boss" };
  if (isUserInList(user, window.ADMIN_DISCORD_IDS || [])) return { label: "Admin", cls: "role-admin" };
  if (isUserInList(user, window.CITY_HALL_DISCORD_IDS || [])) return { label: "City Hall", cls: "role-cityhall" };
  return { label: "Redaktor", cls: "role-default" };
}

function isBossOrAdmin(user) {
  return isUserInList(user, window.BOSS_DISCORD_IDS || []) || isUserInList(user, window.ADMIN_DISCORD_IDS || []);
}

// --- ZAKŁADKI ---
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`tab-${tabId}`) || document.getElementById(tabId);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });
}

function setupTabSwitching() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab");
      if (t) switchTab(t);
    });
  });
}

// --- UPRAWNIENIA / UI ---
const ALL_TAGS = [
  { value: "STRONA GŁÓWNA", label: "Strona Główna" },
  { value: "WIADOMOŚCI", label: "Wiadomości" },
  { value: "ARTYKUŁY", label: "Artykuły" },
  { value: "TIKTOKI", label: "Tiktoki" },
  { value: "CITY HALL", label: "City Hall (tylko rząd)", needCityHall: true }
];

function applyFormPermissions(user) {
  const sel = document.getElementById("news-tag");
  if (!sel) return;
  const isCity = isUserInList(user, window.CITY_HALL_DISCORD_IDS || []);
  const current = sel.value;
  sel.innerHTML = "";
  ALL_TAGS.forEach(t => {
    if (t.needCityHall && !isCity) return;
    const o = document.createElement("option");
    o.value = t.value;
    o.textContent = t.label;
    sel.appendChild(o);
  });
  if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
}

function applyRoleVisibility(user) {
  const isAdmin = isBossOrAdmin(user);
  const navAdmin = document.getElementById("nav-admin");
  if (navAdmin) navAdmin.style.display = isAdmin ? "flex" : "none";
  if (!isAdmin) {
    const active = document.querySelector(".tab-content.active");
    if (active && active.id === "tab-admin") switchTab("home");
  }
  applyFormPermissions(user);
}

function updateUI(user) {
  const loginBtn = document.getElementById("btn-login");
  const userInfo = document.getElementById("user-info");
  if (!loginBtn || !userInfo) return;

  if (user) {
    currentUser = user;
    loginBtn.style.display = "none";
    userInfo.style.display = "flex";
    const meta = user.user_metadata || {};
    const nickname = meta.full_name || meta.name || meta.preferred_username || user.email || "Użytkownik";
    const avatarUrl = meta.avatar_url || meta.picture || "";
    const userNameEl = document.getElementById("user-name");
    const userAvatarEl = document.getElementById("user-avatar");
    const userRoleEl = document.getElementById("user-role");
    if (userNameEl) userNameEl.textContent = nickname;
    if (userAvatarEl && avatarUrl) userAvatarEl.src = avatarUrl;
    if (userRoleEl) {
      const role = getUserRole(user);
      userRoleEl.textContent = role.label;
      userRoleEl.className = "user-role " + role.cls;
    }
  } else {
    currentUser = null;
    loginBtn.style.display = "flex";
    userInfo.style.display = "none";
    const userRoleEl = document.getElementById("user-role");
    if (userRoleEl) userRoleEl.textContent = "";
  }
  applyRoleVisibility(user);

  // Odśwież widok, żeby przyciski "Usuń" pojawiły się / zniknęły
  fetchPosts();
}

async function loginWithDiscord() {
  const supabase = getSupabase();
  if (!supabase) return alert("Supabase nie jest gotowy.");
  const redirectUrl = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: redirectUrl }
  });
  if (error) { console.error(error); alert("Błąd logowania: " + error.message); }
}

async function logout() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error(error);
  window.location.href = window.location.origin + window.location.pathname;
}

// --- BAZA ---
const NEWS_TABLE = "news";

// Styl przycisku usuwania (inline, żeby nie ruszać index.html)
const DELETE_BTN_STYLE = "margin-top:10px;align-self:flex-start;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.4);padding:5px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;text-transform:uppercase;cursor:pointer;transition:0.2s;";

function deleteButtonHtml(postId) {
  if (!isBossOrAdmin(currentUser)) return "";
  return `<button class="btn-delete" data-id="${postId}" style="${DELETE_BTN_STYLE}" onmouseover="this.style.background='#ef4444';this.style.color='#fff';" onmouseout="this.style.background='rgba(239,68,68,0.12)';this.style.color='#ef4444';">🗑️ Usuń artykuł</button>`;
}

function renderMedia(post, isHero) {
  const cls = isHero ? "hero-media" : "card-media";
  const video = post.video_url || "";
  const yt = extractYoutubeId(video);
  if (yt) {
    return `<iframe class="${cls}" src="https://www.youtube.com/embed/${yt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(video)) {
    return `<video class="${cls}" src="${escapeHtml(video)}" controls></video>`;
  }
  const img = post.image_url ? escapeHtml(post.image_url) : "https://i.imgur.com/vHdfC1B.png";
  return `<img class="${cls}" src="${img}" alt="">`;
}

function renderCard(post) {
  const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString("pl-PL") : "";
  return `
    <div class="card">
      ${renderMedia(post, false)}
      <div class="card-body">
        <span class="card-tag">${escapeHtml(post.tag || "")}</span>
        <h2 class="card-title">${escapeHtml(post.title)}</h2>
        <div class="card-meta">Autor: ${escapeHtml(post.author || "Admin")} | ${escapeHtml(dateStr)}</div>
        <p class="card-text">${escapeHtml(post.content)}</p>
        ${deleteButtonHtml(post.id)}
      </div>
    </div>`;
}

function renderHero(post) {
  const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString("pl-PL") : "";
  return `
    <div class="hero-card">
      ${renderMedia(post, true)}
      <div class="hero-body">
        <span class="hero-tag">${escapeHtml(post.tag || "WYRÓŻNIONE")}</span>
        <h2 class="hero-title">${escapeHtml(post.title)}</h2>
        <div class="hero-meta">Autor: ${escapeHtml(post.author || "Admin")} | ${escapeHtml(dateStr)}</div>
        <p class="hero-text">${escapeHtml(post.content)}</p>
        ${deleteButtonHtml(post.id)}
      </div>
    </div>`;
}

function renderTicker(posts) {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const slogan = "Witamy w Weazel News — Twoje źródło prawdy z Los Santos! Najświeższe wiadomości, reportaże i relacje prosto z ulic San Andreas. Tylko u nas niezależne dziennikarstwo bez cenzury!";
  let items = `<span>${escapeHtml(slogan)}</span>`;
  if (posts && posts.length) {
    items += posts.slice(0, 10).map(p => `<span>${escapeHtml(p.title)}</span>`).join("");
  }
  track.innerHTML = items + items;
}

async function fetchPosts() {
  const supabase = getSupabase();
  if (!supabase) return;

  const homeFeatured = document.getElementById("home-featured");
  const homeGrid = document.getElementById("home-container");
  const cW = document.getElementById("wiadomosci-container");
  const cA = document.getElementById("artykuly-container");
  const cT = document.getElementById("tiktoki-container");
  const cC = document.getElementById("cityhall-container");

  [homeFeatured, homeGrid, cW, cA, cT, cC].forEach(el => { if (el) el.innerHTML = ""; });

  const { data, error } = await supabase
    .from(NEWS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchPosts error:", error);
    if (homeGrid) homeGrid.innerHTML = `<p style="color:#ef4444;">Błąd bazy danych: ${escapeHtml(error.message)}</p>`;
    return;
  }

  renderTicker(data || []);

  if (!data || data.length === 0) {
    if (homeGrid) homeGrid.innerHTML = `<p style="color: var(--text-muted);">Brak wpisów. Zaglądaj później!</p>`;
    return;
  }

  if (homeFeatured) homeFeatured.innerHTML = renderHero(data[0]);
  if (homeGrid && data.length > 1) {
    homeGrid.innerHTML = data.slice(1).map(renderCard).join("");
  }

  const byTag = { "WIADOMOSCI": cW, "ARTYKULY": cA, "TIKTOKI": cT, "CITYHALL": cC };
  const counters = { WIADOMOSCI: 0, ARTYKULY: 0, TIKTOKI: 0, CITYHALL: 0 };

  for (const post of data) {
    const key = normalizeTag(post.tag);
    if (byTag[key]) {
      byTag[key].innerHTML += renderCard(post);
      counters[key]++;
    }
  }

  if (counters.WIADOMOSCI === 0 && cW) cW.innerHTML = `<p style="color: var(--text-muted);">Brak wiadomości.</p>`;
  if (counters.ARTYKULY === 0 && cA) cA.innerHTML = `<p style="color: var(--text-muted);">Brak artykułów.</p>`;
  if (counters.TIKTOKI === 0 && cT) cT.innerHTML = `<p style="color: var(--text-muted);">Brak wideo.</p>`;
  if (counters.CITYHALL === 0 && cC) cC.innerHTML = `<p style="color: var(--text-muted);">Brak ogłoszeń rządowych.</p>`;
}

// --- USUWANIE ARTYKUŁU ---
async function handleDelete(postId) {
  if (!postId) return;
  if (!isBossOrAdmin(currentUser)) {
    alert("Brak uprawnień do usuwania artykułów.");
    return;
  }
  if (!confirm("Czy na pewno chcesz usunąć ten artykuł? Tej operacji nie można cofnąć.")) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from(NEWS_TABLE).delete().eq("id", postId);
  if (error) {
    console.error("Błąd usuwania:", error);
    alert("Błąd usuwania: " + error.message);
    return;
  }
  await fetchPosts();
}

// Delegowanie kliknięć przycisków "Usuń" (karty są tworzone dynamicznie)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = btn.getAttribute("data-id");
  handleDelete(id);
});

// --- ADMIN: dodawanie ---
async function handleCreatePost(e) {
  e.preventDefault();
  const supabase = getSupabase();
  if (!supabase) return;
  if (!currentUser) return alert("Musisz być zalogowany.");

  if (!isBossOrAdmin(currentUser)) return alert("Brak uprawnień do Panelu Admina.");

  const title = document.getElementById("news-title")?.value.trim() || "";
  const tag = document.getElementById("news-tag")?.value || "";
  const imageUrl = document.getElementById("news-image")?.value.trim() || "";
  const videoUrl = document.getElementById("news-video")?.value.trim() || "";
  const content = document.getElementById("news-content")?.value.trim() || "";

  if (!title || !tag || !content) return alert("Uzupełnij tytuł, kategorię i treść.");

  if (normalizeTag(tag) === "CITYHALL") {
    if (!isUserInList(currentUser, window.CITY_HALL_DISCORD_IDS || [])) {
      return alert("Nie masz uprawnień do publikacji w kategorii City Hall.");
    }
  }

  const meta = currentUser.user_metadata || {};
  const authorName = meta.full_name || meta.name || "Admin";

  const { error } = await supabase.from(NEWS_TABLE).insert([{
    title, tag,
    image_url: imageUrl,
    video_url: videoUrl,
    content,
    author: authorName,
    created_at: new Date().toISOString()
  }]);

  if (error) { console.error(error); alert("Błąd publikacji: " + error.message); return; }

  document.getElementById("news-form")?.reset();
  applyFormPermissions(currentUser);
  await fetchPosts();

  const tagToTab = {
    "STRONA GŁÓWNA": "home",
    "WIADOMOŚCI": "wiadomosci",
    "ARTYKUŁY": "artykuly",
    "TIKTOKI": "tiktoki",
    "CITY HALL": "cityhall"
  };
  switchTab(tagToTab[tag] || "home");
  alert("Wpis opublikowany!");
}

// --- START ---
document.addEventListener("DOMContentLoaded", async () => {
  const recruitLink = document.getElementById("recruit-discord-link");
  if (recruitLink && window.RECRUIT_DISCORD_URL) recruitLink.href = window.RECRUIT_DISCORD_URL;

  const supabase = getSupabase();
  if (!supabase) return;

  setupTabSwitching();

  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  if (loginBtn) loginBtn.addEventListener("click", loginWithDiscord);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const newsForm = document.getElementById("news-form");
  if (newsForm) newsForm.addEventListener("submit", handleCreatePost);

  applyFormPermissions(null);

  try {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data?.session?.user || null;
    currentUser = sessionUser;
    updateUI(sessionUser);
  } catch (err) { console.error("getSession error:", err); }

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUI(session?.user || null);
  });

  await fetchPosts();
});
