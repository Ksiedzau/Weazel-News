// Konfiguracja Supabase
const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Start aplikacji
document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.getElementById("btn-login");
    const btnLogout = document.getElementById("btn-logout");

    if (btnLogin) btnLogin.onclick = loginWithDiscord;
    if (btnLogout) btnLogout.onclick = logout;

    // Nasłuchiwanie na zmiany stanu (logowanie/wylogowanie)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Event:", event);
        updateUI(session?.user || null);
    });

    // Sprawdź sesję przy starcie
    checkUser();
});

async function loginWithDiscord() {
    // Automatycznie wykrywa czy jesteś na localhost czy na GitHub Pages
    const redirectUrl = window.location.origin + window.location.pathname;
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: redirectUrl
        }
    });

    if (error) console.error("Błąd logowania:", error.message);
}

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    updateUI(session?.user || null);
}

function updateUI(user) {
    const loginBtn = document.getElementById("btn-login");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar");
    const adminNav = document.getElementById("admin-nav");

    if (user) {
        loginBtn.style.display = "none";
        userInfo.style.display = "flex";
        if (adminNav) adminNav.style.display = "block"; // Pokazuje przycisk panelu

        const meta = user.user_metadata;
        userName.textContent = meta.full_name || meta.name || "Użytkownik";
        userAvatar.src = meta.avatar_url || "";
    } else {
        loginBtn.style.display = "flex";
        userInfo.style.display = "none";
        if (adminNav) adminNav.style.display = "none";
    }
}

async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Błąd wylogowania:", error.message);
    window.location.reload();
}
