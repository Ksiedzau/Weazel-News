// =====================================================
// WEAZEL NEWS - APP.JS
// Logowanie, role, baza, City Hall, firmy,
// cooldown firm 48h, multimedia, usuwanie i zakładki
// =====================================================

const NEWS_TABLE = "news";

let supabaseClient = null;
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

function isCompanyTag(value) {
    const tag = normalizeTag(value);

    return (
        tag === "OGLOSZENIAFIRMY" ||
        tag === "OGLOSZENIAFIRM" ||
        tag === "OGLOSZENIAFIRMOWE"
    );
}

function isCityHallTag(value) {
    const tag = normalizeTag(value);

    return (
        tag === "CITYHALL" ||
        tag === "RZADOWE" ||
        tag === "OGLOSZENIACITYHALL"
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// =====================================================
// SUPABASE
// =====================================================

function getSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    if (!window.supabase) {
        console.error("Biblioteka Supabase nie została załadowana.");
        return null;
    }

    if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
        console.error("Brak SUPABASE_URL lub SUPABASE_KEY w config.js.");
        return null;
    }

    supabaseClient = window.supabase.createClient(
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

    return supabaseClient;
}

// =====================================================
// DISCORD I ROLE
// =====================================================

function getDiscordId(user) {
    if (!user) {
        return null;
    }

    const identity = (user.identities || []).find(
        item => item.provider === "discord"
    );

    if (identity?.identity_data?.id) {
        return String(identity.identity_data.id);
    }

    if (identity?.identity_data?.sub) {
        return String(identity.identity_data.sub);
    }

    if (identity?.id) {
        return String(identity.id);
    }

    return user.id ? String(user.id) : null;
}

function isUserInList(user, list) {
    if (!user || !Array.isArray(list)) {
        return false;
    }

    const discordId = getDiscordId(user);

    return Boolean(
        discordId &&
        list.map(String).includes(String(discordId))
    );
}

function isBoss(user) {
    return isUserInList(
        user,
        window.BOSS_DISCORD_IDS || []
    );
}

function isAdmin(user) {
    return isUserInList(
        user,
        window.ADMIN_DISCORD_IDS || []
    );
}

function isCityHall(user) {
    return isUserInList(
        user,
        window.CITY_HALL_DISCORD_IDS || []
    );
}

function isCompany(user) {
    return isUserInList(
        user,
        window.COMPANY_DISCORD_IDS || []
    );
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
// ZAKŁADKI
// =====================================================

function switchTab(tabId) {
    document
        .querySelectorAll(".tab-content")
        .forEach(section => {
            section.classList.remove("active");
        });

    const target =
        document.getElementById(`tab-${tabId}`) ||
        document.getElementById(tabId);

    if (target) {
        target.classList.add("active");
    }

    document
        .querySelectorAll(".nav-btn, .sidebar-btn")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.tab === tabId
            );
        });

    closeMobileMenu();
}

window.switchTab = switchTab;

function setupTabs() {
    document
        .querySelectorAll(".nav-btn, .sidebar-btn")
        .forEach(button => {
            button.addEventListener("click", () => {
                const tabId = button.dataset.tab;

                if (tabId) {
                    switchTab(tabId);
                }
            });
        });
}

// =====================================================
// ZAKŁADKA OGŁOSZENIA FIRM
// =====================================================

