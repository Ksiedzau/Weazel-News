// --- ZARZĄDZANIE ZAKŁADKAMI ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetTab = document.getElementById(`tab-${tabId}`);
    const targetBtn = document.getElementById(`btn-tab-${tabId}`);

    if (targetTab) targetTab.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Odśwież dane w zależności od zakładki
    if (tabId === 'home') loadHomeContent();
    if (tabId === 'wiadomosci') loadCategoryContent('wiadomosci', 'wiadomosci-grid');
    if (tabId === 'artykuly') loadCategoryContent('artykuly', 'artykuly-grid');
    if (tabId === 'tiktoki') loadTiktoks();
    if (tabId === 'cityhall') loadCityHallNotices();
}

// --- AUTORYZACJA DISCORD PRZEZ SUPABASE ---
async function loginWithDiscord() {
    const { error } = await window.supabase.auth.signInWithOAuth({
        provider: 'discord',
    });
    if (error) {
        console.error('Błąd logowania:', error.message);
        alert('Nie udało się zalogować przez Discord.');
    }
}

async function logout() {
    await window.supabase.auth.signOut();
    location.reload();
}

// --- SPRAWDZANIE SESJI I UPRAWNIEN ---
async function checkUserSession() {
    const { data: { session } } = await window.supabase.auth.getSession();
    
    if (session && session.user) {
        const user = session.user;
        const discordId = user.user_metadata?.provider_id || user.id; 
        const username = user.user_metadata?.full_name || user.user_metadata?.name || 'Użytkownik';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) loginBtn.style.display = 'none';
        
        const userInfo = document.getElementById('user-info');
        if (userInfo) userInfo.style.display = 'flex';
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.innerText = username;

        const userAvatarEl = document.getElementById('user-avatar');
        if (avatarUrl && userAvatarEl) {
            userAvatarEl.src = avatarUrl;
        }

        // Przypisywanie ról na podstawie config.js
        let roleName = "Redaktor";
        let roleColor = "var(--text-muted)";

        // Reset panelu admina
        document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'none');
        
        const isBoss = window.BOSS_DISCORD_IDS && window.BOSS_DISCORD_IDS.includes(String(discordId));
        const isAdmin = window.ADMIN_DISCORD_IDS && window.ADMIN_DISCORD_IDS.includes(String(discordId));
        const isCityHall = window.CITY_HALL_DISCORD_IDS && window.CITY_HALL_DISCORD_IDS.includes(String(discordId));

        const adminTabBtn = document.getElementById('btn-tab-admin');

        if (isBoss) {
            roleName = "Szefostwo";
            roleColor = "var(--accent-red)";
            if (adminTabBtn) adminTabBtn.style.display = 'inline-block';
            document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'block');
        } else if (isAdmin) {
            roleName = "Administrator";
            roleColor = "var(--accent-gold)";
            if (adminTabBtn) adminTabBtn.style.display = 'inline-block';
            document.querySelectorAll('.admin-card').forEach(card => card.style.display = 'block');
        } else if (isCityHall) {
            roleName = "City Hall";
            roleColor = "var(--accent-blue)";
            if (adminTabBtn) adminTabBtn.style.display = 'inline-block';
            const chForm = document.getElementById('form-cityhall-art');
            if (chForm) chForm.style.display = 'block';
        }

        const roleBadge = document.getElementById('user-role');
        if (roleBadge) {
            roleBadge.innerText = roleName;
            roleBadge.style.color = roleColor;
        }
    }
}

// --- POBIERANIE TREŚCI Z BAZY ---
async function loadHomeContent() {
    const grid = document.getElementById('home-grid');
    if (!grid) return;
    
    const { data, error } = await window.supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Błąd ładowania danych.</p>';
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Brak wpisów w tej sekcji.</p>';
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="card" onclick="openModal('${item.title}', '${item.created_at}', '${item.media_url}', '${escapeHtml(item.content)}')">
            <img class="card-media" src="${item.media_url || ''}" alt="Grafika" onerror="this.src='https://via.placeholder.com/300x180?text=Weazel+News'">
            <div class="card-body">
                <span class="card-tag">${item.tag || 'NEWS'}</span>
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${new Date(item.created_at).toLocaleDateString('pl-PL')}</div>
                <p class="card-text">${item.content ? item.content.substring(0, 90) + '...' : ''}</p>
            </div>
        </div>
    `).join('');
}

async function loadCategoryContent(category, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const { data, error } = await window.supabase
        .from('articles')
        .select('*')
        .eq('target', category)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Brak wpisów w tej sekcji.</p>';
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="card" onclick="openModal('${item.title}', '${item.created_at}', '${item.media_url}', '${escapeHtml(item.content)}')">
            <img class="card-media" src="${item.media_url || ''}" alt="Grafika">
            <div class="card-body">
                <span class="card-tag">${item.tag || category}</span>
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${new Date(item.created_at).toLocaleDateString('pl-PL')}</div>
                <p class="card-text">${item.content ? item.content.substring(0, 90) + '...' : ''}</p>
            </div>
        </div>
    `).join('');
}

