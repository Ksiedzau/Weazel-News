// app.js - Weazel News
// Logowanie, zakładki, baza danych, firmy, City Hall, wideo, usuwanie i menu mobilne

let supabaseInstance = null;
let currentUser = null;

const NEWS_TABLE = "news";

// =========================
// POMOCNICZE
// =========================

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractYoutubeId(url) {
  if (!url) return null;

  const match = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );

  return match ? match[1] : null;
}

// =========================
// SUPABASE
// =========================

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  if (!window.supabase) {
    console.error("Brak biblioteki Supabase.");
    return null;
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    console.error("Brak SUPABASE_URL lub SUPABASE_KEY w config.js.");
    return null;
  }

  supabaseInstance = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_KEY,
    {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  return supabaseInstance;
}

// =========================
// ROLE
// =========================

function getDiscordIdFromUser(user) {
  if (!user) return null;

  const discordIdentity = (user.identities || []).find(
    identity => identity.provider === "discord"
  );

  if (discordIdentity?.id) {
    return String(discordIdentity.id);
  }

  return user.id ? String(user.id) : null;
}

function isUserInList(user, list) {
  if (!user || !Array.isArray(list)) return false;

  const discordId = getDiscordIdFromUser(user);
  return discordId && list.map(String).includes(discordId);
}

function isBoss(user) {
  return isUserInList(user, window.BOSS_DISCORD_IDS || []);
}

function isAdmin(user) {
  return isUserInList(user, window.ADMIN_DISCORD_IDS || []);
}

function isCityHall(user) {
  return isUserInList(user, window.CITY_HALL_DISCORD_IDS || []);
}

function isCompany(user) {
  return isUserInList(user, window.COMPANY_DISCORD_IDS || []);
}

function isBossOrAdmin(user) {
  return isBoss(user) || isAdmin(user);
}

function canAccessPanel(user) {
  return isBossOrAdmin(user) || isCityHall(user) || isCompany(user);
}

function getUserRole(user) {
  if (!user) {
    return {
      label: "",
      className: "role-default"
    };
  }

  if (isBoss(user)) {
    return {
      label: "Szef",
      className: "role-boss"
    };
  }

  if (isAdmin(user)) {
    return {
      label: "Admin",
      className: "role-admin"
    };
  }

  if (isCityHall(user)) {
    return {
      label: "City Hall",
      className: "role-cityhall"
    };
  }

  if (isCompany(user)) {
    return {
      label: "Firma",
      className: "role-company"
    };
  }

  return {
    label: "Obywatel",
    className: "role-default"
  };
}

// =========================
// ZAKŁADKI
// =========================

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(section => {
    section.classList.remove("active");
  });

  const target =
    document.getElementById(`tab-${tabId}`) ||
    document.getElementById(tabId);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn, .sidebar-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.getAttribute("data-tab") === tabId
    );
  });
}

function setupTabSwitching() {
  document.querySelectorAll(".nav-btn, .sidebar-btn").forEach(button => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");

      if (tabId) {
        switchTab(tabId);
        closeMobileMenu();
      }
    });
  });
}

// =========================
// MENU MOBILNE
// =========================

function openMobileMenu() {
  document.getElementById("mobile-sidebar")?.classList.add("active");
  document.getElementById("sidebar-overlay")?.classList.add("active");
}

function closeMobileMenu() {
  document.getElementById("mobile-sidebar")?.classList.remove("active");
  document.getElementById("sidebar-overlay")?.classList.remove("active");
}

function setupMobileMenu() {
  document
    .getElementById("mobile-menu-btn")
    ?.addEventListener("click", openMobileMenu);

  document
    .getElementById("sidebar-close")
    ?.addEventListener("click", closeMobileMenu);

  document
    .getElementById("sidebar-overlay")
    ?.addEventListener("click", closeMobileMenu);
}

// =========================
// FORMULARZ I UPRAWNIENIA
// =========================

const ALL_TAGS = [
  {
    value: "STRONA GŁÓWNA",
    label: "Strona Główna",
    needBoss: true
  },
  {
    value: "WIADOMOŚCI",
    label: "Wiadomości",
    needBoss: true
  },
  {
    value: "ARTYKUŁY",
    label: "Artykuły",
    needBoss: true
  },
  {
    value: "TIKTOKI",
    label: "Tiktoki",
    needBoss: true
  },
  {
    value: "CITY HALL",
    label: "City Hall",
    needCityHall: true
  },
  {
    value: "OGŁOSZENIA FIRMY",
    label: "Ogłoszenia firmy",
    needCompany: true
  }
];

