// =====================================================
// WEAZEL NEWS
// Logowanie, role, baza danych, firmy, City Hall,
// dodawanie, usuwanie, filmy, klikalne artykuły
// =====================================================

const NEWS_TABLE = "news";

let supabaseInstance = null;
let currentUser = null;


// =====================================================
// POMOCNICZE
// =====================================================

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

function getSupabase() {
    if (supabaseInstance) {
        return supabaseInstance;
    }

    if (!window.supabase) {
        console.error("Biblioteka Supabase nie została załadowana.");
        return null;
    }

    if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
        console.error("Brak SUPABASE_URL lub SUPABASE_KEY.");
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


// =====================================================
// DISCORD ID I ROLE
// =====================================================

function getDiscordId(user) {
    if (!user) return null;

    const discordIdentity = (user.identities || []).find(
        identity => identity.provider === "discord"
    );

    if (discordIdentity?.identity_data?.id) {
        return String(discordIdentity.identity_data.id);
    }

    if (discordIdentity?.identity_data?.sub) {
        return String(discordIdentity.identity_data.sub);
    }

    if (discordIdentity?.id) {
        return String(discordIdentity.id);
    }

    return user.id ? String(user.id) : null;
}

function isInList(user, list) {
    if (!user || !Array.isArray(list)) {
        return false;
    }

    const discordId = getDiscordId(user);

    return discordId &&
        list.map(String).includes(String(discordId));
}

function isBoss(user) {
    return isInList(user, window.BOSS_DISCORD_IDS || []);
}

function isAdmin(user) {
    return isInList(user, window.ADMIN_DISCORD_IDS || []);
}

function isCityHall(user) {
    return isInList(user, window.CITY_HALL_DISCORD_IDS || []);
}

function isCompany(user) {
    return isInList(user, window.COMPANY_DISCORD_IDS || []);
}

function isBossOrAdmin(user) {
    return isBoss(user) || isAdmin(user);
}

function canUsePanel(user) {
    return (
        isBossOrAdmin(user) ||
        isCityHall(user) ||
        isCompany(user)
    );
}

function getRole(user) {
    if (!user) {
        return {
            name: "",
            className: "role-default"
        };
    }

    if (isBoss(user)) {
        return {
            name: "Szef",
            className: "role-boss"
        };
    }

    if (isAdmin(user)) {
        return {
            name: "Admin",
            className: "role-admin"
        };
    }

    if (isCityHall(user)) {
        return {
            name: "City Hall",
            className: "role-cityhall"
        };
    }

    if (isCompany(user)) {
        return {
            name: "Firma",
            className: "role-company"
        };
    }

    return {
        name: "Obywatel",
        className: "role-default"
    };
}


// =====================================================
// DYNAMICZNA ZAKŁADKA „OGŁOSZENIA FIRM”
// Nie musisz zmieniać index.html.
// =====================================================

function addCompanyTabToPage() {
    const desktopNav = document.querySelector(".nav-links");
    const mobileNav = document.querySelector(".sidebar-links");

    if (desktopNav && !document.querySelector('[data-tab="ogloszenia"]')) {
        const button = document.createElement("button");

        button.className = "nav-btn company-nav";
        button.dataset.tab = "ogloszenia";
        button.textContent = "🏢 Ogłoszenia firm";

        desktopNav.appendChild(button);
        button.addEventListener("click", () => {
            switchTab("ogloszenia");
        });
    }

    if (mobileNav && !document.querySelector(".company-sidebar")) {
        const button = document.createElement("button");

        button.className = "sidebar-btn company-sidebar";
        button.dataset.tab = "ogloszenia";
        button.textContent = "🏢 Ogłoszenia firm";

        mobileNav.appendChild(button);
        button.addEventListener("click", () => {
            switchTab("ogloszenia");
            closeMobileMenu();
        });
    }

    if (!document.getElementById("tab-ogloszenia")) {
        const section = document.createElement("section");

        section.id = "tab-ogloszenia";
        section.className = "tab-content";

        section.innerHTML = `
            <div class="page-header">
                <h1 style="color:#10b981;">Ogłoszenia firm</h1>
                <p>Reklamy i ogłoszenia lokalnych przedsiębiorstw Los Santos</p>
            </div>

            <div class="cards-grid" id="ogloszenia-container">
                <p style="color:var(--text-muted);">
                    Brak ogłoszeń firm.
                </p>
            </div>
        `;

        const main = document.querySelector("main");

        if (main) {
            main.appendChild(section);
        }
    }

    addCompanyStyles();
}

function addCompanyStyles() {
    if (document.getElementById("company-styles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "company-styles";

    style.textContent = `
        .company-nav,
        .company-sidebar {
            color: #10b981 !important;
        }

        .company-nav:hover,
        .company-nav.active {
            background: #10b981 !important;
            color: #000 !important;
        }

        .company-sidebar.active {
            background: #10b981 !important;
            color: #000 !important;
        }

        .tag-company {
            background: #10b981 !important;
            color: #000 !important;
        }

        .card-company {
            color: #10b981;
            font-weight: 800;
            font-size: .8rem;
            margin-bottom: 7px;
            text-transform: uppercase;
        }
    `;

    document.head.appendChild(style);
}


// =====================================================
// ZAKŁADKI
// =====================================================

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
            button.dataset.tab === tabId
        );
    });
}