function ensureCompanyTab() {
    const desktopNav =
        document.querySelector(".nav-links");

    const mobileNav =
        document.querySelector(".sidebar-links");

    if (
        desktopNav &&
        !desktopNav.querySelector(
            '[data-tab="ogloszenia"]'
        )
    ) {
        const button =
            document.createElement("button");

        button.className =
            "nav-btn company-nav";

        button.dataset.tab =
            "ogloszenia";

        button.textContent =
            "🏢 Ogłoszenia firm";

        desktopNav.appendChild(button);
    }

    if (
        mobileNav &&
        !mobileNav.querySelector(
            '[data-tab="ogloszenia"]'
        )
    ) {
        const button =
            document.createElement("button");

        button.className =
            "sidebar-btn company-sidebar";

        button.dataset.tab =
            "ogloszenia";

        button.textContent =
            "🏢 Ogłoszenia firm";

        mobileNav.appendChild(button);
    }

    if (!document.getElementById("tab-ogloszenia")) {
        const section =
            document.createElement("section");

        section.id =
            "tab-ogloszenia";

        section.className =
            "tab-content";

        section.innerHTML = `
            <div class="page-header">
                <h1 style="color:#10b981;">
                    Ogłoszenia firm
                </h1>

                <p>
                    Reklamy i ogłoszenia lokalnych przedsiębiorstw Los Santos
                </p>
            </div>

            <div
                id="ogloszenia-container"
                class="cards-grid">
            </div>
        `;

        document
            .querySelector("main")
            ?.appendChild(section);
    }

    if (!document.getElementById("company-extra-styles")) {
        const style =
            document.createElement("style");

        style.id =
            "company-extra-styles";

        style.textContent = `
            .company-nav,
            .company-sidebar {
                color: #10b981 !important;
            }

            .company-nav:hover,
            .company-nav.active,
            .company-sidebar.active {
                background: #10b981 !important;
                color: #000 !important;
            }

            .tag-company {
                background: #10b981 !important;
                color: #000 !important;
            }

            .card-company {
                margin-bottom: 7px;
                color: #10b981;
                font-size: .8rem;
                font-weight: 900;
                text-transform: uppercase;
            }
        `;

        document.head.appendChild(style);
    }
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
        ?.addEventListener(
            "click",
            openMobileMenu
        );

    document
        .getElementById("sidebar-close")
        ?.addEventListener(
            "click",
            closeMobileMenu
        );

    document
        .getElementById("sidebar-overlay")
        ?.addEventListener(
            "click",
            closeMobileMenu
        );
}

// =====================================================
// FORMULARZ
// =====================================================

function updateCompanyField() {
    const select =
        document.getElementById("news-tag");

    const row =
        document.getElementById(
            "company-name-row"
        );

    const input =
        document.getElementById(
            "news-company"
        );

    if (!select || !row) {
        return;
    }

    const isCompanyCategory =
        isCompanyTag(select.value);

    row.style.display =
        isCompanyCategory
            ? "block"
            : "none";

    if (input) {
        input.required =
            isCompanyCategory;
    }
}

function updateCategoryOptions(user) {
    const select =
        document.getElementById("news-tag");

    if (!select) {
        return;
    }

    const oldValue =
        select.value;

    const bossOrAdmin =
        isBossOrAdmin(user);

    const cityHall =
        isCityHall(user);

    const company =
        isCompany(user);

    const categories = [];

    if (bossOrAdmin) {
        categories.push(
            [
                "STRONA GŁÓWNA",
                "Strona Główna"
            ],
            [
                "WIADOMOŚCI",
                "Wiadomości"
            ],
            [
                "ARTYKUŁY",
                "Artykuły"
            ],
            [
                "TIKTOKI",
                "Tiktoki"
            ]
        );
    }

    if (bossOrAdmin || cityHall) {
        categories.push(
            [
                "CITY HALL",
                "City Hall"
            ]
        );
    }

    if (bossOrAdmin || company) {
        categories.push(
            [
                "OGŁOSZENIA FIRMY",
                "Ogłoszenia firmy"
            ]
        );
    }

    select.innerHTML = "";

    categories.forEach(
        ([value, label]) => {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                label;

            select.appendChild(option);
        }
    );

    if (
        oldValue &&
        [...select.options].some(
            option =>
                option.value === oldValue
        )
    ) {
        select.value =
            oldValue;
    }

    updateCompanyField();
}

// =====================================================
// UI LOGOWANIA
// =====================================================

