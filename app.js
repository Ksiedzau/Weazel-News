const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdmin = false;
let isBoss = false;
let articles = [];
let tiktoks = [];
let teamMembers = [];

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

        const discordId = user.user_metadata.provider_id || user.identities?.[0]?.id;

        if (BOSS_DISCORD_IDS.includes(discordId)) {
            isBoss = true;
            isAdmin = true;
            document.getElementById('user-role').innerText = '👑 SZEF';
            document.getElementById('user-role').style.color = '#8b5cf6';
            document.getElementById('btn-tab-admin').style.display = 'inline-block';
            document.getElementById('boss-panel').style.display = 'block';
        } else if (ADMIN_DISCORD_IDS.includes(discordId)) {
            isAdmin = true;
            document.getElementById('user-role').innerText = '⭐ ADMIN';
            document.getElementById('btn-tab-admin').style.display = 'inline-block';
        }
    }
    loadData();
}

// Pobieranie danych z Supabase
async function loadData() {
    const { data: artData } = await supabaseClient.from('articles').select('*').order('id', { ascending: false });
    if (artData) articles = artData;

    const { data: ttData } = await supabaseClient.from('tiktoks').select('*').order('id', { ascending: false });
    if (ttData) tiktoks = ttData;

    const { data: teamData } = await supabaseClient.from('team').select('*');
    if (teamData) teamMembers = teamData;

    renderArticles();
    renderTiktoks();
    renderTeam();
}

// Renderowanie
function renderArticles() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    if (articles.length === 0) { grid.innerHTML = '<p>Brak artykułów w bazie.</p>'; return; }

    grid.innerHTML = articles.map(art => `
        <div class="card">
            ${art.media_type === 'video' 
                ? `<video class="card-media" controls src="${art.media_url}"></video>` 
                : `<img class="card-media" src="${art.media_url}" onerror="this.src=''">`}
            <div class="card-body">
                <span style="font-size:0.75rem; color:var(--accent);">${art.tag}</span>
                <div class="card-title">${art.title}</div>
                <div class="card-meta">✍️ ${art.author} | 📅 ${art.date}</div>
                <div class="card-text">${art.content.substring(0, 100)}...</div>
                <button class="btn" style="margin-top:0.5rem;" onclick="openModal(${art.id})">Czytaj dalej</button>
                ${isAdmin ? `<button class="btn btn-danger" style="margin-top:0.5rem;" onclick="deleteArticle(${art.id})">🗑️ Usunąć</button>` : ''}
            </div>
        </div>
    `).join('');
}

function renderTiktoks() {
    const grid = document.getElementById('tiktok-grid');
    if (!grid) return;
    if (tiktoks.length === 0) { grid.innerHTML = '<p>Brak wideo.</p>'; return; }

    grid.innerHTML = tiktoks.map(tt => `
        <div class="card">
            <video class="card-media" controls src="${tt.url}"></video>
            <div class="card-body">
                <div class="card-title">${tt.title}</div>
                <div class="card-meta">📱 ${tt.author} | 📅 ${tt.date}</div>
                <div class="card-text">${tt.description || ''}</div>
                ${isAdmin ? `<button class="btn btn-danger" style="margin-top:0.5rem;" onclick="deleteTiktok(${tt.id})">🗑️ Usunąć</button>` : ''}
            </div>
        </div>
    `).join('');
}

function renderTeam() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;
    grid.innerHTML = teamMembers.map(m => `
        <div class="card" style="text-align:center; padding:1.5rem;">
            <img src="${m.photo || ''}" style="width:80px; height:80px; border-radius:50%; margin: 0 auto; object-fit:cover;">
            <h3 style="margin-top:0.5rem;">${m.name}</h3>
            <p style="color:var(--text-muted); font-size:0.85rem;">${m.role}</p>
            ${isBoss ? `<button class="btn btn-danger" style="margin-top:0.5rem; font-size:0.8rem;" onclick="deleteTeamMember(${m.id})">Usunąć</button>` : ''}
        </div>
    `).join('');
}

// Funkcje dodawania
async function createArticle(e) {
    e.preventDefault();
    if (!isAdmin) return alert('Brak uprawnień!');
    const author = document.getElementById('user-name').innerText || 'Admin';
    const date = new Date().toLocaleDateString('pl-PL');

    const { error } = await supabaseClient.from('articles').insert([{
        title: document.getElementById('art-title').value,
        tag: document.getElementById('art-tag').value,
        media_type: document.getElementById('art-media-type').value,
        media_url: document.getElementById('art-media-url').value,
        content: document.getElementById('art-content').value,
        target: 'home',
        author, date
    }]);

    if (error) alert('Błąd: ' + error.message);
    else { alert('Dodano artykuł!'); loadData(); e.target.reset(); }
}

async function createTiktok(e) {
    e.preventDefault();
    if (!isAdmin) return alert('Brak uprawnień!');
    const author = document.getElementById('user-name').innerText || 'Admin';
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

async function addTeamMember(e) {
    e.preventDefault();
    if (!isBoss) return alert('Brak uprawnień Szefa!');
    const { error } = await supabaseClient.from('team').insert([{
        name: document.getElementById('member-name').value,
        role: document.getElementById('member-role').value,
        photo: document.getElementById('member-photo').value
    }]);

    if (error) alert('Błąd: ' + error.message);
    else { alert('Dodano do kadry!'); loadData(); e.target.reset(); }
}

// Usuwanie
async function deleteArticle(id) {
    if (confirm('Usunąć wpis?')) {
        await supabaseClient.from('articles').delete().eq('id', id);
        loadData();
    }
}
async function deleteTiktok(id) {
    if (confirm('Usunąć TikTok?')) {
        await supabaseClient.from('tiktoks').delete().eq('id', id);
        loadData();
    }
}
async function deleteTeamMember(id) {
    if (confirm('Usunąć z kadry?')) {
        await supabaseClient.from('team').delete().eq('id', id);
        loadData();
    }
}

// Nawigacja i Modal
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('btn-tab-' + tab).classList.add('active');
}

function openModal(id) {
    const art = articles.find(a => a.id === id);
    if (!art) return;
    document.getElementById('m-title').innerText = art.title;
    document.getElementById('m-meta').innerText = `✍️ ${art.author} | 📅 ${art.date}`;
    document.getElementById('m-content').innerText = art.content;
    document.getElementById('m-media').innerHTML = art.media_type === 'video' 
        ? `<video style="width:100%; max-height:300px;" controls src="${art.media_url}"></video>` 
        : `<img style="width:100%; max-height:300px; object-fit:cover;" src="${art.media_url}">`;
    document.getElementById('modal-art').classList.add('active');
}

function closeModal(e) {
    if (!e || e.target.id === 'modal-art' || e.target.classList.contains('modal-close')) {
        document.getElementById('modal-art').classList.remove('active');
    }
}

// Start
checkUser();
