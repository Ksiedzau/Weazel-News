// app.js - Obsługa logowania i aplikacji Weazel News

document.addEventListener("DOMContentLoaded", () => {
    // Sprawdzenie czy Supabase jest dostępne
    if (!window.supabase) {
        console.error("Klient Supabase nie został zainicjalizowany! Sprawdź kolejność skryptów w HTML.");
    }

    // Podpięcie nasłuchiwania pod przycisk logowania (jeśli istnieje w HTML, np. o id 'login-btn' lub klasie)
    const loginButton = document.getElementById("login-btn") || document.querySelector("button[onclick*='login']");
    if (loginButton) {
        // Usuwamy stare inline onclick z HTML jeśli koliduje, i przypisujemy czysty nasłuchiwacz
        loginButton.removeAttribute("onclick");
        loginButton.addEventListener("click", loginWithDiscord);
    }

    // Sprawdzenie aktualnej sesji użytkownika przy starcie
    checkUserSession();
});

// Główna funkcja logowania przez Discorda
async function loginWithDiscord() {
    try {
        if (!window.supabase || !window.supabase.auth) {
            throw new Error("Obiekt Supabase auth jest niedostępny.");
        }

        // NAPRAWA BŁĘDU 404: Pobieramy pełny adres łącznie z podkatalogiem na GitHub Pages (np. /Weazel-News/)
        const redirectUrl = window.location.origin + window.location.pathname;

        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl // Wraca na poprawną ścieżkę
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
    if (!window.supabase) return;

    try {
        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error) throw error;

        if (session) {
            console.log("Zalogowany użytkownik:", session.user);
            // Tutaj możesz dodać kod ukrywający przycisk logowania i pokazujący panel użytkownika
        } else {
            console.log("Brak aktywnej sesji - użytkownik niezalogowany.");
        }
    } catch (err) {
        console.error("Błąd pobierania sesji:", err.message);
    }
}

// Opcjonalna funkcja wylogowania
async function logout() {
    if (!window.supabase) return;
    
    const { error } = await window.supabase.auth.signOut();
    if (error) {
        console.error("Błąd wylogowania:", error.message);
    } else {
        window.location.reload();
    }
}