async function loadCityHallNotices() {
    const grid = document.getElementById('cityhall-grid');
    if (!grid) return;

    const { data, error } = await window.supabase
        .from('city_hall')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Brak ogłoszeń urzędowych.</p>';
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="card" onclick="openModal('${item.title}', '${item.created_at}', '${item.media_url}', '${escapeHtml(item.content)}')">
            <img class="card-media" src="${item.media_url || ''}" alt="Dekret">
            <div class="card-body" style="border-top: 3px solid var(--accent-blue);">
                <span class="card-tag" style="background:var(--accent-blue)">CITY HALL</span>
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${new Date(item.created_at).toLocaleDateString('pl-PL')}</div>
                <p class="card-text">${item.content ? item.content.substring(0, 90) + '...' : ''}</p>
            </div>
        </div>
    `).join('');
}

async function loadTiktoks() {
    const grid = document.getElementById('tiktok-grid');
    if (!grid) return;

    const { data, error } = await window.supabase
        .from('tiktoks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Brak materiałów wideo.</p>';
        return;
    }

    grid.innerHTML = data.map(item => `
        <div class="card">
            <video class="card-media" controls src="${item.media_url}"></video>
            <div class="card-body">
                <span class="card-tag" style="background:var(--accent-gold); color:#000;">TIKTOK</span>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-text">${item.description || ''}</p>
            </div>
        </div>
    `).join('');
}

// --- TWORZENIE WPISÓW (PANEL ADMINA) ---
async function createArticle(event) {
    event.preventDefault();
    const target = document.getElementById('art-target').value;
    const title = document.getElementById('art-title').value;
    const tag = document.getElementById('art-tag').value;
    const media_url = document.getElementById('art-media-url').value;
    const content = document.getElementById('art-content').value;

    const { error } = await window.supabase.from('articles').insert([{ target, title, tag, media_url, content }]);
    if (error) {
        alert('Błąd podczas dodawania artykułu: ' + error.message);
    } else {
        alert('Artykuł dodany pomyślnie!');
        location.reload();
    }
}

async function createCityHallNotice(event) {
    event.preventDefault();
    const title = document.getElementById('ch-title').value;
    const media_url = document.getElementById('ch-media-url').value;
    const content = document.getElementById('ch-content').value;

    const { error } = await window.supabase.from('city_hall').insert([{ title, media_url, content }]);
    if (error) {
        alert('Błąd podczas dodawania ogłoszenia: ' + error.message);
    } else {
        alert('Dekret City Hall opublikowany!');
        location.reload();
    }
}

async function createTiktok(event) {
    event.preventDefault();
    const title = document.getElementById('tt-title').value;
    const media_url = document.getElementById('tt-url').value;
    const description = document.getElementById('tt-desc').value;

    const { error } = await window.supabase.from('tiktoks').insert([{ title, media_url, description }]);
    if (error) {
        alert('Błąd podczas dodawania TikToka: ' + error.message);
    } else {
        alert('TikTok dodany pomyślnie!');
        location.reload();
    }
}

// --- OBSŁUGA MODALA ---
function openModal(title, date, mediaUrl, content) {
    document.getElementById('m-title').innerText = title;
    document.getElementById('m-meta').innerText = new Date(date).toLocaleDateString('pl-PL');
    
    const mediaContainer = document.getElementById('m-media');
    if (mediaUrl) {
        mediaContainer.innerHTML = `<img src="${mediaUrl}" style="width:100%; max-height:350px; object-fit:cover; border-radius:6px; margin-bottom:15px;" alt="Zdjęcie artykułu">`;
    } else {
        mediaContainer.innerHTML = '';
    }
    
    document.getElementById('m-content').innerText = content;
    document.getElementById('modal-art').classList.add('active');
}

function closeModal(event) {
    if (!event || event.target.id === 'modal-art' || event.target.classList.contains('modal-close')) {
        document.getElementById('modal-art').classList.remove('active');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Inicjalizacja po załadowaniu strony
window.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    loadHomeContent();
});
