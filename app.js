// app.js - Obsługa logowania i aplikacji Weazel News

const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

let supabaseInstance = null;

// Bezpieczna inicjalizacja klienta Supabase
function getSupabase() {
    if (supabaseInstance) return supabaseInstance;

    const supabaseLib = window.supabaseClient || window.supabase;
    if (!supabaseLib) {
        console.error("Błąd: Biblioteka Supabase nie została jeszcze załadowana!");
        return null;
    }

    // Jeśli klient nie był jeszcze stworzony, tworzymy go
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
    const supabase = getSupabase();
    if (!supabase) {
        // Spróbuj zainicjalizować ponownie za sekundę, jeśli CDN się opóźnia
        setTimeout(initApp, 1000);
    } else {
        initApp();
    }
});

function initApp() {
    const supabase = getSupabase();
    if (!supabase) return;

    // Rejestracja zdarzeń na przyciskach
    const loginBtn = document.getElementById("btn-login");
    const logoutBtn = document.getElementById("btn-logout"); // Upewnij się, że Twój przycisk do wylogowania ma takie ID!

    if (loginBtn) {
        loginBtn.addEventListener("click", loginWithDiscord);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

    // Nasłuchiwanie zmian stanu autoryzacji (Zalecane przez Supabase)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Zmiana stanu autoryzacji:", event, session);
        
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            if (session) {
                updateUI(session.user);
                // Czyszczenie parametrów z adresu URL po zalogowaniu (estetyka)
                if (window.location.search.includes("code=")) {
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                }
            }
        } else if (event === "SIGNED_OUT") {
            updateUI(null);
        }
    });
}

// Funkcja logowania przez Discorda
async function loginWithDiscord() {
    const supabase = getSupabase();
    if (!supabase) {
        alert("Błąd: Klient Supabase nie jest gotowy.");
        return;
    }

    try {
        // Dokładny adres powrotny na GitHub Pages (np. https://twojlogin.github.io/nazwa-repo/)
        const redirectUrl = window.location.origin + window.location.pathname;
        console.log("Przekierowanie po logowaniu do:", redirectUrl);

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

// Aktualizacja interfejsu użytkownika na podstawie stanu zalogowania
function updateUI(user) {
    const loginBtn = document.getElementById("btn-login");
    const userInfoBox = document.getElementById("user-info");
    const userNameEl = document.getElementById("user-name");
    const userAvatarEl = document.getElementById("user-avatar");

    if (user) {
        const metadata = user.user_metadata || {};
        const nickname = metadata.full_name || metadata.name || metadata.preferred_username || user.email || "Użytkownik";
        const avatarUrl = metadata.avatar_url || metadata.picture || "";

        if (loginBtn) loginBtn.style.display = "none";
        if (userInfoBox) {
            userInfoBox.style.display = "flex";
            // Jeśli CSS korzysta z innej metody wyświetlania (np. blokowej), zmień powyższe na "block"
        }
        if (userNameEl) userNameEl.textContent = nickname;
        
        if (userAvatarEl && avatarUrl) {
            userAvatarEl.src = avatarUrl;
            userAvatarEl.style.display = "block";
        }
    } else {
        if (loginBtn) loginBtn.style.display = "flex"; // lub "block"
        if (userInfoBox) userInfoBox.style.display = "none";
    }
}

// Funkcja wylogowania
async function logout() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Przeładuj stronę po wylogowaniu, żeby wyczyścić pamięć podręczną
        window.location.href = window.location.origin + window.location.pathname;
    } catch (err) {
        console.error("Błąd wylogowania:", err.message);
    }
}