function toggleCompanyNameField() {
  const select = document.getElementById("news-tag");
  const companyRow = document.getElementById("company-name-row");
  const companyInput = document.getElementById("news-company");

  if (!select || !companyRow) return;

  const isCompanyCategory =
    normalizeTag(select.value) === "OGLOSZENIAFIRMY";

  companyRow.style.display = isCompanyCategory ? "" : "none";

  if (companyInput) {
    companyInput.required = isCompanyCategory;
  }
}

function applyFormPermissions(user) {
  const select = document.getElementById("news-tag");

  if (!select) return;

  const bossOrAdmin = isBossOrAdmin(user);
  const cityHall = isCityHall(user);
  const company = isCompany(user);
  const previousValue = select.value;

  select.innerHTML = "";

  ALL_TAGS.forEach(category => {
    let allowed = false;

    if (bossOrAdmin) {
      allowed = true;
    } else if (category.needCityHall && cityHall) {
      allowed = true;
    } else if (category.needCompany && company) {
      allowed = true;
    }

    if (!allowed) return;

    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    select.appendChild(option);
  });

  const stillExists = [...select.options].some(
    option => option.value === previousValue
  );

  if (stillExists) {
    select.value = previousValue;
  }

  toggleCompanyNameField();
}

function applyRoleVisibility(user) {
  const panelAvailable = canAccessPanel(user);

  const desktopAdminButton = document.getElementById("nav-admin");
  const mobileAdminButton = document.getElementById("sidebar-admin");

  if (desktopAdminButton) {
    desktopAdminButton.style.display = panelAvailable ? "flex" : "none";
  }

  if (mobileAdminButton) {
    mobileAdminButton.style.display = panelAvailable ? "flex" : "none";
  }

  if (!panelAvailable) {
    const activeTab = document.querySelector(".tab-content.active");

    if (activeTab?.id === "tab-admin") {
      switchTab("home");
    }
  }

  applyFormPermissions(user);
}

function updateUI(user) {
  const loginButton = document.getElementById("btn-login");
  const userInfo = document.getElementById("user-info");

  if (!loginButton || !userInfo) {
    console.error("Brak #btn-login lub #user-info w index.html.");
    return;
  }

  if (user) {
    currentUser = user;

    loginButton.style.display = "none";
    userInfo.style.display = "flex";

    const metadata = user.user_metadata || {};

    const nickname =
      metadata.full_name ||
      metadata.name ||
      metadata.preferred_username ||
      user.email ||
      "Użytkownik";

    const avatarUrl =
      metadata.avatar_url ||
      metadata.picture ||
      "";

    const nameElement = document.getElementById("user-name");
    const avatarElement = document.getElementById("user-avatar");
    const roleElement = document.getElementById("user-role");

    if (nameElement) {
      nameElement.textContent = nickname;
    }

    if (avatarElement && avatarUrl) {
      avatarElement.src = avatarUrl;
    }

    if (roleElement) {
      const role = getUserRole(user);

      roleElement.textContent = role.label;
      roleElement.className = `user-role ${role.className}`;
    }
  } else {
    currentUser = null;

    loginButton.style.display = "flex";
    userInfo.style.display = "none";

    const roleElement = document.getElementById("user-role");

    if (roleElement) {
      roleElement.textContent = "";
    }
  }

  applyRoleVisibility(user);
}

// =========================
// LOGOWANIE
// =========================

async function loginWithDiscord() {
  const supabase = getSupabase();

  if (!supabase) {
    alert("Supabase nie jest gotowy.");
    return;
  }

  const redirectUrl =
    window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: redirectUrl
    }
  });

  if (error) {
    console.error("Błąd logowania:", error);
    alert("Błąd logowania: " + error.message);
  }
}

async function logout() {
  const supabase = getSupabase();

  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Błąd wylogowania:", error);
  }

  window.location.href =
    window.location.origin + window.location.pathname;
}

// =========================
// RENDEROWANIE MEDIÓW
// =========================

