// ============ STATE ============
let currentSlug = null;
let currentChapter = null;
let currentChapterIndex = 0;
let chapterListData = [];

// ============ DOM ELEMENTS ============
const searchInput = document.getElementById('searchInput');
const loading = document.getElementById('loading');

const populerList = document.getElementById('populerList');
const terbaruList = document.getElementById('terbaruList');
const rekomendasiList = document.getElementById('rekomendasiList');
const searchList = document.getElementById('searchList');

const populerSection = document.getElementById('populerSection');
const terbaruSection = document.getElementById('terbaruSection');
const rekomendasiSection = document.getElementById('rekomendasiSection');
const searchSection = document.getElementById('searchSection');
const detailSection = document.getElementById('detailSection');
const readerSection = document.getElementById('readerSection');

const mangaDetail = document.getElementById('mangaDetail');
const chapterList = document.getElementById('chapterList');
const readerContainer = document.getElementById('readerContainer');
const chapterTitle = document.getElementById('chapterTitle');
const themeToggle = document.getElementById('themeToggle');
const backToHome = document.getElementById('backToHome');
const backToDetail = document.getElementById('backToDetail');

// ============ LOADING ============
function showLoading(show) {
    if (!loading) return;
    loading.classList.toggle('hidden', !show);
}

// ============ THEME ============
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// ============ DISPLAY COMICS ============
function displayComics(container, comics) {
    if (!container) return;
    
    if (!comics || comics.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-secondary);">
                <i class="fas fa-frown fa-2x"></i>
                <p>Tidak ada komik</p>
            </div>
        `;
        return;
    }

    container.innerHTML = comics.slice(0, 20).map((comic, index) => {
        let slug = '';
        if (comic.link) {
            const match = comic.link.match(/\/manga\/([^\/]+)\/?/);
            if (match) {
                slug = match[1];
            } else {
                const parts = comic.link.split('/');
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (parts[i] && !parts[i].includes('http') && !parts[i].includes('manga')) {
                        slug = parts[i];
                        break;
                    }
                }
            }
        }
        if (!slug) {
            slug = comic.slug || comic.endpoint || comic.id || `komik-${index}`;
        }
        
        let thumb = comic.image || comic.thumb || comic.gambar || comic.cover || comic.img || '';
        if (!thumb && typeof comic === 'object') {
            for (const key of Object.keys(comic)) {
                const val = comic[key];
                if (typeof val === 'string' && 
                    (val.includes('jpg') || val.includes('png') || val.includes('jpeg') || 
                     val.includes('webp') || val.includes('komiku') || val.includes('thumbnail'))) {
                    thumb = val;
                    break;
                }
            }
        }
        
        const title = comic.title || comic.judul || 'No Title';
        const chapter = comic.chapter || comic.chapter_terbaru || '';
        const genre = comic.genre || comic.genre_list || [];
        const genreText = Array.isArray(genre) ? genre.slice(0, 2).join(' • ') : genre || 'Komik';
        const status = comic.status || comic.type || '';

        return `
            <div class="comic-card" onclick="getMangaDetail('${slug}')">
                <div class="img-wrapper">
                    <img src="${thumb ? `/proxy-image?url=${encodeURIComponent(thumb)}` : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22200%22 height=%22280%22 fill=%22%2316213e%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23e94560%22 font-size=%2220%22%3ENo%20Cover%3C/text%3E%3C/svg%3E'}" 
                         alt="${title}"
                         loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22200%22 height=%22280%22 fill=%22%2316213e%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23e94560%22 font-size=%2220%22%3ENo%20Cover%3C/text%3E%3C/svg%3E'">
                    ${chapter ? `<span class="chapter-badge">${chapter}</span>` : ''}
                </div>
                <div class="info">
                    <h3>${title}</h3>
                    <div class="genre">${genreText}</div>
                    <div class="status">${status}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============ LOAD ALL DATA ============
async function loadAllData() {
    showLoading(true);
    
    try {
        const popRes = await fetch('/api/populer?limit=20');
        const popData = await popRes.json();
        displayComics(populerList, popData.comics || popData.data || []);
        
        const terRes = await fetch('/api/terbaru?limit=20');
        const terData = await terRes.json();
        displayComics(terbaruList, terData.comics || terData.data || []);
        
        const rekRes = await fetch('/api/rekomendasi?limit=20');
        const rekData = await rekRes.json();
        displayComics(rekomendasiList, rekData.comics || rekData.data || rekData.recommendations || []);
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
    } finally {
        showLoading(false);
    }
}

// ============ SEARCH ============
let searchTimeout;

searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (query === '') {
        populerSection.classList.remove('hidden');
        terbaruSection.classList.remove('hidden');
        rekomendasiSection.classList.remove('hidden');
        searchSection.classList.add('hidden');
        return;
    }
    
    populerSection.classList.add('hidden');
    terbaruSection.classList.add('hidden');
    rekomendasiSection.classList.add('hidden');
    searchSection.classList.remove('hidden');
    
    searchTimeout = setTimeout(() => {
        searchComics(query);
    }, 500);
});

