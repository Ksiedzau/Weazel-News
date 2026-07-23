// app.js - Obsługa logowania i aplikacji Weazel News

// Inicjalizacja klienta Supabase z wymuszonym przepływem PKCE (zapobiega błędom 404 z tokenami na GitHub Pages)
// Upewnij się, że podajesz swoje poprawne dane projektu Supabase, jeśli inicjalizujesz go tutaj:
const SUPABASE_URL = 'TUTAJ_WPISZ_SWOJ_URL';
const SUPABASE_ANON_KEY = 'TUTAJ_WPISZ_SWOJ_ANON_KEY';

// Jeśli inicjalizujesz Supabase w innym pliku, upewnij się, że obiekt klienta korzysta z { auth: { flowType: 'pkce' } }
if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Sprawdzenie czy Supabase jest dostępne
    const supabaseInstance = window.supabaseClient || window.supabase;
    if (!supabaseInstance) {
        console.error("Klient Supabase nie został zainicjalizowany! Sprawdź kolejność skryptów w HTML.");
    }

    // Podpięcie nasłuchiwania pod przycisk logowania
    const loginButton = document.getElementById("login-btn") || document.querySelector("button[onclick*='login']");
    if (loginButton) {
        loginButton.removeAttribute("onclick");
        loginButton.addEventListener("click", loginWithDiscord);
    }

    // Sprawdzenie aktualnej sesji użytkownika przy starcie
    checkUserSession();
});

// Główna funkcja logowania przez Discorda
async function loginWithDiscord() {
    try {
        const supabaseInstance = window.supabaseClient || window.supabase;
        if (!supabaseInstance || !supabaseInstance.auth) {
            throw new Error("Obiekt Supabase auth jest niedostępny.");
        }

        // Pobieramy pełny adres łącznie z podkatalogiem na GitHub Pages (np. /Weazel-News/)
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

// Funkcja sprawdzająca czy użytkownik jest zalogowany
async function checkUserSession() {
    const supabaseInstance = window.supabaseClient || window.supabase;
    if (!supabaseInstance) return;

    try {
        const { data: { session }, error } = await supabaseInstance.auth.getSession();
        if (error) throw error;

        if (session) {
            console.log("Zalogowany użytkownik:", session.user);
            // Tutaj ukryj przycisk logowania / pokaż panel
        } else {
            console.log("Brak aktywnej sesji - użytkownik niezalogowany.");
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
        window.location.reload();
    }
}