function renderMedia(post, isHero = false) {
  const className = isHero ? "hero-media" : "card-media";
  const videoUrl = post.video_url || "";
  const youtubeId = extractYoutubeId(videoUrl);

  if (youtubeId) {
    return `
      <iframe
        class="${className}"
        src="https://www.youtube.com/embed/${youtubeId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    `;
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) {
    return `
      <video
        class="${className}"
        src="${escapeHtml(videoUrl)}"
        controls>
      </video>
    `;
  }

  const imageUrl =
    post.image_url ||
    "https://i.imgur.com/vHdfC1B.png";

  return `
    <img
      class="${className}"
      src="${escapeHtml(imageUrl)}"
      alt="Materiał artykułu">
  `;
}

function getPostClickUrl(post) {
  if (post.video_url && String(post.video_url).trim()) {
    return String(post.video_url).trim();
  }

  if (post.image_url && String(post.image_url).trim()) {
    return String(post.image_url).trim();
  }

  return "";
}

function getTagClass(post) {
  const tag = normalizeTag(post.tag);

  if (tag === "OGLOSZENIAFIRMY") {
    return "tag-company";
  }

  if (tag === "CITYHALL") {
    return "tag-cityhall";
  }

  return "";
}

function deleteButtonHtml(postId) {
  if (!isBossOrAdmin(currentUser)) {
    return "";
  }

  return `
    <button
      class="btn-delete"
      data-id="${escapeHtml(postId)}"
      type="button"
      style="
        margin-top:10px;
        align-self:flex-start;
        background:rgba(239,68,68,0.12);
        color:#ef4444;
        border:1px solid rgba(239,68,68,0.4);
        padding:5px 10px;
        border-radius:6px;
        font-size:0.75rem;
        font-weight:800;
        text-transform:uppercase;
        cursor:pointer;
      ">
      🗑️ Usuń artykuł
    </button>
  `;
}

function renderCard(post) {
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString("pl-PL")
    : "";

  const url = getPostClickUrl(post);
  const clickableClass = url ? " clickable" : "";
  const dataUrl = url
    ? `data-url="${escapeHtml(url)}"`
    : "";

  const companyName = post.company_name
    ? `
      <div class="card-company">
        🏢 ${escapeHtml(post.company_name)}
      </div>
    `
    : "";

  return `
    <div class="card${clickableClass}" ${dataUrl}>
      ${renderMedia(post)}

      <div class="card-body">
        <span class="card-tag ${getTagClass(post)}">
          ${escapeHtml(post.tag || "")}
        </span>

        <h2 class="card-title">
          ${escapeHtml(post.title || "")}
        </h2>

        ${companyName}

        <div class="card-meta">
          Autor: ${escapeHtml(post.author || "Admin")} |
          ${escapeHtml(date)}
        </div>

        <p class="card-text">
          ${escapeHtml(post.content || "")}
        </p>

        ${deleteButtonHtml(post.id)}
      </div>
    </div>
  `;
}

function renderHero(post) {
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString("pl-PL")
    : "";

  const url = getPostClickUrl(post);
  const clickableClass = url ? " clickable" : "";
  const dataUrl = url
    ? `data-url="${escapeHtml(url)}"`
    : "";

  const companyName = post.company_name
    ? `
      <div class="card-company">
        🏢 ${escapeHtml(post.company_name)}
      </div>
    `
    : "";

  return `
    <div class="hero-card${clickableClass}" ${dataUrl}>
      ${renderMedia(post, true)}

      <div class="hero-body">
        <span class="hero-tag">
          ${escapeHtml(post.tag || "WYRÓŻNIONE")}
        </span>

        <h2 class="hero-title">
          ${escapeHtml(post.title || "")}
        </h2>

        ${companyName}

        <div class="hero-meta">
          Autor: ${escapeHtml(post.author || "Admin")} |
          ${escapeHtml(date)}
        </div>

        <p class="hero-text">
          ${escapeHtml(post.content || "")}
        </p>

        ${deleteButtonHtml(post.id)}
      </div>
    </div>
  `;
}

// =========================
// TICKER
// =========================

function renderTicker(posts) {
  const ticker = document.getElementById("ticker-track");

  if (!ticker) return;

  const slogan =
    "Witamy w Weazel News — Twoje źródło prawdy z Los Santos! Najświeższe wiadomości, reportaże i relacje prosto z ulic San Andreas! ";

  const titles = (posts || [])
    .slice(0, 10)
    .map(post => `<span>${escapeHtml(post.title || "")}</span>`)
    .join("");

  ticker.innerHTML =
    `<span>${escapeHtml(slogan)}</span>${titles}`.repeat(2);
}

// =========================
// POBIERANIE ARTYKUŁÓW
// =========================