function updateUI(user) {
    currentUser =
        user || null;

    const loginButton =
        document.getElementById(
            "btn-login"
        );

    const userInfo =
        document.getElementById(
            "user-info"
        );

    const roleElement =
        document.getElementById(
            "user-role"
        );

    const desktopAdmin =
        document.getElementById(
            "nav-admin"
        );

    const mobileAdmin =
        document.getElementById(
            "sidebar-admin"
        );

    if (user) {
        if (loginButton) {
            loginButton.style.display =
                "none";
        }

        if (userInfo) {
            userInfo.style.display =
                "flex";
        }

        const metadata =
            user.user_metadata || {};

        const name =
            metadata.full_name ||
            metadata.name ||
            metadata.preferred_username ||
            user.email ||
            "Użytkownik";

        const avatar =
            metadata.avatar_url ||
            metadata.picture ||
            "";

        const nameElement =
            document.getElementById(
                "user-name"
            );

        const avatarElement =
            document.getElementById(
                "user-avatar"
            );

        if (nameElement) {
            nameElement.textContent =
                name;
        }

        if (avatarElement && avatar) {
            avatarElement.src =
                avatar;
        }

        const role =
            getRole(user);

        if (roleElement) {
            roleElement.textContent =
                role.name;

            roleElement.className =
                `user-role ${role.className}`;
        }
    } else {
        if (loginButton) {
            loginButton.style.display =
                "flex";
        }

        if (userInfo) {
            userInfo.style.display =
                "none";
        }

        if (roleElement) {
            roleElement.textContent =
                "";
        }
    }

    const panelVisible =
        canUsePanel(user);

    if (desktopAdmin) {
        desktopAdmin.style.display =
            panelVisible
                ? "flex"
                : "none";
    }

    if (mobileAdmin) {
        mobileAdmin.style.display =
            panelVisible
                ? "flex"
                : "none";
    }

    updateCategoryOptions(user);
}

// =====================================================
// LOGOWANIE
// =====================================================

async function loginWithDiscord() {
    const supabase =
        getSupabase();

    if (!supabase) {
        alert(
            "Supabase nie jest gotowy."
        );
        return;
    }

    const redirectTo =
        window.location.origin +
        window.location.pathname;

    const { error } =
        await supabase.auth.signInWithOAuth({
            provider: "discord",
            options: {
                redirectTo
            }
        });

    if (error) {
        console.error(error);

        alert(
            "Błąd logowania: " +
            error.message
        );
    }
}

async function logout() {
    const supabase =
        getSupabase();

    if (!supabase) {
        return;
    }

    await supabase.auth.signOut();

    window.location.href =
        window.location.origin +
        window.location.pathname;
}

// =====================================================
// MEDIA
// =====================================================

function getYoutubeId(url) {
    const match =
        String(url || "").match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
        );

    return match
        ? match[1]
        : null;
}

function renderMedia(post, isHero = false) {
    const className =
        isHero
            ? "hero-media"
            : "card-media";

    const video =
        post.video_url || "";

    const youtubeId =
        getYoutubeId(video);

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

    if (
        /\.(mp4|webm|ogg)(\?|$)/i.test(video)
    ) {
        return `
            <video
                class="${className}"
                src="${escapeHtml(video)}"
                controls>
            </video>
        `;
    }

    return `
        <img
            class="${className}"
            src="${escapeHtml(
                post.image_url ||
                "https://i.imgur.com/vHdfC1B.png"
            )}"
            alt="Materiał">
    `;
}

