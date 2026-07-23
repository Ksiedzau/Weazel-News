// app.js - Obsługa logowania, zakładek i bazy danych Weazel News

const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

let supabaseInstance = null;
let currentUser = null;

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
    setupTabSwitching();
});

function initApp() {
    const supabase = getSupabase();
    if (!supabase) {
        setTimeout(initApp, 500); // Ponowna próba za chwilę
        return;
    }

    // Obsługa kliknięć przycisków logowania/wylogowania
    const loginBtn = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout");

    if (loginBtn) {
        loginBtn.addEventListener("click", loginWithDiscord);
    } else {
        console.error("Nie znaleziono przycisku #btn-login w HTML!");
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

    // Obsługa formularza dodawania postów
    const newsForm = document.getElementById("news-form");
    if (newsForm) {
        newsForm.addEventListener("submit", handleCreatePost);
    }

    // Pobierz posty z bazy
    fetchPosts();

    // Nasłuchiwanie stanu zalogowania
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Status logowania:", event, session);
        
        if (session && session.user) {
            currentUser = session.user;
            updateUI(session.user);
            
            // Czyszczenie URL z brzydkich tokenów po powrocie z Discorda
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
    if (!supabase) {
        alert("Błąd: Biblioteka Supabase nie jest gotowa.");
        return;
    }

    try {
        // dynamiczne określenie adresu URL na Github Pages
        const redirectUrl = window.location.origin + window.location.pathname;
        console.log("Inicjalizacja logowania. Przekierowanie do: ", redirectUrl);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error("Szczegóły błędu Discord:", err);
        alert("Błąd podczas logowania przez Discord: " + err.message);
    }
}

// Aktualizacja UI (zalogowany / niezalogowany)
function updateUI(user) {
    const loginBtn = document.getElementById("btn-login");
    const userInfoBox = document.getElementById("user-info");
    const userNameEl = document.getElementById("user-name");
    const userAvatarEl = document.getElementById("user-avatar");
    const navAdmin = document.getElementById("nav-admin");

    if (user) {
        const metadata = user.user_metadata || {};
        const nickname = metadata.full_name || metadata.name || metadata.preferred_username || user.email || "Użytkownik";
        const avatarUrl = metadata.avatar_url || metadata.picture || "";

        if (loginBtn) loginBtn.style.display = "none";
        if (userInfoBox) userInfoBox.style.display = "flex";
        if (userNameEl) userNameEl.textContent = nickname;
        if (userAvatarEl && avatarUrl) userAvatarEl.src = avatarUrl;

        // Pokaż panel admina każdemu zalogowanemu (możesz później ograniczyć dla wybranych ID)
        if (navAdmin) navAdmin.style.display = "flex";
    } else {
        if (loginBtn) loginBtn.style.display = "flex";
        if (userInfoBox) userInfoBox.style.display = "none";
        if (navAdmin) navAdmin.style.display = "none";
        switchTab('home'); // powrót na główną po wylogowaniu
    }
}

// Wylogowanie
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

// OBSŁUGA ZAKŁADEK (TABS)
function setupTabSwitching() {
    const buttons = document.querySelectorAll(".nav-btn");
    
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const tabName = button.getAttribute("data-tab");
            if (tabName) switchTab(tabName);
        });
    });
}

function switchTab(tabId) {
    // Ukrywanie wszystkich sekcji
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });
    
    // Pokazywanie wybranej
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add("active");

    // Zmiana klasy "active" na przyciskach w menu
    document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

// BAZA DANYCH: POBIERANIE WPISÓW
async function fetchPosts() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data: posts, error } = await supabase
            .from('news')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Kontenery dla poszczególnych podstron
        const containers = {
            'STRONA GŁÓWNA': document.getElementById("home-container"),
            'WIADOMOŚCI': document.getElementById("wiadomosci-container"),
            'ARTYKUŁY': document.getElementById("artykuly-container"),
            'TIKTOKI': document.getElementById("tiktoki-container"),
            'CITY HALL': document.getElementById("cityhall-container")
        };

        // Czyszczenie kontenerów
        Object.values(containers).forEach(container => {
            if (container) container.innerHTML = "";
        });

        // Liczniki wpisów w poszczególnych zakładkach
        const counts = { 'STRONA GŁÓWNA': 0, 'WIADOMOŚCI': 0, 'ARTYKUŁY': 0, 'TIKTOKI': 0, 'CITY HALL': 0 };

        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const targetTag = post.tag ? post.tag.toUpperCase() : 'STRONA GŁÓWNA';
                const container = containers[targetTag];

                if (container) {
                    container.innerHTML += `
                        <div class="card">
                            <img class="card-media" src="${post.image_url || 'https://i.imgur.com/vHdfC1B.png'}" alt="News Image">
                            <div class="card-body">
                                <span class="card-tag">${targetTag}</span>
                                <h2 class="card-title">${post.title}</h2>
                                <div class="card-meta">Autor: ${post.author} | ${new Date(post.created_at).toLocaleDateString('pl-PL')}</div>
                                <p class="card-text">${post.content}</p>
                            </div>
                        </div>
                    `;
                    counts[targetTag]++;
                }
            });
        }

        // Pokaż informację o braku wpisów, jeśli dana zakładka jest pusta
        Object.keys(containers).forEach(key => {
            const container = containers[key];
            if (container && counts[key] === 0) {
                container.innerHTML = `<p style="color: var(--text-muted);">Brak wpisów w kategorii: ${key.toLowerCase()}</p>`;
            }
        });

    } catch (err) {
        console.error("Błąd pobierania postów z bazy:", err.message);
    }
}

// BAZA DANYCH: DODAWANIE WPISU
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

        alert("Pomyślnie opublikowano wpis!");
        document.getElementById("news-form").reset();
        
        await fetchPosts(); // Odśwież listę
        
        // Przejdź do zakładki, do której dodaliśmy wpis
        const tabMapping = {
            'STRONA GŁÓWNA': 'home',
            'WIADOMOŚCI': 'wiadomosci',
            'ARTYKUŁY': 'artykuly',
            'TIKTOKI': 'tiktoki',
            'CITY HALL': 'cityhall'
        };
        switchTab(tabMapping[tag] || 'home');

    } catch (err) {
        console.error("Błąd publikowania wpisu:", err.message);
        alert("Błąd publikowania wpisu: " + err.message);
    }
}