function setupTabs() {
    document.querySelectorAll(".nav-btn, .sidebar-btn").forEach(button => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            if (tab) {
                switchTab(tab);
                closeMobileMenu();
            }
        });
    });
}


// =====================================================
// MENU MOBILNE
// =====================================================

function openMobileMenu() {
    document
        .getElementById("mobile-sidebar")
        ?.classList.add("active");

    document
        .getElementById("sidebar-overlay")
        ?.classList.add("active");
}

function closeMobileMenu() {
    document
        .getElementById("mobile-sidebar")
        ?.classList.remove("active");

    document
        .getElementById("sidebar-overlay")
        ?.classList.remove("active");
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


// =====================================================
// DODAWANIE POLA „NAZWA FIRMY” DO FORMULARZA
// =====================================================

function addCompanyFieldToForm() {
    const form = document.getElementById("news-form");

    if (!form || document.getElementById("company-name-row")) {
        return;
    }

    const row = document.createElement("div");

    row.id = "company-name-row";
    row.className = "form-row";
    row.style.display = "none";

    row.innerHTML = `
        <label for="news-company">Nazwa firmy</label>
        <input
            type="text"
            id="news-company"
            class="form-field"
            placeholder="np. Los Santos Customs">

        <div class="form-hint">
            To pole jest wymagane przy ogłoszeniach firm.
        </div>
    `;

    const imageField = document.getElementById("news-image");

    if (imageField?.parentElement) {
        imageField.parentElement.before(row);
    } else {
        form.prepend(row);
    }
}

function updateCompanyField() {
    const select = document.getElementById("news-tag");
    const row = document.getElementById("company-name-row");
    const input = document.getElementById("news-company");

    if (!select || !row) {
        return;
    }

    const companyCategory =
        normalizeTag(select.value) === "OGLOSZENIAFIRMY";

    row.style.display = companyCategory ? "block" : "none";

    if (input) {
        input.required = companyCategory;
    }
}


// =====================================================
// OPCJE KATEGORII W PANELU
// =====================================================

function updateCategoryOptions(user) {
    const select = document.getElementById("news-tag");

    if (!select) {
        return;
    }

    const previousValue = select.value;
    const bossOrAdmin = isBossOrAdmin(user);
    const cityHall = isCityHall(user);
    const company = isCompany(user);

    const categories = [];

    if (bossOrAdmin) {
        categories.push(
            ["STRONA GŁÓWNA", "Strona Główna"],
            ["WIADOMOŚCI", "Wiadomości"],
            ["ARTYKUŁY", "Artykuły"],
            ["TIKTOKI", "Tiktoki"]
        );
    }

    if (bossOrAdmin || cityHall) {
        categories.push(
            ["CITY HALL", "City Hall"]
        );
    }

    if (bossOrAdmin || company) {
        categories.push(
            ["OGŁOSZENIA FIRMY", "Ogłoszenia firmy"]
        );
    }

    select.innerHTML = "";

    categories.forEach(([value, label]) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = label;

        select.appendChild(option);
    });

    if (
        previousValue &&
        [...select.options].some(option => option.value === previousValue)
    ) {
        select.value = previousValue;
    }

    updateCompanyField();
}


// =====================================================
// UI LOGOWANIA
// =====================================================