async function fetchPosts() {
  const supabase = getSupabase();

  if (!supabase) return;

  const homeFeatured = document.getElementById("home-featured");
  const homeContainer = document.getElementById("home-container");
  const newsContainer = document.getElementById("wiadomosci-container");
  const articlesContainer = document.getElementById("artykuly-container");
  const tiktoksContainer = document.getElementById("tiktoki-container");
  const cityHallContainer = document.getElementById("cityhall-container");
  const companyContainer = document.getElementById("ogloszenia-container");

  [
    homeFeatured,
    homeContainer,
    newsContainer,
    articlesContainer,
    tiktoksContainer,
    cityHallContainer,
    companyContainer
  ].forEach(element => {
    if (element) element.innerHTML = "";
  });

  const { data: posts, error } = await supabase
    .from(NEWS_TABLE)
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error("Błąd pobierania danych:", error);

    if (homeContainer) {
      homeContainer.innerHTML = `
        <p style="color:#ef4444;">
          Błąd bazy danych: ${escapeHtml(error.message)}
        </p>
      `;
    }

    return;
  }

  renderTicker(posts || []);

  if (!posts || posts.length === 0) {
    if (homeContainer) {
      homeContainer.innerHTML = `
        <p style="color:var(--text-muted);">
          Brak wpisów. Zaglądaj później!
        </p>
      `;
    }

    if (companyContainer) {
      companyContainer.innerHTML = `
        <p style="color:var(--text-muted);">
          Brak ogłoszeń firm.
        </p>
      `;
    }

    return;
  }

  // Strona główna
  if (homeFeatured) {
    homeFeatured.innerHTML = renderHero(posts[0]);
  }

  if (homeContainer && posts.length > 1) {
    homeContainer.innerHTML = posts
      .slice(1)
      .map(renderCard)
      .join("");
  }

  const containers = {
    WIADOMOSCI: newsContainer,
    ARTYKULY: articlesContainer,
    TIKTOKI: tiktoksContainer,
    CITYHALL: cityHallContainer,
    OGLOSZENIAFIRMY: companyContainer
  };

  const counters = {
    WIADOMOSCI: 0,
    ARTYKULY: 0,
    TIKTOKI: 0,
    CITYHALL: 0,
    OGLOSZENIAFIRMY: 0
  };

  posts.forEach(post => {
    const tag = normalizeTag(post.tag);
    const container = containers[tag];

    if (!container) return;

    container.innerHTML += renderCard(post);
    counters[tag]++;
  });

  if (newsContainer && counters.WIADOMOSCI === 0) {
    newsContainer.innerHTML =
      `<p style="color:var(--text-muted);">Brak wiadomości.</p>`;
  }

  if (articlesContainer && counters.ARTYKULY === 0) {
    articlesContainer.innerHTML =
      `<p style="color:var(--text-muted);">Brak artykułów.</p>`;
  }

  if (tiktoksContainer && counters.TIKTOKI === 0) {
    tiktoksContainer.innerHTML =
      `<p style="color:var(--text-muted);">Brak wideo.</p>`;
  }

  if (cityHallContainer && counters.CITYHALL === 0) {
    cityHallContainer.innerHTML =
      `<p style="color:var(--text-muted);">Brak ogłoszeń City Hall.</p>`;
  }

  if (companyContainer && counters.OGLOSZENIAFIRMY === 0) {
    companyContainer.innerHTML =
      `<p style="color:var(--text-muted);">Brak ogłoszeń firm.</p>`;
  }
}

// =========================
// USUWANIE
// =========================

async function handleDelete(postId) {
  if (!postId) return;

  if (!isBossOrAdmin(currentUser)) {
    alert("Nie masz uprawnień do usuwania artykułów.");
    return;
  }

  const confirmed = confirm(
    "Czy na pewno chcesz usunąć ten artykuł?"
  );

  if (!confirmed) return;

  const supabase = getSupabase();

  if (!supabase) return;

  const { error } = await supabase
    .from(NEWS_TABLE)
    .delete()
    .eq("id", postId);

  if (error) {
    console.error("Błąd usuwania:", error);
    alert("Błąd usuwania: " + error.message);
    return;
  }

  await fetchPosts();
}

// =========================
// DODAWANIE ARTYKUŁU
// =========================

