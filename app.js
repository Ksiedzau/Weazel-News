const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdmin = false;
let isBoss = false;
let isCityHall = false;

let articles = [];
let tiktoks = [];

// Autoryzacja Discord
async function loginWithDiscord() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: window.location.href }
    });
    if (error) alert('Błąd logowania: ' + error.message);
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        document.getElementById('btn-login').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').innerText = user.user_metadata.full_name || 'Użytkownik';
        document.getElementById('user-avatar').src = user.user_metadata.avatar_url || '';

        const rawDiscordId = user.identities?.[0]?.identity_data?.sub 
                          || user.user_metadata.provider_id 
                          || user.identities?.[0]?.id 
                          || user.id;

        const currentId = String(rawDiscordId).trim();

        const bossList = (typeof BOSS_DISCORD_IDS !== 'undefined' ? BOSS_DISCORD_IDS : []).map(id => String(id).trim());
        const adminList = (typeof ADMIN_DISCORD_IDS !== 'undefined' ? ADMIN_DISCORD_IDS : []).map(id => String(id).trim());
        const chList = (typeof CITY_HALL_DISCORD_IDS !== 'undefined' ? CITY_HALL_DISCORD_IDS : []).map(id => String(id).trim());

        if (bossList.includes(currentId)) {
            isBoss = true; isAdmin = true; isCityHall = true;
            setRoleBadge('👑 SZEF', '#dc2626');
            showAdminPanel(true, true);
        } else if (adminList.includes(currentId)) {
            isAdmin = true;
            setRoleBadge('⭐ ADMIN', '#dc2626');
            showAdminPanel(true, false);
        } else if (chList.includes(currentId)) {
            isCityHall = true;
            setRoleBadge('🏛️ CITY HALL', '#eab308');
            showAdminPanel(false, true);
        } else {
            setRoleBadge('ID: ' + currentId, '#a3a3a3');
        }
    }
    loadData();
}

function setRoleBadge(text, color) {
    const roleEl = document.getElementById('user-role');
    roleEl.innerText = text;
    roleEl.style.color = color;
}

function showAdminPanel(showGeneral, showCityHall) {
    document.getElementById('btn-tab-admin').style.display = 'inline-block';
    if (showGeneral) {
        document.getElementById('form-general-art').style.display = 'block';
        document.getElementById('form-tiktok-art').style.display = 'block';
    } else {
        document.getElementById('form-general-art').style.display = 'none';
        document.getElementById('form-tiktok-art').style.display = 'none';
    }
    if (showCityHall) {
        document.getElementById('form-cityhall-art').style.display = 'block';
    }
}

// Pobieranie danych
async function loadData() {
    const { data: artData } = await supabaseClient.from('articles').select('*').order('id', { ascending: false });
    if (artData) articles = artData;

    const { data: ttData } = await supabaseClient.from('tiktoks').select('*').order('id', { ascending: false });
    if (ttData) tiktoks = ttData;

    renderAll();
}

function renderAll() {
    renderGrid('home-grid', articles);
    renderGrid('wiadomosci-grid', articles.filter(a => a.target === 'wiadomosci'));
    renderGrid('artykuly-grid', articles.filter(a => a.target === 'artykuly'));
    renderGrid('cityhall-grid', articles.filter(a => a.target === 'cityhall'));
    renderTiktoks();
}

function renderGrid(containerId, list) {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);">Brak wpisów w tej sekcji.</p>';
        return;
    }

    grid.innerHTML = list.map(art => `
        <div class="card">
            ${art.media_type === 'video' 
                ? `<video class="card-media" controls src="${art.media_url}"></video>` 
                : `<img class="card-media" src="${art.media_url}" onerror="this.src=''">`}
            <div class="card-body">
                <span class="card-tag">${art.tag}</span>
                <div class="card-title">${art.title}</div>
                <div class="card-meta">✍️ ${art.author} | 📅 ${art.date}</div>
                <div class="card-text">${art.content.substring(0, 110)}...</div>
                <button class="btn-red" style="margin-top:0.5rem;" onclick="openModal(${art.id})">Czytaj całość</button>
                ${(isAdmin || (isCityHall && art.target === 'cityhall')) ? `<button class="btn-red btn-danger" style="margin-top:0.4rem; font-size:0.7rem;" onclick="deleteArticle(${art.id})">🗑️ Usunąć</button>` : ''}
            </div>
        </div>
    `).join('');
}

