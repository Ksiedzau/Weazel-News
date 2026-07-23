// app.js - Obsługa logowania i aplikacji Weazel News

const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

// Inicjalizacja klienta Supabase z przepływem PKCE (wymaganym dla GitHub Pages)
if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true // Kluczowe: automatycznie wykrywa token/kod w URL po powrocie z OAuth
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const supabaseInstance = window.supabaseClient || window.supabase;
    if (!supabaseInstance) {
        console.error("Klient Supabase nie został zainicjalizowany!");
        return;
    }

    // Podpięcie nasłuchiwania pod przycisk logowania
    const loginButton = document.getElementById("btn-login") || document.querySelector("button[onclick*='login']");
    if (loginButton) {
        loginButton.removeAttribute("onclick");
        loginButton.addEventListener("click", loginWithDiscord);
    }

    // Sprawdzamy sesję przy starcie (automatycznie obsłuży też powrót z Discorda dzięki detectSessionInUrl)
    await checkUserSession();
});

// Główna funkcja logowania przez Discorda
async function loginWithDiscord() {
    try {
        const supabaseInstance = window.supabaseClient || window.supabase;
        if (!supabaseInstance || !supabaseInstance.auth) {
            throw new Error("Obiekt Supabase auth jest niedostępny.");
        }

        // Pobieramy pełny adres łącznie z podkatalogiem na GitHub Pages
        const redirectUrl = window.location.origin + window.location.pathname;

        const { data, error } = await supabaseInstance.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl 
            }
        });

        if (error) {
            console.error("Błąd podczas logowania przez Discorda:", error.message);
            alert("Nie udało się zalogować: " + error.message);
        }
    } catch (err) {
        console.error("Wystąpił nieoczekiwany błąd w loginWithDiscord:", err);
    }
}

// Funkcja sprawdzająca sesję i aktualizująca widok interfejsu
async function checkUserSession() {
    const supabaseInstance = window.supabaseClient || window.supabase;
    if (!supabaseInstance) return;

    try {
        const { data: { session }, error } = await supabaseInstance.auth.getSession();
        if (error) throw error;

        const loginBtn = document.getElementById("btn-login");
        const userInfoBox = document.getElementById("user-info");
        const userNameEl = document.getElementById("user-name");
        const userAvatarEl = document.getElementById("user-avatar");

        if (session && session.user) {
            console.log("Zalogowany użytkownik:", session.user);

            // Wyciągamy dane z profilu Discorda (zależnie od struktury user_metadata)
            const metadata = session.user.user_metadata || {};
            const nickname = metadata.full_name || metadata.name || metadata.preferred_username || session.user.email || "Użytkownik";
            const avatarUrl = metadata.avatar_url || metadata.picture || "";

            // Podmieniamy widok elementów na stronie
            if (loginBtn) loginBtn.style.display = "none";
            if (userInfoBox) userInfoBox.style.display = "flex";
            if (userNameEl) userNameEl.textContent = nickname;
            if (userAvatarEl && avatarUrl) userAvatarEl.src = avatarUrl;

            // Opcjonalnie: odblokowanie paneli administracyjnych, jeśli użytkownik ma uprawnienia
            // (Możesz tu dodać własną logikę sprawdzania roli)

        } else {
            console.log("Brak aktywnej sesji - użytkownik niezalogowany.");
            if (loginBtn) loginBtn.style.display = "flex";
            if (userInfoBox) userInfoBox.style.display = "none";
        }
    } catch (err) {
        console.error("Błąd pobierania sesji:", err.message);
    }
}

// Funkcja wylogowania
async function logout() {
    const supabaseInstance = window.supabaseClient || window.supabase;
    if (!supabaseInstance) return;
    
    const { error } = await supabaseInstance.auth.signOut();
    if (error) {
        console.error("Błąd wylogowania:", error.message);
    } else {
        window.location.href = window.location.origin + window.location.pathname;
    }
}