async function handleCreatePost(event) {
  event.preventDefault();

  const supabase = getSupabase();

  if (!supabase) return;

  if (!currentUser) {
    alert("Musisz być zalogowany.");
    return;
  }

  if (!canAccessPanel(currentUser)) {
    alert("Brak uprawnień do Panelu Admina.");
    return;
  }

  const title =
    document.getElementById("news-title")?.value.trim() || "";

  const tag =
    document.getElementById("news-tag")?.value || "";

  const companyName =
    document.getElementById("news-company")?.value.trim() || "";

  const imageUrl =
    document.getElementById("news-image")?.value.trim() || "";

  const videoUrl =
    document.getElementById("news-video")?.value.trim() || "";

  const content =
    document.getElementById("news-content")?.value.trim() || "";

  if (!title || !tag || !content) {
    alert("Uzupełnij tytuł, kategorię i treść.");
    return;
  }

  const normalizedTag = normalizeTag(tag);

  // City Hall może dodawać tylko ogłoszenia City Hall
  if (
    isCityHall(currentUser) &&
    !isBossOrAdmin(currentUser) &&
    normalizedTag !== "CITYHALL"
  ) {
    alert("City Hall może dodawać tylko ogłoszenia City Hall.");
    return;
  }

  // Firma może dodawać tylko ogłoszenia firmy
  if (
    isCompany(currentUser) &&
    !isBossOrAdmin(currentUser) &&
    normalizedTag !== "OGLOSZENIAFIRMY"
  ) {
    alert("Firma może dodawać tylko ogłoszenia firm.");
    return;
  }

  if (normalizedTag === "CITYHALL") {
    if (!isCityHall(currentUser) && !isBossOrAdmin(currentUser)) {
      alert("Nie masz uprawnień do publikacji w City Hall.");
      return;
    }
  }

  if (normalizedTag === "OGLOSZENIAFIRMY") {
    if (!isCompany(currentUser) && !isBossOrAdmin(currentUser)) {
      alert("Nie masz uprawnień do publikacji ogłoszeń firm.");
      return;
    }

    if (!companyName) {
      alert("Podaj nazwę firmy.");
      return;
    }
  }

  const metadata = currentUser.user_metadata || {};

  const author =
    metadata.full_name ||
    metadata.name ||
    metadata.preferred_username ||
    "Admin";

  const { error } = await supabase
    .from(NEWS_TABLE)
    .insert([
      {
        title,
        tag,
        company_name: companyName || null,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        content,
        author,
        created_at: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error("Błąd dodawania wpisu:", error);
    alert("Błąd publikacji: " + error.message);
    return;
  }

  document.getElementById("news-form")?.reset();

  applyFormPermissions(currentUser);
  await fetchPosts();

  const destination = {
    "STRONA GŁÓWNA": "home",
    "WIADOMOŚCI": "wiadomosci",
    "ARTYKUŁY": "artykuly",
    "TIKTOKI": "tiktoki",
    "CITY HALL": "cityhall",
    "OGŁOSZENIA FIRMY": "ogloszenia"
  };

  switchTab(destination[tag] || "home");

  alert("Wpis został opublikowany.");
}

// =========================
// KLIKNIĘCIA W KARTY I PRZYCISKI
// =========================

document.addEventListener("click", event => {
  const deleteButton = event.target.closest(".btn-delete");

  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();

    handleDelete(deleteButton.dataset.id);
    return;
  }

  const clickableCard = event.target.closest(
    ".card.clickable, .hero-card.clickable"
  );

  if (clickableCard) {
    const url = clickableCard.dataset.url;

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
});

// =========================
// START APLIKACJI
// =========================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = getSupabase();

  if (!supabase) return;

  setupTabSwitching();
  setupMobileMenu();

  document
    .getElementById("btn-login")
    ?.addEventListener("click", loginWithDiscord);

  document
    .getElementById("btn-logout")
    ?.addEventListener("click", logout);

  document
    .getElementById("news-form")
    ?.addEventListener("submit", handleCreatePost);

  document
    .getElementById("news-tag")
    ?.addEventListener("change", toggleCompanyNameField);

  const recruitLink =
    document.getElementById("recruit-discord-link");

  if (recruitLink && window.RECRUIT_DISCORD_URL) {
    recruitLink.href = window.RECRUIT_DISCORD_URL;
  }

  try {
    const { data } = await supabase.auth.getSession();
    updateUI(data?.session?.user || null);
  } catch (error) {
    console.error("Błąd pobierania sesji:", error);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUI(session?.user || null);
  });

  await fetchPosts();
});