function renderTiktoks() {
    const grid = document.getElementById('tiktok-grid');
    if (!grid) return;
    if (tiktoks.length === 0) { grid.innerHTML = '<p style="color:var(--text-muted);">Brak wideo.</p>'; return; }

    grid.innerHTML = tiktoks.map(tt => `
        <div class="card">
            <video class="card-media" controls src="${tt.url}"></video>
            <div class="card-body">
                <div class="card-title">${tt.title}</div>
                <div class="card-meta">📱 ${tt.author} | 📅 ${tt.date}</div>
                <div class="card-text">${tt.description || ''}</div>
                ${isAdmin ? `<button class="btn-red btn-danger" style="margin-top:0.5rem; font-size:0.7rem;" onclick="deleteTiktok(${tt.id})">🗑️ Usunąć</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Dodawanie wpisów
async function createArticle(e) {
    e.preventDefault();
    if (!isAdmin) return alert('Brak uprawnień!');
    const author = document.getElementById('user-name').innerText || 'Redakcja';
    const date = new Date().toLocaleDateString('pl-PL');

    const { error } = await supabaseClient.from('articles').insert([{
        target: document.getElementById('art-target').value,
        title: document.getElementById('art-title').value,
        tag: document.getElementById('art-tag').value,
        media_type: document.getElementById('art-media-type').value,
        media_url: document.getElementById('art-media-url').value,
        content: document.getElementById('art-content').value,
        author, date
    }]);

    if (error) alert('Błąd: ' + error.message);
    else { alert('Opublikowano wpis!'); loadData(); e.target.reset(); }
}

async function createCityHallNotice(e) {
    e.preventDefault();
    if (!isCityHall) return alert('Brak uprawnień City Hall!');
    const author = document.getElementById('user-name').innerText || 'Urząd Miasta';
    const date = new Date().toLocaleDateString('pl-PL');

    const { error } = await supabaseClient.from('articles').insert([{
        target: 'cityhall',
        title: document.getElementById('ch-title').value,
        tag: 'CITY HALL',
        media_type: 'image',
        media_url: document.getElementById('ch-media-url').value,
        content: document.getElementById('ch-content').value,
        author, date
    }]);

    if (error) alert('Błąd: ' + error.message);
    else { alert('Opublikowano ogłoszenie City Hall!'); loadData(); e.target.reset(); }
}

async function createTiktok(e) {
    e.preventDefault();
    if (!isAdmin) return alert('Brak uprawnień!');
    const author = document.getElementById('user-name').innerText || 'Redakcja';
    const date = new Date().toLocaleDateString('pl-PL');

    const { error } = await supabaseClient.from('tiktoks').insert([{
        title: document.getElementById('tt-title').value,
        url: document.getElementById('tt-url').value,
        description: document.getElementById('tt-desc').value,
        author, date
    }]);

    if (error) alert('Błąd: ' + error.message);
    else { alert('Dodano TikTok!'); loadData(); e.target.reset(); }
}

// Usunięcie wpisu
async function deleteArticle(id) {
    if (confirm('Czy na pewno chcesz usunąć ten wpis?')) {
        await supabaseClient.from('articles').delete().eq('id', id);
        loadData();
    }
}

async function deleteTiktok(id) {
    if (confirm('Usunąć wideo?')) {
        await supabaseClient.from('tiktoks').delete().eq('id', id);
        loadData();
    }
}

// Przełączanie Zakładek
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('btn-tab-' + tab).classList.add('active');
}

// Modal
function openModal(id) {
    const art = articles.find(a => a.id === id);
    if (!art) return;
    document.getElementById('m-title').innerText = art.title;
    document.getElementById('m-meta').innerText = `✍️ ${art.author} | 📅 ${art.date} | Kategoria: ${art.target.toUpperCase()}`;
    document.getElementById('m-content').innerText = art.content;
    document.getElementById('m-media').innerHTML = art.media_type === 'video' 
        ? `<video style="width:100%; max-height:350px;" controls src="${art.media_url}"></video>` 
        : `<img style="width:100%; max-height:350px; object-fit:cover; border-radius:4px;" src="${art.media_url}">`;
    document.getElementById('modal-art').classList.add('active');
}

function closeModal(e) {
    if (!e || e.target.id === 'modal-art' || e.target.classList.contains('modal-close')) {
        document.getElementById('modal-art').classList.remove('active');
    }
}

checkUser();