async function searchComics(query) {
    showLoading(true);
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await response.json();
        displayComics(searchList, data.comics || data.data || []);
    } catch (error) {
        console.error('Error:', error);
        searchList.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-secondary);">
                <i class="fas fa-exclamation-circle fa-2x"></i>
                <p>Gagal mencari</p>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}

// ============ MANGA DETAIL ============
function displayMangaDetail(data) {
    const manga = data.data || data;
    console.log('📖 Manga:', manga);
    
    const title = manga.title || manga.judul || 'No Title';
    const thumb = manga.thumb || manga.gambar || manga.cover || manga.image || '';
    const description = manga.desc || manga.deskripsi || manga.sinopsis || 'Deskripsi tidak tersedia.';
    const genre = manga.genre || manga.genre_list || manga.tags || [];
    const genreText = Array.isArray(genre) ? genre.join(' • ') : genre;
    const status = manga.status || manga.type || 'Ongoing';
    const author = manga.author || manga.penulis || 'Unknown';
    const chapters = manga.chapter_list || manga.daftar_chapter || manga.chapters || manga.list_chapter || [];
    
    // ============ URUTKAN CHAPTER DARI 1 ============
    chapters.sort((a, b) => {
        const numA = parseFloat(a.chapter) || 0;
        const numB = parseFloat(b.chapter) || 0;
        return numA - numB;
    });
    
    chapterListData = chapters.map((ch, index) => {
        const chapterNum = ch.chapter || ch.num || ch.number || ch.no || (index + 1);
        const chapterTitle = ch.title || ch.judul || `Chapter ${chapterNum}`;
        const chapterSegment = ch.segment || ch.slug || ch.endpoint || ch.link || chapterNum;
        return {
            ...ch,
            chapter: chapterNum,
            title: chapterTitle,
            segment: chapterSegment
        };
    });
    
    mangaDetail.innerHTML = `
        <div class="cover">
            <img src="${thumb ? `/proxy-image?url=${encodeURIComponent(thumb)}` : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22200%22 height=%22280%22 fill=%22%2316213e%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23e94560%22 font-size=%2220%22%3ENo%20Cover%3C/text%3E%3C/svg%3E'}" 
                 alt="${title}"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22200%22 height=%22280%22 fill=%22%2316213e%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23e94560%22 font-size=%2220%22%3ENo%20Cover%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="info">
            <h2>${title}</h2>
            <div class="meta">
                <span><i class="fas fa-user"></i> ${author}</span>
                <span><i class="fas fa-tag"></i> ${status}</span>
                ${manga.rating ? `<span><i class="fas fa-star"></i> ${manga.rating}</span>` : ''}
            </div>
            <div class="tags">
                ${Array.isArray(genre) ? genre.map(g => `<span>${g}</span>`).join('') : `<span>${genreText}</span>`}
            </div>
            <div class="description">${description}</div>
        </div>
    `;
    
    if (chapters && chapters.length > 0) {
        chapterList.innerHTML = `
            <h3>Daftar Chapter (${chapters.length})</h3>
            ${chapters.map((ch, index) => {
                const chapterNum = ch.chapter || ch.num || ch.number || ch.no || (index + 1);
                const chapterTitle = ch.title || ch.judul || `Chapter ${chapterNum}`;
                const chapterSegment = ch.segment || ch.slug || ch.endpoint || ch.link || chapterNum;
                const chapterDate = ch.date || ch.tanggal || ch.waktu || '';
                
                return `
                    <div class="chapter-item" onclick="readChapter('${chapterSegment}', '${chapterTitle}', ${index})">
                        <span class="chapter-num">Chapter ${chapterNum}</span>
                        <span class="chapter-title">${chapterTitle}</span>
                        ${chapterDate ? `<span class="chapter-date">${chapterDate}</span>` : ''}
                    </div>
                `;
            }).join('')}
        `;
    } else {
        chapterList.innerHTML = '<p>Tidak ada chapter</p>';
    }
    
    // ============ SETUP SEARCH CHAPTER ============
    setTimeout(setupChapterSearch, 100);
}