function updateRoleVisibility(user) {
    const panelButton = document.getElementById("nav-admin");
    const mobilePanelButton = document.getElementById("sidebar-admin");

    const panelVisible = canUsePanel(user);

    if (panelButton) {
        panelButton.style.display = panelVisible
            ? "flex"
            : "none";
    }

    if (mobilePanelButton) {
        mobilePanelButton.style.display = panelVisible
            ? "flex"
            : "none";
    }

    const role = getRole(user);
    const roleElement = document.getElementById("user-role");

    if (roleElement) {
        roleElement.textContent = role.name;
        roleElement.className =
            `user-role ${role.className}`;
    }

    updateCategoryOptions(user);

    if (!panelVisible) {
        const active = document.querySelector(".tab-content.active");

        if (active?.id === "tab-admin") {
            switchTab("home");
        }
    }
}

function updateUserUI(user) {
    const loginButton = document.getElementById("btn-login");
    const userInfo = document.getElementById("user-info");

    if (!loginButton || !userInfo) {
        console.error(
            "Brakuje #btn-login albo #user-info w index.html."
        );
        return;
    }

    if (!user) {
        currentUser = null;

        loginButton.style.display = "flex";
        userInfo.style.display = "none";

        updateRoleVisibility(null);
        return;
    }

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

    const avatar =
        metadata.avatar_url ||
        metadata.picture ||
        "";

    const nameElement = document.getElementById("user-name");
    const avatarElement = document.getElementById("user-avatar");

    if (nameElement) {
        nameElement.textContent = nickname;
    }

    if (avatarElement && avatar) {
        avatarElement.src = avatar;
    }

    updateRoleVisibility(user);
}


// =====================================================
// LOGOWANIE / WYLOGOWANIE
// =====================================================

async function loginWithDiscord() {
    const supabase = getSupabase();

    if (!supabase) {
        alert("Supabase nie jest gotowy.");
        return;
    }

    const redirectUrl =
        window.location.origin + window.location.pathname;

    const { error } =
        await supabase.auth.signInWithOAuth({
            provider: "discord",
            options: {
                redirectTo: redirectUrl
            }
        });

    if (error) {
        console.error(error);
        alert("Błąd logowania: " + error.message);
    }
}

async function logout() {
    const supabase = getSupabase();

    if (!supabase) {
        return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error(error);
    }

    window.location.href =
        window.location.origin + window.location.pathname;
}


// =====================================================
// MEDIA
// =====================================================

function getYoutubeId(url) {
    if (!url) return null;

    const match = String(url).match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );

    return match ? match[1] : null;
}

