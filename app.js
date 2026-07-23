// =====================================================
// WEAZEL NEWS
// Ogłoszenia firm jako zwykła kategoria.
// Bez specjalnej roli Firma.
// Ogłoszenia firm nie trafiają na stronę główną.
// =====================================================

(() => {
    if (window.__WEAZEL_APP_STARTED__) {
        return;
    }

    window.__WEAZEL_APP_STARTED__ = true;

    const NEWS_TABLE = "news";

    let supabaseClient = null;
    let currentUser = null;

    // =================================================
    // POMOCNICZE
    // =================================================

    function normalizeTag(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "");
    }

    function isCompanyTag(value) {
        return [
            "OGLOSZENIAFIRM",
            "OGLOSZENIAFIRMY",
            "OGLOSZENIAFIRMOWE"
        ].includes(normalizeTag(value));
    }

    function isCityHallTag(value) {
        return [
            "CITYHALL",
            "RZADOWE",
            "OGLOSZENIACITYHALL"
        ].includes(normalizeTag(value));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.normalizeTag = normalizeTag;
    window.isCompanyTag = isCompanyTag;

    // =================================================
    // SUPABASE
    // =================================================

    function getSupabase() {
        if (supabaseClient) {
            return supabaseClient;
        }

        if (!window.supabase) {
            console.error("Biblioteka Supabase nie została załadowana.");
            return null;
        }

        if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
            console.error("Brak SUPABASE_URL lub SUPABASE_KEY.");
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

    // =================================================
    // ROLE — TYLKO SZEF, ADMIN, CITY HALL
    // =================================================

    function getDiscordId(user) {
        if (!user) {
            return "";
        }

        const identity = (user.identities || []).find(
            item => item.provider === "discord"
        );

        const data = identity?.identity_data || {};

        return String(
            data.id ||
            data.sub ||
            identity?.id ||
            user.id ||
            ""
        );
    }

    function hasRole(user, ids) {
        const discordId = getDiscordId(user);

        return Boolean(
            discordId &&
            Array.isArray(ids) &&
            ids.map(String).includes(discordId)
        );
    }

    function isBoss(user) {
        return hasRole(
            user,
            window.BOSS_DISCORD_IDS || []
        );
    }

    function isAdmin(user) {
        return hasRole(
            user,
            window.ADMIN_DISCORD_IDS || []
        );
    }

    function isCityHall(user) {
        return hasRole(
            user,
            window.CITY_HALL_DISCORD_IDS || []
        );
    }

    function isBossOrAdmin(user) {
        return isBoss(user) || isAdmin(user);
    }

    function canUsePanel(user) {
        return (
            isBossOrAdmin(user) ||
            isCityHall(user)
        );
    }

    function getRole(user) {
        if (isBoss(user)) {
            return ["Szef", "role-boss"];
        }

        if (isAdmin(user)) {
            return ["Admin", "role-admin"];
        }

        if (isCityHall(user)) {
            return ["City Hall", "role-cityhall"];
        }

        return ["Obywatel", "role-default"];
    }

    // =================================================
    // ZAKŁADKI
    // =================================================

    function switchTab(tabId) {
        document
            .querySelectorAll(".tab-content")
            .forEach(section => {
                section.classList.remove("active");
            });

        const target =
            document.getElementById(`tab-${tabId}`);

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

    function addCompanyCategoryTab() {
        const desktopNav =
            document.querySelector(".nav-links");

        const mobileNav =
            document.querySelector(".sidebar-links");

        if (
            desktopNav &&
            !desktopNav.querySelector(
                '[data-tab="ogloszenia-firm"]'
            )
        ) {
            const button =
                document.createElement("button");

            button.className =
                "nav-btn company-category-nav";

            button.dataset.tab =
                "ogloszenia-firm";

            button.textContent =
                "🏢 Ogłoszenia firm";

            desktopNav.appendChild(button);
        }

        if (
            mobileNav &&
            !mobileNav.querySelector(
                '[data-tab="ogloszenia-firm"]'
            )
        ) {
            const button =
                document.createElement("button");

            button.className =
                "sidebar-btn company-category-sidebar";

            button.dataset.tab =
                "ogloszenia-firm";

            button.textContent =
                "🏢 Ogłoszenia firm";

            mobileNav.appendChild(button);
        }

        if (
            !document.getElementById(
                "tab-ogloszenia-firm"
            )
        ) {
            const section =
                document.createElement("section");

            section.id =
                "tab-ogloszenia-firm";

            section.className =
                "tab-content";

            section.innerHTML = `
                <div class="page-header">
                    <h1 style="color:#10b981;">
                        Ogłoszenia firm
                    </h1>

                    <p>
                        Ogłoszenia lokalnych przedsiębiorstw Los Santos
                    </p>
                </div>

                <div
                    id="ogloszenia-firm-container"
                    class="cards-grid">
                </div>
            `;

            document
                .querySelector("main")
                ?.appendChild(section);
        }

        if (
            !document.getElementById(
                "company-category-style"
            )
        ) {
            const style =
                document.createElement("style");

            style.id =
                "company-category-style";

            style.textContent = `
                .company-category-nav,
                .company-category-sidebar {
                    color: #10b981 !important;
                }

                .company-category-nav:hover,
                .company-category-nav.active,
                .company-category-sidebar.active {
                    background: #10b981 !important;
                    color: #000 !important;
                }

                .company-category-tag {
                    background: #10b981 !important;
                    color: #000 !important;
                }
            `;

            document.head.appendChild(style);
        }
    }

    function setupTabs() {
        document
            .querySelectorAll(".nav-btn, .sidebar-btn")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        if (button.dataset.tab) {
                            switchTab(
                                button.dataset.tab
                            );
                        }
                    }
                );
            });
    }

    // =================================================
    // MENU MOBILNE
    // =================================================

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

    // =================================================
    // KATEGORIE W PANELU
    // =================================================

    function updateCategoryOptions(user) {
        const select =
            document.getElementById(
                "news-tag"
            );

        if (!select) {
            return;
        }

        const oldValue =
            select.value;

        const options = [];

        // Szef/Admin mogą publikować wszystkie kategorie
        if (isBossOrAdmin(user)) {
            options.push(
                ["STRONA GŁÓWNA", "Strona Główna"],
                ["WIADOMOŚCI", "Wiadomości"],
                ["ARTYKUŁY", "Artykuły"],
                ["TIKTOKI", "Tiktoki"],
                ["CITY HALL", "City Hall"],
                [
                    "OGŁOSZENIA FIRM",
                    "Ogłoszenia firm"
                ]
            );
        }

        // City Hall może publikować w City Hall
        else if (isCityHall(user)) {
            options.push(
                ["CITY HALL", "City Hall"],
                [
                    "OGŁOSZENIA FIRM",
                    "Ogłoszenia firm"
                ]
            );
        }

        select.innerHTML = "";

        options.forEach(
            ([value, label]) => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    value;

                option.textContent =
                    label;

                select.appendChild(
                    option
                );
            }
        );

        if (
            [...select.options].some(
                option =>
                    option.value ===
                    oldValue
            )
        ) {
            select.value =
                oldValue;
        }
    }

    // =================================================
    // UI
    // =================================================

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

        const adminButton =
            document.getElementById(
                "nav-admin"
            );

        const mobileAdminButton =
            document.getElementById(
                "sidebar-admin"
            );

        const panelVisible =
            canUsePanel(user);

        if (loginButton) {
            loginButton.style.display =
                user ? "none" : "flex";
        }

        if (userInfo) {
            userInfo.style.display =
                user ? "flex" : "none";
        }

        if (adminButton) {
            adminButton.style.display =
                panelVisible
                    ? "flex"
                    : "none";
        }

        if (mobileAdminButton) {
            mobileAdminButton.style.display =
                panelVisible
                    ? "flex"
                    : "none";
        }

        updateCategoryOptions(user);

        if (!user) {
            if (roleElement) {
                roleElement.textContent =
                    "";
            }

            return;
        }

        const metadata =
            user.user_metadata || {};

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
                nickname;
        }

        if (avatarElement && avatar) {
            avatarElement.src =
                avatar;
        }

        const [roleName, roleClass] =
            getRole(user);

        if (roleElement) {
            roleElement.textContent =
                roleName;

            roleElement.className =
                `user-role ${roleClass}`;
        }
    }

    // =================================================
    // LOGOWANIE
    // =================================================

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
            await supabase.auth.signInWithOAuth(
                {
                    provider: "discord",
                    options: {
                        redirectTo
                    }
                }
            );

        if (error) {
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

    // =================================================
    // MEDIA
    // =================================================

    function getYoutubeId(url) {
        const match =
            String(url || "").match(
                /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
            );

        return match
            ? match[1]
            : null;
    }

    function renderMedia(post, hero = false) {
        const className =
            hero
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
                    src="https://www.youtube-nocookie.com/embed/${youtubeId}"
                    frameborder="0"
                    allowfullscreen>
                </iframe>
            `;
        }

        if (
            /\.(mp4|webm|ogg)(\?|$)/i
                .test(video)
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
        if (post.video_url?.trim()) {
            return post.video_url.trim();
        }

        if (post.image_url?.trim()) {
            return post.image_url.trim();
        }

        return "";
    }

    function renderDeleteButton(postId) {
        if (!isBossOrAdmin(currentUser)) {
            return "";
        }

        return `
            <button
                type="button"
                class="delete-button"
                data-id="${escapeHtml(postId)}">
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
                ).toLocaleDateString(
                    "pl-PL"
                )
                : "";

        const tagClass =
            isCompanyTag(post.tag)
                ? "company-category-tag"
                : isCityHallTag(post.tag)
                    ? "tag-cityhall"
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

                    <div class="card-meta">
                        Autor:
                        ${escapeHtml(
                            post.author ||
                            "Admin"
                        )}
                        |
                        ${escapeHtml(date)}
                    </div>

                    <p class="card-text">
                        ${escapeHtml(
                            post.content || ""
                        )}
                    </p>

                    ${renderDeleteButton(post.id)}
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
                ).toLocaleDateString(
                    "pl-PL"
                )
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
                            post.author ||
                            "Admin"
                        )}
                        |
                        ${escapeHtml(date)}
                    </div>

                    <p class="hero-text">
                        ${escapeHtml(
                            post.content || ""
                        )}
                    </p>

                    ${renderDeleteButton(post.id)}
                </div>
            </div>
        `;
    }

    // =================================================
    // POBIERANIE WPISÓW
    // =================================================

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
                "ogloszenia-firm-container"
            );

        const {
            data,
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

            return;
        }

        const allPosts =
            data || [];

        /*
         * STRONA GŁÓWNA:
         * City Hall zostaje.
         * Ogłoszenia firm są wykluczane.
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

        if (homeFeatured) {
            homeFeatured.innerHTML =
                homePosts.length
                    ? renderHero(
                        homePosts[0]
                    )
                    : "";
        }

        if (homeContainer) {
            homeContainer.innerHTML =
                homePosts.length > 1
                    ? homePosts
                        .slice(1)
                        .map(renderCard)
                        .join("")
                    : "<p>Brak wpisów.</p>";
        }

        /*
         * OGŁOSZENIA FIRM:
         * renderowane tylko tutaj.
         */

        if (companyContainer) {
            companyContainer.innerHTML =
                companyPosts.length
                    ? companyPosts
                        .map(renderCard)
                        .join("")
                    : "<p>Brak ogłoszeń firm.</p>";
        }

        const newsPosts =
            allPosts.filter(
                post =>
                    normalizeTag(
                        post.tag
                    ) === "WIADOMOSCI"
            );

        const articlePosts =
            allPosts.filter(
                post =>
                    normalizeTag(
                        post.tag
                    ) === "ARTYKULY"
            );

        const tiktokPosts =
            allPosts.filter(
                post =>
                    normalizeTag(
                        post.tag
                    ) === "TIKTOKI"
            );

        const cityHallPosts =
            allPosts.filter(
                post =>
                    isCityHallTag(
                        post.tag
                    )
            );

        if (newsContainer) {
            newsContainer.innerHTML =
                newsPosts.length
                    ? newsPosts
                        .map(renderCard)
                        .join("")
                    : "<p>Brak wiadomości.</p>";
        }

        if (articlesContainer) {
            articlesContainer.innerHTML =
                articlePosts.length
                    ? articlePosts
                        .map(renderCard)
                        .join("")
                    : "<p>Brak artykułów.</p>";
        }

        if (tiktoksContainer) {
            tiktoksContainer.innerHTML =
                tiktokPosts.length
                    ? tiktokPosts
                        .map(renderCard)
                        .join("")
                    : "<p>Brak filmów.</p>";
        }

        if (cityHallContainer) {
            cityHallContainer.innerHTML =
                cityHallPosts.length
                    ? cityHallPosts
                        .map(renderCard)
                        .join("")
                    : "<p>Brak ogłoszeń City Hall.</p>";
        }

        const ticker =
            document.getElementById(
                "ticker-text"
            );

        if (ticker) {
            ticker.innerHTML =
                homePosts
                    .slice(0, 8)
                    .map(
                        post =>
                            `<span>${escapeHtml(
                                post.title
                            )}</span>`
                    )
                    .join("");
        }
    }

    // =================================================
    // DODAWANIE WPISU
    // =================================================

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

        if (!isBossOrAdmin(currentUser)) {
            alert(
                "Tylko Szef/Admin może publikować wpisy."
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

        if (isCityHallTag(tag)) {
            tag = "CITY HALL";
        }

        if (isCompanyTag(tag)) {
            tag = "OGŁOSZENIA FIRM";
        }

        const metadata =
            currentUser.user_metadata || {};

        const author =
            metadata.full_name ||
            metadata.name ||
            metadata.preferred_username ||
            "Admin";

        const { error } =
            await supabase
                .from(NEWS_TABLE)
                .insert({
                    title,
                    tag,
                    image_url:
                        imageUrl || null,
                    video_url:
                        videoUrl || null,
                    content,
                    author,
                    created_at:
                        new Date().toISOString()
                });

        if (error) {
            console.error(
                "Błąd publikacji:",
                error
            );

            alert(
                "Błąd publikacji: " +
                error.message
            );

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

        switchTab(
            tag === "OGŁOSZENIA FIRM"
                ? "ogloszenia-firm"
                : tag === "CITY HALL"
                    ? "cityhall"
                    : "home"
        );

        alert(
            "Wpis został opublikowany."
        );
    }

    // =================================================
    // USUWANIE
    // =================================================

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

    // =================================================
    // KLIKNIĘCIA
    // =================================================

    function setupClicks() {
        document.addEventListener(
            "click",
            event => {
                const deleteButton =
                    event.target.closest(
                        ".delete-button"
                    );

                if (deleteButton) {
                    event.preventDefault();
                    event.stopPropagation();

                    deletePost(
                        deleteButton.dataset.id
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
    }

    // =================================================
    // START
    // =================================================

    document.addEventListener(
        "DOMContentLoaded",
        async () => {
            const supabase =
                getSupabase();

            if (!supabase) {
                return;
            }

            addCompanyCategoryTab();
            setupTabs();
            setupMobileMenu();
            setupClicks();

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

            const recruitment =
                document.getElementById(
                    "recruit-discord-link"
                );

            if (
                recruitment &&
                window.RECRUIT_DISCORD_URL
            ) {
                recruitment.href =
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
})();