// ============ SEARCH CHAPTER ============
function setupChapterSearch() {
    const searchInput = document.getElementById('chapterSearchInput');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        searchTimeout = setTimeout(() => {
            filterChapters(query);
        }, 300);
    });
}

function filterChapters(query) {
    const chapterItems = document.querySelectorAll('.chapter-item');
    if (!chapterItems.length) return;
    
    // Reset semua
    chapterItems.forEach(item => item.style.display = '');
    
    // Hapus pesan no-result lama
    const existingMsg = document.querySelector('.chapter-search-no-result');
    if (existingMsg) existingMsg.remove();
    
    // Jika query kosong, tampilkan semua
    if (!query || query.trim() === '') return;
    
    const searchTerm = query.trim().toLowerCase();
    let found = 0;
    
    chapterItems.forEach(item => {
        const numElement = item.querySelector('.chapter-num');
        if (!numElement) return;
        
        // Ambil angka chapter (contoh: "Chapter 120" -> "120")
        const chapterText = numElement.textContent.toLowerCase();
        const chapterNum = chapterText.replace('chapter', '').trim();
        
        let show = false;
        
        // ============ FORMAT PENCARIAN ============
        // 1. Angka spesifik: "120" -> cocok dengan chapter 120
        if (/^\d+$/.test(searchTerm)) {
            show = chapterNum === searchTerm;
        }
        // 2. Range: "120-130" -> cocok chapter 120-130
        else if (/^\d+\s*-\s*\d+$/.test(searchTerm)) {
            const [start, end] = searchTerm.split('-').map(n => parseInt(n.trim()));
            const num = parseInt(chapterNum);
            show = num >= start && num <= end;
        }
        // 3. Keatas: "150+" -> cocok chapter 150 keatas
        else if (/^\d+\s*\+$/.test(searchTerm)) {
            const min = parseInt(searchTerm.replace('+', '').trim());
            const num = parseInt(chapterNum);
            show = num >= min;
        }
        // 4. Kebawah: "<50" -> cocok chapter 1-49
        else if (/^<\s*\d+$/.test(searchTerm)) {
            const max = parseInt(searchTerm.replace('<', '').trim());
            const num = parseInt(chapterNum);
            show = num <= max;
        }
        // 5. Cari di title atau angka (fallback)
        else {
            // Cari di nomor chapter
            show = chapterNum.includes(searchTerm);
            // Atau cari di title
            if (!show) {
                const titleElement = item.querySelector('.chapter-title');
                if (titleElement) {
                    show = titleElement.textContent.toLowerCase().includes(searchTerm);
                }
            }
        }
        
        if (show) {
            found++;
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
    
    // Tampilkan pesan jika tidak ada yang ditemukan
    if (found === 0) {
        const msg = document.createElement('div');
        msg.className = 'chapter-search-no-result';
        msg.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <p>Tidak ada chapter yang cocok dengan: <strong>${searchTerm}</strong></p>
            <p style="font-size:0.8rem;margin-top:0.3rem;">Coba: 120, 120-130, 150+, atau <50</p>
        `;
        const chapterList = document.getElementById('chapterList');
        chapterList.appendChild(msg);
    }
}

window.getMangaDetail = async (slug) => {
    if (!slug) {
        alert('Slug tidak valid!');
        return;
    }
    
    console.log(`🔍 Mencoba slug: ${slug}`);
    currentSlug = slug;
    showLoading(true);
    
    populerSection.classList.add('hidden');
    terbaruSection.classList.add('hidden');
    rekomendasiSection.classList.add('hidden');
    searchSection.classList.add('hidden');
    detailSection.classList.remove('hidden');
    readerSection.classList.add('hidden');
    
    try {
        const response = await fetch(`/api/detail/${slug}`);
        const data = await response.json();
        console.log('📖 Detail response:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal memuat detail');
        }
        
        if (!data || Object.keys(data).length === 0) {
            throw new Error('Data komik tidak ditemukan');
        }
        
        displayMangaDetail(data);
    } catch (error) {
        console.error('❌ Error:', error);
        mangaDetail.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--text-secondary);">
                <i class="fas fa-exclamation-triangle fa-3x" style="color:var(--accent);margin-bottom:1rem;display:block;"></i>
                <h3 style="color:var(--text-primary);">Gagal Memuat Detail</h3>
                <p>${error.message}</p>
                <p style="font-size:0.8rem;margin-top:0.5rem;word-break:break-all;">Slug: ${slug}</p>
                <div style="margin-top:1.5rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                    <button onclick="getMangaDetail('${slug}')" style="padding:0.6rem 2rem;background:var(--accent);border:none;color:white;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-redo"></i> Coba Lagi
                    </button>
                    <button onclick="backToHomepage()" style="padding:0.6rem 2rem;background:var(--bg-card);border:none;color:var(--text-primary);border-radius:20px;cursor:pointer;">
                        Kembali
                    </button>
                </div>
            </div>
        `;
        chapterList.innerHTML = '';
    } finally {
        showLoading(false);
    }
};

// ============ READ CHAPTER ============
window.readChapter = async (segment, title, chapterIndex = 0) => {
    if (!segment) {
        alert('Segment chapter tidak valid!');
        return;
    }
    
    currentChapter = segment;
    currentChapterIndex = chapterIndex;
    
    showLoading(true);
    detailSection.classList.add('hidden');
    readerSection.classList.remove('hidden');
    
    readerContainer.innerHTML = `
        <div style="text-align:center;padding:4rem;">
            <div class="spinner" style="margin:0 auto;"></div>
            <p style="margin-top:1rem;color:var(--text-secondary);">Memuat chapter...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/chapter/${segment}`);
        const data = await response.json();
        console.log('📖 Chapter response:', data);
        
        let images = data.images || data.data || data.img || data.gambar || [];
        if (!Array.isArray(images)) images = [images];
        images = images.filter(img => typeof img === 'string' && img.trim());
        
        images = images.map(img => {
            let url = img.trim();
            if (url.startsWith('//')) url = 'https:' + url;
            if (!url.startsWith('http')) url = 'https://' + url;
            return url;
        });
        
        console.log(`🖼️ Total images: ${images.length}`);
        if (images.length === 0) {
            throw new Error('Tidak ada gambar untuk chapter ini');
        }
        
        displayChapter(images);
        updateChapterNavigation();
        
        const currentChapterNum = chapterListData[chapterIndex]?.chapter || '?';
        const totalChapters = chapterListData.length;
        chapterTitle.textContent = `Chapter ${currentChapterNum} / ${totalChapters}`;
        
    } catch (error) {
        console.error('Error:', error);
        readerContainer.innerHTML = `
            <div style="text-align:center;padding:3rem;">
                <i class="fas fa-exclamation-circle fa-3x" style="color:var(--accent);margin-bottom:1rem;display:block;"></i>
                <p>${error.message}</p>
                <div style="margin-top:1.5rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                    <button onclick="retryChapter()" style="padding:0.6rem 2rem;background:var(--accent);border:none;color:white;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-redo"></i> Coba Lagi
                    </button>
                    <button onclick="backToDetailPage()" style="padding:0.6rem 2rem;background:var(--bg-card);border:none;color:var(--text-primary);border-radius:20px;cursor:pointer;">
                        Kembali
                    </button>
                </div>
            </div>
        `;
    } finally {
        showLoading(false);
    }
};

function displayChapter(images) {
    console.log(`🖼️ Menampilkan ${images.length} gambar`);
    
    readerContainer.innerHTML = images.map((img, index) => `
        <div class="page-wrapper">
            <img src="/proxy-image?url=${encodeURIComponent(img)}" 
                 alt="Halaman ${index + 1}" 
                 loading="lazy"
                 onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'text-align:center;padding:2rem;background:var(--bg-card);border-radius:8px;color:var(--text-secondary);\\'><i class=\\'fas fa-image\\' style=\\'font-size:2rem;display:block;margin-bottom:0.5rem;\\'></i><p>Gambar ${index + 1} gagal</p></div>'">
        </div>
    `).join('');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ NAVIGASI CHAPTER ============
function updateChapterNavigation() {
    const totalChapters = chapterListData.length;
    
    let currentIndex = -1;
    for (let i = 0; i < chapterListData.length; i++) {
        if (chapterListData[i].segment === currentChapter) {
            currentIndex = i;
            break;
        }
    }
    
    if (currentIndex !== -1) {
        currentChapterIndex = currentIndex;
    }
    
    const navInfo = document.getElementById('chapterNavInfo');
    const navInfoBottom = document.getElementById('chapterNavInfoBottom');
    const prevBtn = document.getElementById('prevChapterBtn');
    const nextBtn = document.getElementById('nextChapterBtn');
    const prevBtnBottom = document.getElementById('prevChapterBtnBottom');
    const nextBtnBottom = document.getElementById('nextChapterBtnBottom');
    
    const currentChapterNum = chapterListData[currentChapterIndex]?.chapter || '?';
    const totalDisplay = chapterListData.length;
    const infoText = `Chapter ${currentChapterNum} / ${totalDisplay}`;
    
    if (navInfo) navInfo.textContent = infoText;
    if (navInfoBottom) navInfoBottom.textContent = infoText;
    
    if (prevBtn) prevBtn.disabled = currentChapterIndex <= 0;
    if (prevBtnBottom) prevBtnBottom.disabled = currentChapterIndex <= 0;
    
    if (nextBtn) nextBtn.disabled = currentChapterIndex >= totalChapters - 1;
    if (nextBtnBottom) nextBtnBottom.disabled = currentChapterIndex >= totalChapters - 1;
    
    console.log(`📍 Chapter ${currentChapterNum} (posisi ${currentChapterIndex + 1}/${totalChapters})`);
}

// ============ FUNGSI NAVIGASI ============
function goToPrevChapter() {
    let currentIndex = -1;
    for (let i = 0; i < chapterListData.length; i++) {
        if (chapterListData[i].segment === currentChapter) {
            currentIndex = i;
            break;
        }
    }
    
    if (currentIndex === -1) return;
    
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
        const prev = chapterListData[prevIndex];
        console.log(`⬅️ PREV: Chapter ${prev.chapter}`);
        readChapter(prev.segment || prev.slug || prev.link, prev.title || `Chapter ${prev.chapter}`, prevIndex);
    }
}

function goToNextChapter() {
    let currentIndex = -1;
    for (let i = 0; i < chapterListData.length; i++) {
        if (chapterListData[i].segment === currentChapter) {
            currentIndex = i;
            break;
        }
    }
    
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < chapterListData.length) {
        const next = chapterListData[nextIndex];
        console.log(`➡️ NEXT: Chapter ${next.chapter}`);
        readChapter(next.segment || next.slug || next.link, next.title || `Chapter ${next.chapter}`, nextIndex);
    }
}