function renderMedia(post, hero = false) {
    const className = hero
        ? "hero-media"
        : "card-media";

    const videoUrl = post.video_url || "";
    const youtubeId = getYoutubeId(videoUrl);

    if (youtubeId) {
        return `
            <iframe
                class="${className}"
                src="https://www.youtube.com/embed/${youtubeId}"
                frameborder="0"
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

function getPostUrl(post) {
    if (post.video_url?.trim()) {
        return post.video_url.trim();
    }

    if (post.image_url?.trim()) {
        return post.image_url.trim();
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


// =====================================================
// KARTY
// =====================================================

function deleteButton(postId) {
    if (!isBossOrAdmin(currentUser)) {
        return "";
    }

    return `
        <button
            type="button"
            class="btn-delete"
            data-id="${escapeHtml(postId)}"
            style="
                margin-top:10px;
                padding:6px 10px;
                border-radius:6px;
                border:1px solid #ef4444;
                color:#ef4444;
                background:rgba(239,68,68,.12);
                cursor:pointer;
                font-weight:800;
            ">
            🗑️ Usuń
        </button>
    `;
}

function renderCard(post) {
    const url = getPostUrl(post);
    const clickable = url ? " clickable" : "";
    const dataUrl = url
        ? `data-url="${escapeHtml(url)}"`
        : "";

    const date = post.created_at
        ? new Date(post.created_at).toLocaleDateString("pl-PL")
        : "";

    const companyName = post.company_name
        ? `
            <div class="card-company">
                🏢 ${escapeHtml(post.company_name)}
            </div>
        `
        : "";

    return `
        <div class="card${clickable}" ${dataUrl}>
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
                    Autor: ${escapeHtml(post.author || "Admin")}
                    |
                    ${escapeHtml(date)}
                </div>

                <p class="card-text">
                    ${escapeHtml(post.content || "")}
                </p>

                ${deleteButton(post.id)}
            </div>
        </div>
    `;
}

function renderHero(post) {
    const url = getPostUrl(post);
    const clickable = url ? " clickable" : "";
    const dataUrl = url
        ? `data-url="${escapeHtml(url)}"`
        : "";

    const date = post.created_at
        ? new Date(post.created_at).toLocaleDateString("pl-PL")
        : "";

    const companyName = post.company_name
        ? `
            <div class="card-company">
                🏢 ${escapeHtml(post.company_name)}
            </div>
        `
        : "";

    return `
        <div class="hero-card${clickable}" ${dataUrl}>
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
                    Autor: ${escapeHtml(post.author || "Admin")}
                    |
                    ${escapeHtml(date)}
                </div>

                <p class="hero-text">
                    ${escapeHtml(post.content || "")}
                </p>

                ${deleteButton(post.id)}
            </div>
        </div>
    `;
}


// =====================================================
// POBIERANIE DANYCH Z BAZY
// =====================================================

async function fetchPosts() {
    const supabase = getSupabase();

    if (!supabase) {
        return;
    }

    const homeFeatured =
        document.getElementById("home-featured");

    const homeContainer =
        document.getElementById("home-container");

    const newsContainer =
        document.getElementById("wiadomosci-container");

    const articlesContainer =
        document.getElementById("artykuly-container");

    const tiktoksContainer =
        document.getElementById("tiktoki-container");

    const cityHallContainer =
        document.getElementById("cityhall-container");

    const companyContainer =
        document.getElementById("ogloszenia-container");

    [
        homeFeatured,
        homeContainer,
        newsContainer,
        articlesContainer,
        tiktoksContainer,
        cityHallContainer,
        companyContainer
    ].forEach(element => {
        if (element) {
            element.innerHTML = "";
        }
    });

    const { data: posts, error } = await supabase
        .from(NEWS_TABLE)
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Błąd pobierania newsów:", error);

        if (homeContainer) {
            homeContainer.innerHTML = `
                <p style="color:#ef4444;">
                    Błąd bazy danych:
                    ${escapeHtml(error.message)}
                </p>
            `;
        }

        return;
    }

    if (!posts || posts.length === 0) {
        if (homeContainer) {
            homeContainer.innerHTML =
                `<p style="color:var(--text-muted);">Brak wpisów.</p>`;
        }

        if (companyContainer) {
            companyContainer.innerHTML =
                `<p style="color:var(--text-muted);">Brak ogłoszeń firm.</p>`;
        }

        return;
    }

    if (homeFeatured) {
        homeFeatured.innerHTML = renderHero(posts[0]);
    }

    if (homeContainer && posts.length > 1) {
        homeContainer.innerHTML =
            posts.slice(1).map(renderCard).join("");
    }

    const containers = {
        WIADOMOSCI: newsContainer,
        ARTYKULY: articlesContainer,
        TIKTOKI: tiktoksContainer,
        CITYHALL: cityHallContainer,
        OGLOSZENIAFIRMY: companyContainer
    };

    const counts = {
        WIADOMOSCI: 0,
        ARTYKULY: 0,
        TIKTOKI: 0,
        CITYHALL: 0,
        OGLOSZENIAFIRMY: 0
    };

    posts.forEach(post => {
        const tag = normalizeTag(post.tag);
        const container = containers[tag];

        if (!container) {
            return;
        }

        container.innerHTML += renderCard(post);
        counts[tag]++;
    });

    if (newsContainer && counts.WIADOMOSCI === 0) {
        newsContainer.innerHTML =
            `<p style="color:var(--text-muted);">Brak wiadomości.</p>`;
    }

    if (articlesContainer && counts.ARTYKULY === 0) {
        articlesContainer.innerHTML =
            `<p style="color:var(--text-muted);">Brak artykułów.</p>`;
    }

    if (tiktoksContainer && counts.TIKTOKI === 0) {
        tiktoksContainer.innerHTML =
            `<p style="color:var(--text-muted);">Brak filmów.</p>`;
    }

    if (cityHallContainer && counts.CITYHALL === 0) {
        cityHallContainer.innerHTML =
            `<p style="color:var(--text-muted);">Brak ogłoszeń City Hall.</p>`;
    }

    if (companyContainer && counts.OGLOSZENIAFIRMY === 0) {
        companyContainer.innerHTML =
            `<p style="color:var(--text-muted);">Brak ogłoszeń firm.</p>`;
    }
}


// =====================================================
// DODAWANIE WPISU
// =====================================================

async function handleCreatePost(event) {
    event.preventDefault();

    const supabase = getSupabase();

    if (!supabase || !currentUser) {
        alert("Musisz być zalogowany.");
        return;
    }

    if (!canUsePanel(currentUser)) {
        alert("Brak uprawnień do panelu.");
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

    const normalizedTag = normalizeTag(tag);

    if (!title || !tag || !content) {
        alert("Uzupełnij tytuł, kategorię i treść.");
        return;
    }

    if (
        isCityHall(currentUser) &&
        !isBossOrAdmin(currentUser) &&
        normalizedTag !== "CITYHALL"
    ) {
        alert("City Hall może dodawać tylko ogłoszenia City Hall.");
        return;
    }

    if (
        isCompany(currentUser) &&
        !isBossOrAdmin(currentUser) &&
        normalizedTag !== "OGLOSZENIAFIRMY"
    ) {
        alert("Firma może dodawać tylko ogłoszenia firm.");
        return;
    }

    if (normalizedTag === "OGLOSZENIAFIRMY" && !companyName) {
        alert("Musisz wpisać nazwę firmy.");
        return;
    }

    if (
        normalizedTag === "OGLOSZENIAFIRMY" &&
        !isCompany(currentUser) &&
        !isBossOrAdmin(currentUser)
    ) {
        alert("Nie masz uprawnień do ogłoszeń firm.");
        return;
    }

    if (
        normalizedTag === "CITYHALL" &&
        !isCityHall(currentUser) &&
        !isBossOrAdmin(currentUser)
    ) {
        alert("Nie masz uprawnień do City Hall.");
        return;
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
        console.error("Błąd dodawania:", error);
        alert("Błąd publikacji: " + error.message);
        return;
    }

    document.getElementById("news-form")?.reset();

    updateCategoryOptions(currentUser);
    await fetchPosts();

    alert("Wpis został opublikowany.");

    if (normalizedTag === "OGLOSZENIAFIRMY") {
        switchTab("ogloszenia");
    } else if (normalizedTag === "CITYHALL") {
        switchTab("cityhall");
    } else {
        switchTab("home");
    }
}


// =====================================================
// USUWANIE WPISU
// =====================================================

async function handleDelete(postId) {
    if (!isBossOrAdmin(currentUser)) {
        alert("Nie masz uprawnień do usuwania.");
        return;
    }

    if (!confirm("Czy na pewno usunąć ten artykuł?")) {
        return;
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from(NEWS_TABLE)
        .delete()
        .eq("id", postId);

    if (error) {
        console.error(error);
        alert("Błąd usuwania: " + error.message);
        return;
    }

    await fetchPosts();
}


// =====================================================
// KLIKNIĘCIA
// =====================================================

document.addEventListener("click", event => {
    const deleteButtonElement =
        event.target.closest(".btn-delete");

    if (deleteButtonElement) {
        event.preventDefault();
        event.stopPropagation();

        handleDelete(deleteButtonElement.dataset.id);
        return;
    }

    const card =
        event.target.closest(".card.clickable, .hero-card.clickable");

    if (card && card.dataset.url) {
        window.open(
            card.dataset.url,
            "_blank",
            "noopener,noreferrer"
        );
    }
});


// =====================================================
// START
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = getSupabase();

    if (!supabase) {
        return;
    }

    addCompanyTabToPage();
    addCompanyFieldToForm();

    setupTabs();
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
        ?.addEventListener("change", updateCompanyField);

    const recruitmentLink =
        document.getElementById("recruit-discord-link");

    if (
        recruitmentLink &&
        window.RECRUIT_DISCORD_URL
    ) {
        recruitmentLink.href =
            window.RECRUIT_DISCORD_URL;
    }

    try {
        const { data } =
            await supabase.auth.getSession();

        updateUserUI(
            data?.session?.user || null
        );
    } catch (error) {
        console.error("Błąd sesji:", error);
    }

    supabase.auth.onAuthStateChange(
        (_event, session) => {
            updateUserUI(session?.user || null);
        }
    );

    await fetchPosts();
});
