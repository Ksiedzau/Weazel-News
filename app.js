// app.js - Obsługa logowania, zakładek i bazy danych Weazel News

const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

let supabaseInstance = null;
let currentUser = null;

// Lista Discord ID osób, które mogą wejść do Panelu Naczelnika (Admina)
// WPISZ TUTAJ SWÓJ DISCORD ID oraz innych naczelników
const ADMIN_DISCORD_IDS = [
    "359740523267522560", // Przykładowe Discord ID, zamień na swoje!
];

// Bezpieczna inicjalizacja klienta Supabase
function getSupabase() {
    if (supabaseInstance) return supabaseInstance;

    const supabaseLib = window.supabaseClient || window.supabase;
    if (!supabaseLib) {
        console.error("Błąd: Biblioteka Supabase nie została jeszcze załadowana!");
        return null;
    }

    if (!window.supabaseClient) {
        window.supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                flowType: 'pkce',
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    supabaseInstance = window.supabaseClient;
    return supabaseInstance;
}

// Główny punkt startowy aplikacji
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupMobileMenu();
    setupTabSwitching();
});

function initApp() {
    const supabase = getSupabase();
    if (!supabase) {
        setTimeout(initApp, 500); // Ponowna próba
        return;
    }

    // Obsługa przycisków logowania/wylogowania
    const loginBtn = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout");

    if (loginBtn) loginBtn.addEventListener("click", loginWithDiscord);
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    // Obsługa dodawania postów z formularza admina
    const newsForm = document.getElementById("news-form");
    if (newsForm) {
        newsForm.addEventListener("submit", handleCreatePost);
    }

    // Załaduj posty z bazy danych
    fetchPosts();

    // Nasłuchiwanie zmian stanu autoryzacji (Zalecane przez Supabase)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Zmiana stanu autoryzacji:", event, session);
        
        if (session && session.user) {
            currentUser = session.user;
            updateUI(session.user);
            
            // Czyszczenie parametrów z paska adresu (estetyka)
            if (window.location.search.includes("code=")) {
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        } else {
            currentUser = null;
            updateUI(null);
        }
    });
}

// Funkcja logowania przez Discorda
async function loginWithDiscord() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error("Błąd podczas logowania przez Discorda:", err.message);
        alert("Nie udało się zalogować: " + err.message);
    }
}

// Aktualizacja interfejsu użytkownika
function updateUI(user) {
    const loginBtn = document.getElementById("btn-login");
    const userInfoBox = document.getElementById("user-info");
    const userNameEl = document.getElementById("user-name");
    const userAvatarEl = document.getElementById("user-avatar");
    
    const navAdmin = document.getElementById("nav-admin");
    const sidebarAdmin = document.getElementById("sidebar-admin");

    if (user) {
        const metadata = user.user_metadata || {};
        const nickname = metadata.full_name || metadata.name || metadata.preferred_username || user.email || "Użytkownik";
        const avatarUrl = metadata.avatar_url || metadata.picture || "";

        if (loginBtn) loginBtn.style.display = "none";
        if (userInfoBox) userInfoBox.style.display = "flex";
        if (userNameEl) userNameEl.textContent = nickname;
        if (userAvatarEl && avatarUrl) userAvatarEl.src = avatarUrl;

        // Sprawdź uprawnienia Admina na podstawie konta powiązanego z Discord
        const providerId = user.identities?.[0]?.id || user.id; 
        if (ADMIN_DISCORD_IDS.includes(providerId) || ADMIN_DISCORD_IDS.includes(user.id)) {
            if (navAdmin) navAdmin.style.display = "block";
            if (sidebarAdmin) sidebarAdmin.style.display = "block";
        } else {
            // Tymczasowo: Jeśli chcesz, aby każdy zalogowany widział panel admina do testów, odkomentuj poniższe linie:
            if (navAdmin) navAdmin.style.display = "block";
            if (sidebarAdmin) sidebarAdmin.style.display = "block";
        }
    } else {
        if (loginBtn) loginBtn.style.display = "flex";
        if (userInfoBox) userInfoBox.style.display = "none";
        if (navAdmin) navAdmin.style.display = "none";
        if (sidebarAdmin) sidebarAdmin.style.display = "none";
        switchTab('news'); // Powrót na stronę główną po wylogowaniu
    }
}

// Funkcja wylogowania
async function logout() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = window.location.origin + window.location.pathname;
    } catch (err) {
        console.error("Błąd wylogowania:", err.message);
    }
}