// ============ RETRY CHAPTER ============
window.retryChapter = function() {
    if (currentChapter) {
        readChapter(currentChapter, chapterTitle.textContent, currentChapterIndex);
    }
};

// ============ EVENT LISTENER NAVIGASI ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔗 Setting up navigation...');
    
    const prevBtn1 = document.getElementById('nextChapterBtn');
    const prevBtn2 = document.getElementById('nextChapterBtnBottom');
    const nextBtn1 = document.getElementById('prevChapterBtn');
    const nextBtn2 = document.getElementById('prevChapterBtnBottom');
    
    if (prevBtn1) {
        prevBtn1.addEventListener('click', goToPrevChapter);
        console.log('✅ prevChapterBtn -> goToPrevChapter');
    }
    if (prevBtn2) {
        prevBtn2.addEventListener('click', goToPrevChapter);
        console.log('✅ prevChapterBtnBottom -> goToPrevChapter');
    }
    
    if (nextBtn1) {
        nextBtn1.addEventListener('click', goToNextChapter);
        console.log('✅ nextChapterBtn -> goToNextChapter');
    }
    if (nextBtn2) {
        nextBtn2.addEventListener('click', goToNextChapter);
        console.log('✅ nextChapterBtnBottom -> goToNextChapter');
    }
});

// ============ NAVIGATION ============
function backToHomepage() {
    populerSection.classList.remove('hidden');
    terbaruSection.classList.remove('hidden');
    rekomendasiSection.classList.remove('hidden');
    searchSection.classList.add('hidden');
    detailSection.classList.add('hidden');
    readerSection.classList.add('hidden');
    searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToDetailPage() {
    detailSection.classList.remove('hidden');
    readerSection.classList.add('hidden');
    if (currentSlug) {
        getMangaDetail(currentSlug);
    }
}

backToHome.addEventListener('click', backToHomepage);
backToDetail.addEventListener('click', backToDetailPage);

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!readerSection.classList.contains('hidden')) {
            backToDetailPage();
        } else if (!detailSection.classList.contains('hidden')) {
            backToHomepage();
        }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        searchInput.focus();
    }
    
    if (!readerSection.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPrevChapter();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToNextChapter();
        }
    }
});

// ============ INIT ============
loadAllData();
console.log('📚 Komikan siap!');
console.log('💡 Tips: Ctrl+/ untuk search, Esc untuk kembali');
console.log('📖 Tips: Panah kiri/kanan untuk ganti chapter');