function getPostUrl(post) {
    if (
        post.video_url &&
        String(post.video_url).trim()
    ) {
        return String(
            post.video_url
        ).trim();
    }

    if (
        post.image_url &&
        String(post.image_url).trim()
    ) {
        return String(
            post.image_url
        ).trim();
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
            class="delete-button"
            data-id="${escapeHtml(postId)}"
            style="
                margin-top:10px;
                align-self:flex-start;
                padding:6px 10px;
                border:1px solid #ef4444;
                border-radius:6px;
                background:rgba(239,68,68,.12);
                color:#ef4444;
                cursor:pointer;
                font-weight:800;
            ">
            🗑️ Usuń
        </button>
    `;
}

function renderCard(post) {
    const url =
        getPostUrl(post);

    const date =
        post.created_at
            ? new Date(
                post.created_at
            ).toLocaleDateString("pl-PL")
            : "";

    const tagClass =
        isCompanyTag(post.tag)
            ? "tag-company"
            : isCityHallTag(post.tag)
                ? "tag-cityhall"
                : "";

    const companyName =
        post.company_name
            ? `
                <div class="card-company">
                    🏢 ${escapeHtml(
                        post.company_name
                    )}
                </div>
            `
            : "";

    return `
        <div
            class="card ${url ? "clickable" : ""}"
            ${
                url
                    ? `data-url="${escapeHtml(url)}"`
                    : ""
            }>

            ${renderMedia(post)}

            <div class="card-body">
                <span
                    class="card-tag ${tagClass}">
                    ${escapeHtml(
                        post.tag || ""
                    )}
                </span>

                <h2 class="card-title">
                    ${escapeHtml(
                        post.title || ""
                    )}
                </h2>

                ${companyName}

                <div class="card-meta">
                    Autor:
                    ${escapeHtml(
                        post.author || "Admin"
                    )}
                    |
                    ${escapeHtml(date)}
                </div>

                <p class="card-text">
                    ${escapeHtml(
                        post.content || ""
                    )}
                </p>

                ${deleteButton(post.id)}
            </div>
        </div>
    `;
}

function renderHero(post) {
    const url =
        getPostUrl(post);

    const date =
        post.created_at
            ? new Date(
                post.created_at
            ).toLocaleDateString("pl-PL")
            : "";

    return `
        <div
            class="hero-card ${url ? "clickable" : ""}"
            ${
                url
                    ? `data-url="${escapeHtml(url)}"`
                    : ""
            }>

            ${renderMedia(post, true)}

            <div class="hero-body">
                <span class="hero-tag">
                    ${escapeHtml(
                        post.tag || ""
                    )}
                </span>

                <h2 class="hero-title">
                    ${escapeHtml(
                        post.title || ""
                    )}
                </h2>

                <div class="hero-meta">
                    Autor:
                    ${escapeHtml(
                        post.author || "Admin"
                    )}
                    |
                    ${escapeHtml(date)}
                </div>

                <p class="hero-text">
                    ${escapeHtml(
                        post.content || ""
                    )}
                </p>

                ${deleteButton(post.id)}
            </div>
        </div>
    `;
}

// =====================================================
// POBIERANIE WPISÓW
// =====================================================

function setEmpty(element, message) {
    if (!element) {
        return;
    }

    element.innerHTML = `
        <p style="color:var(--text-muted);">
            ${message}
        </p>
    `;
}

async function fetchPosts() {
    const supabase =
        getSupabase();

    if (!supabase) {
        return;
    }

    const homeFeatured =
        document.getElementById(
            "home-featured"
        );

    const homeContainer =
        document.getElementById(
            "home-container"
        );

    const newsContainer =
        document.getElementById(
            "wiadomosci-container"
        );

    const articlesContainer =
        document.getElementById(
            "artykuly-container"
        );

    const tiktoksContainer =
        document.getElementById(
            "tiktoki-container"
        );

    const cityHallContainer =
        document.getElementById(
            "cityhall-container"
        );

    const companyContainer =
        document.getElementById(
            "ogloszenia-container"
        );

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

    const {
        data: posts,
        error
    } = await supabase
        .from(NEWS_TABLE)
        .select("*")
        .order(
            "created_at",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "Błąd pobierania danych:",
            error
        );

        setEmpty(
            homeContainer,
            "Błąd pobierania danych z bazy."
        );

        return;
    }

    const allPosts =
        posts || [];

    /*
     * NAJWAŻNIEJSZE:
     *
     * Firma jest wykluczana z homePosts.
     * City Hall pozostaje na stronie głównej.
     */

    const homePosts =
        allPosts.filter(
            post =>
                !isCompanyTag(
                    post.tag
                )
        );

    const companyPosts =
        allPosts.filter(
            post =>
                isCompanyTag(
                    post.tag
                )
        );

    if (homePosts.length > 0) {
        if (homeFeatured) {
            homeFeatured.innerHTML =
                renderHero(
                    homePosts[0]
                );
        }

        if (homeContainer) {
            homeContainer.innerHTML =
                homePosts
                    .slice(1)
                    .map(renderCard)
                    .join("");
        }
    } else {
        setEmpty(
            homeContainer,
            "Brak wpisów."
        );
    }

    /*
     * Ogłoszenia firm są renderowane tylko tutaj.
     */

    if (
        companyContainer &&
        companyPosts.length > 0
    ) {
        companyContainer.innerHTML =
            companyPosts
                .map(renderCard)
                .join("");
    } else {
        setEmpty(
            companyContainer,
            "Brak ogłoszeń firm."
        );
    }

    const newsPosts =
        allPosts.filter(
            post =>
                normalizeTag(post.tag) ===
                "WIADOMOSCI"
        );

    const articlePosts =
        allPosts.filter(
            post =>
                normalizeTag(post.tag) ===
                "ARTYKULY"
        );

    const tiktokPosts =
        allPosts.filter(
            post =>
                normalizeTag(post.tag) ===
                "TIKTOKI"
        );

    const cityHallPosts =
        allPosts.filter(
            post =>
                isCityHallTag(
                    post.tag
                )
        );

    if (
        newsContainer &&
        newsPosts.length > 0
    ) {
        newsContainer.innerHTML =
            newsPosts
                .map(renderCard)
                .join("");
    } else {
        setEmpty(
            newsContainer,
            "Brak wiadomości."
        );
    }

    if (
        articlesContainer &&
        articlePosts.length > 0
    ) {
        articlesContainer.innerHTML =
            articlePosts
                .map(renderCard)
                .join("");
    } else {
        setEmpty(
            articlesContainer,
            "Brak artykułów."
        );
    }

    if (
        tiktoksContainer &&
        tiktokPosts.length > 0
    ) {
        tiktoksContainer.innerHTML =
            tiktokPosts
                .map(renderCard)
                .join("");
    } else {
        setEmpty(
            tiktoksContainer,
            "Brak filmów."
        );
    }

    if (
        cityHallContainer &&
        cityHallPosts.length > 0
    ) {
        cityHallContainer.innerHTML =
            cityHallPosts
                .map(renderCard)
                .join("");
    } else {
        setEmpty(
            cityHallContainer,
            "Brak ogłoszeń City Hall."
        );
    }

    const ticker =
        document.getElementById(
            "ticker-text"
        );

    if (ticker) {
        const titles =
            homePosts
                .slice(0, 8)
                .map(
                    post =>
                        `<span>${escapeHtml(
                            post.title
                        )}</span>`
                )
                .join("");

        ticker.innerHTML =
            `<span>
                Weazel News — najświeższe informacje z Los Santos.
            </span>` +
            titles;
    }
}

// =====================================================
// DODAWANIE WPISU
// =====================================================

async function createPost(event) {
    event.preventDefault();

    const supabase =
        getSupabase();

    if (!currentUser) {
        alert(
            "Musisz być zalogowany."
        );
        return;
    }

    if (!canUsePanel(currentUser)) {
        alert(
            "Brak uprawnień do panelu."
        );
        return;
    }

    const title =
        document.getElementById(
            "news-title"
        )?.value.trim() || "";

    let tag =
        document.getElementById(
            "news-tag"
        )?.value || "";

    const companyName =
        document.getElementById(
            "news-company"
        )?.value.trim() || "";

    const imageUrl =
        document.getElementById(
            "news-image"
        )?.value.trim() || "";

    const videoUrl =
        document.getElementById(
            "news-video"
        )?.value.trim() || "";

    const content =
        document.getElementById(
            "news-content"
        )?.value.trim() || "";

    if (!title || !tag || !content) {
        alert(
            "Uzupełnij tytuł, kategorię i treść."
        );
        return;
    }

    // City Hall: bez cooldownu, tylko własna kategoria
    if (
        isCityHall(currentUser) &&
        !isBossOrAdmin(currentUser)
    ) {
        if (!isCityHallTag(tag)) {
            alert(
                "City Hall może dodawać tylko ogłoszenia City Hall."
            );
            return;
        }

        tag = "CITY HALL";
    }

    // Firma: tylko własna kategoria
    if (
        isCompany(currentUser) &&
        !isBossOrAdmin(currentUser)
    ) {
        if (!isCompanyTag(tag)) {
            alert(
                "Firma może dodawać tylko ogłoszenia firm."
            );
            return;
        }

        if (!companyName) {
            alert(
                "Podaj nazwę firmy."
            );
            return;
        }

        tag = "OGŁOSZENIA FIRMY";
    }

    // Szef/Admin mogą wybrać City Hall lub Firmę
    if (isCityHallTag(tag)) {
        tag = "CITY HALL";
    }

    if (isCompanyTag(tag)) {
        if (!companyName) {
            alert(
                "Podaj nazwę firmy."
            );
            return;
        }

        tag = "OGŁOSZENIA FIRMY";
    }

    const metadata =
        currentUser.user_metadata || {};

    const author =
        metadata.full_name ||
        metadata.name ||
        metadata.preferred_username ||
        "Admin";

    const authorDiscordId =
        getDiscordId(currentUser);

    const { error } =
        await supabase
            .from(NEWS_TABLE)
            .insert({
                title,
                tag,
                company_name:
                    tag === "OGŁOSZENIA FIRMY"
                        ? companyName
                        : null,
                image_url:
                    imageUrl || null,
                video_url:
                    videoUrl || null,
                content,
                author,
                author_discord_id:
                    authorDiscordId,
                created_at:
                    new Date().toISOString()
            });

    if (error) {
        console.error(
            "Błąd publikacji:",
            error
        );

        if (
            tag === "OGŁOSZENIA FIRMY" &&
            error.message
                .toLowerCase()
                .includes("security")
        ) {
            alert(
                "Firma może dodać tylko jedno ogłoszenie na 48 godzin."
            );
        } else {
            alert(
                "Błąd publikacji: " +
                error.message
            );
        }

        return;
    }

    document
        .getElementById(
            "news-form"
        )
        ?.reset();

    updateCategoryOptions(
        currentUser
    );

    await fetchPosts();

    if (tag === "OGŁOSZENIA FIRMY") {
        switchTab(
            "ogloszenia"
        );
    } else if (tag === "CITY HALL") {
        switchTab(
            "cityhall"
        );
    } else {
        switchTab(
            "home"
        );
    }

    alert(
        "Wpis został opublikowany."
    );
}

// =====================================================
// USUWANIE
// =====================================================

async function deletePost(postId) {
    if (!isBossOrAdmin(currentUser)) {
        alert(
            "Tylko Szef/Admin może usuwać wpisy."
        );
        return;
    }

    if (
        !confirm(
            "Czy na pewno usunąć ten wpis?"
        )
    ) {
        return;
    }

    const supabase =
        getSupabase();

    if (!supabase) {
        return;
    }

    const { error } =
        await supabase
            .from(NEWS_TABLE)
            .delete()
            .eq("id", postId);

    if (error) {
        alert(
            "Błąd usuwania: " +
            error.message
        );
        return;
    }

    await fetchPosts();
}

// =====================================================
// KLIKNIĘCIA
// =====================================================

document.addEventListener(
    "click",
    event => {
        const deleteButtonElement =
            event.target.closest(
                ".delete-button"
            );

        if (deleteButtonElement) {
            event.preventDefault();
            event.stopPropagation();

            deletePost(
                deleteButtonElement.dataset.id
            );

            return;
        }

        const card =
            event.target.closest(
                ".card.clickable, .hero-card.clickable"
            );

        if (
            card &&
            card.dataset.url
        ) {
            window.open(
                card.dataset.url,
                "_blank",
                "noopener,noreferrer"
            );
        }
    }
);

// =====================================================
// START
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const supabase =
            getSupabase();

        if (!supabase) {
            return;
        }

        ensureCompanyTab();
        setupTabs();
        setupMobileMenu();

        document
            .getElementById(
                "btn-login"
            )
            ?.addEventListener(
                "click",
                loginWithDiscord
            );

        document
            .getElementById(
                "btn-logout"
            )
            ?.addEventListener(
                "click",
                logout
            );

        document
            .getElementById(
                "news-form"
            )
            ?.addEventListener(
                "submit",
                createPost
            );

        document
            .getElementById(
                "news-tag"
            )
            ?.addEventListener(
                "change",
                updateCompanyField
            );

        const recruitmentLink =
            document.getElementById(
                "recruit-discord-link"
            );

        if (
            recruitmentLink &&
            window.RECRUIT_DISCORD_URL
        ) {
            recruitmentLink.href =
                window.RECRUIT_DISCORD_URL;
        }

        const {
            data
        } = await supabase.auth.getSession();

        updateUI(
            data?.session?.user || null
        );

        supabase.auth.onAuthStateChange(
            (_event, session) => {
                updateUI(
                    session?.user || null
                );

                fetchPosts();
            }
        );

        await fetchPosts();
    }
);