// OBSŁUGA ZAKŁADEK (TAB SWITCHING)
function setupTabSwitching() {
    const buttons = document.querySelectorAll(".nav-btn, .sidebar-btn, .brand");
    
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const tabName = button.getAttribute("data-tab") || 'news';
            switchTab(tabName);
            
            // Zamknij sidebar mobilny przy zmianie zakładki
            document.getElementById("mobile-sidebar").classList.remove("active");
            document.getElementById("sidebar-overlay").classList.remove("active");
        });
    });
}

function switchTab(tabId) {
    // Ukryj wszystkie zakładki
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });
    
    // Pokaż wybraną zakładkę
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add("active");

    // Zaktualizuj klasę 'active' w menu górnym
    document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Zaktualizuj klasę 'active' w sidebarze
    document.querySelectorAll(".sidebar-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

// MENU MOBILNE (OTWIERANIE/ZAMYKANIE)
function setupMobileMenu() {
    const menuBtn = document.getElementById("mobile-menu-btn");
    const closeBtn = document.getElementById("sidebar-close");
    const sidebar = document.getElementById("mobile-sidebar");
    const overlay = document.getElementById("sidebar-overlay");

    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.add("active");
            overlay.classList.add("active");
        });
    }

    if (closeBtn && sidebar && overlay) {
        closeBtn.addEventListener("click", () => {
            sidebar.classList.remove("active");
            overlay.classList.remove("active");
        });
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("active");
            overlay.classList.remove("active");
        });
    }
}

// BAZA DANYCH: POBIERANIE POSTÓW (WIADOMOŚCI)
async function fetchPosts() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // Pobieramy wpisy z tabeli 'news' posortowane od najnowszego
        const { data: posts, error } = await supabase
            .from('news')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const newsContainer = document.getElementById("news-container");
        const cityhallContainer = document.getElementById("cityhall-container");

        if (newsContainer) newsContainer.innerHTML = "";
        if (cityhallContainer) cityhallContainer.innerHTML = "";

        let newsCount = 0;
        let govCount = 0;

        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const postHtml = `
                    <div class="card">
                        <img class="card-media" src="${post.image_url || 'https://i.imgur.com/vHdfC1B.png'}" alt="News Image">
                        <div class="card-body">
                            <span class="card-tag">${post.tag || 'WIADOMOŚCI'}</span>
                            <h2 class="card-title">${post.title}</h2>
                            <div class="card-meta">Autor: ${post.author} | ${new Date(post.created_at).toLocaleDateString('pl-PL')}</div>
                            <p class="card-text">${post.content}</p>
                        </div>
                    </div>
                `;

                if (post.tag === "RZĄDOWE") {
                    if (cityhallContainer) cityhallContainer.innerHTML += postHtml;
                    govCount++;
                } else {
                    if (newsContainer) newsContainer.innerHTML += postHtml;
                    newsCount++;
                }
            });
        }

        // Komunikaty zastępcze jeśli brak postów
        if (newsCount === 0 && newsContainer) {
            newsContainer.innerHTML = '<p style="color: var(--text-muted);">Brak aktualnych wiadomości w bazie danych.</p>';
        }
        if (govCount === 0 && cityhallContainer) {
            cityhallContainer.innerHTML = '<p style="color: var(--text-muted);">Brak oficjalnych komunikatów rządowych.</p>';
        }

    } catch (err) {
        console.error("Błąd pobierania postów:", err.message);
    }
}

// BAZA DANYCH: DODAWANIE POSTA PRZEZ FORMULARZ ADMINA
async function handleCreatePost(e) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    if (!currentUser) {
        alert("Musisz być zalogowany, aby dodać artykuł!");
        return;
    }

    const title = document.getElementById("news-title").value;
    const tag = document.getElementById("news-tag").value;
    const imageUrl = document.getElementById("news-image").value;
    const content = document.getElementById("news-content").value;

    const metadata = currentUser.user_metadata || {};
    const authorName = metadata.full_name || metadata.name || "Naczelnik";

    try {
        const { error } = await supabase
            .from('news')
            .insert([
                {
                    title: title,
                    tag: tag,
                    image_url: imageUrl,
                    content: content,
                    author: authorName,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        alert("Artykuł został opublikowany!");
        document.getElementById("news-form").reset(); // Reset pól formularza
        
        // Odśwież posty i przejdź do odpowiedniej zakładki
        await fetchPosts();
        if (tag === "RZĄDOWE") {
            switchTab('cityhall');
        } else {
            switchTab('news');
        }

    } catch (err) {
        console.error("Błąd publikowania artykułu:", err.message);
        alert("Błąd podczas publikacji: " + err.message);
    }
}
