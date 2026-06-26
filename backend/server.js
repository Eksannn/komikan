const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ KONFIGURASI ============
const BASE_URL = 'https://www.sankavollerei.web.id/comic';

// ============ RATE LIMIT ============
let requestCount = 0;
let windowStart = Date.now();
const MAX_REQUESTS = 40;
const WINDOW_MS = 60000;

function checkRateLimit() {
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
        requestCount = 0;
        windowStart = now;
    }
    if (requestCount >= MAX_REQUESTS) {
        throw new Error('Rate limit exceeded. Tunggu sebentar.');
    }
    requestCount++;
    console.log(`📊 Request ${requestCount}/${MAX_REQUESTS}`);
}

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ============ CACHE ============
const cache = {};
const CACHE_DURATION = 120000;

function getCache(key) {
    if (cache[key] && Date.now() - cache[key].timestamp < CACHE_DURATION) {
        console.log(`✅ Cache hit: ${key}`);
        return cache[key].data;
    }
    return null;
}

function setCache(key, data) {
    cache[key] = { data, timestamp: Date.now() };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ API CALL ============
async function apiCall(endpoint, params = {}, retries = 3) {
    checkRateLimit();
    
    let cleanEndpoint = endpoint;
    if (!cleanEndpoint.startsWith('/')) {
        cleanEndpoint = '/' + cleanEndpoint;
    }
    
    const url = `${BASE_URL}${cleanEndpoint}`;
    console.log(`🌐 Calling: ${url}`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                params: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 30000,
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            });
            
            if (response.status === 429) {
                console.log('⚠️ Rate limit dari server!');
                await sleep(2000);
                continue;
            }
            
            if (response.status >= 400) {
                console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
                throw new Error(`HTTP ${response.status}`);
            }
            
            return response.data;
            
        } catch (error) {
            console.log(`❌ Attempt ${attempt}/${retries} failed: ${error.message}`);
            if (attempt < retries) {
                await sleep(attempt * 2000);
            } else {
                throw error;
            }
        }
    }
}

// ============ NORMALISASI RESPONSE ============
function normalizeResponse(data) {
    if (Array.isArray(data)) return data;
    if (data && data.comics && Array.isArray(data.comics)) return data.comics;
    if (data && data.data && Array.isArray(data.data)) return data.data;
    if (data && data.results && Array.isArray(data.results)) return data.results;
    if (data && data.items && Array.isArray(data.items)) return data.items;
    if (data && data.recommendations && Array.isArray(data.recommendations)) return data.recommendations;
    
    if (data && typeof data === 'object') {
        for (const key of Object.keys(data)) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return data[key];
            }
        }
    }
    
    console.warn('⚠️ Tidak bisa normalisasi data:', Object.keys(data || {}));
    return [];
}

// ============ PROXY GAMBAR ============
app.get('/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).json({ error: 'URL gambar diperlukan' });
    }

    console.log(`🌅 Proxy: ${imageUrl.substring(0, 80)}...`);

    try {
        const response = await axios.get(imageUrl, {
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://komiku.org/',
                'Origin': 'https://komiku.org',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 60000,
            maxRedirects: 5
        });
        
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
        
    } catch (error) {
        console.error('❌ Proxy error:', error.message);
        res.status(500).send(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200">
                <rect width="800" height="1200" fill="#16213e"/>
                <text x="400" y="600" text-anchor="middle" fill="#e94560" font-size="24">Gagal Memuat Gambar</text>
                <text x="400" y="640" text-anchor="middle" fill="#666" font-size="16">${error.message.substring(0, 50)}</text>
            </svg>
        `);
    }
});

// ============ ENDPOINTS ============

// 1. Populer
app.get('/api/populer', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const cacheKey = `populer_${page}_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        const rawData = await apiCall('/populer', { page, limit });
        const data = normalizeResponse(rawData);
        const result = { comics: data, pagination: rawData.pagination || {} };
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('❌ Populer error:', error.message);
        res.json({ comics: [] });
    }
});

// 2. Terbaru
app.get('/api/terbaru', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const cacheKey = `terbaru_${page}_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        const rawData = await apiCall('/terbaru', { page, limit });
        const data = normalizeResponse(rawData);
        const result = { comics: data, pagination: rawData.pagination || {} };
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('❌ Terbaru error:', error.message);
        res.json({ comics: [] });
    }
});

// 3. Rekomendasi
app.get('/api/rekomendasi', async (req, res) => {
    const { limit = 20 } = req.query;
    const cacheKey = `rekomendasi_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        const rawData = await apiCall('/recommendations', { limit });
        const data = normalizeResponse(rawData);
        const result = { comics: data };
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('❌ Rekomendasi error:', error.message);
        res.json({ comics: [] });
    }
});

// 4. Search
app.get('/api/search', async (req, res) => {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || q.trim() === '') {
        return res.json({ comics: [] });
    }
    
    const cacheKey = `search_${q.trim()}_${page}_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        const rawData = await apiCall('/search', { q: q.trim(), page, limit });
        const data = normalizeResponse(rawData);
        const result = { comics: data, pagination: rawData.pagination || {} };
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('❌ Search error:', error.message);
        res.json({ comics: [] });
    }
});

// 5. Detail Komik
app.get('/api/detail/:slug', async (req, res) => {
    const { slug } = req.params;
    if (!slug) {
        return res.status(400).json({ error: 'Slug diperlukan' });
    }
    
    console.log(`📖 Detail: ${slug}`);
    const cacheKey = `detail_${slug}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        let data = null;
        let error = null;
        
        try {
            data = await apiCall(`/comic/${slug}`, {}, 2);
            if (data && (data.title || data.judul || data.data)) {
                console.log(`✅ Detail berhasil: /comic/${slug}`);
            } else {
                data = null;
            }
        } catch (e) {
            error = e;
        }
        
        if (!data) {
            try {
                data = await apiCall(`/comic/comic/${slug}`, {}, 2);
                if (data && (data.title || data.judul || data.data)) {
                    console.log(`✅ Detail berhasil: /comic/comic/${slug}`);
                } else {
                    data = null;
                }
            } catch (e) {
                error = e;
            }
        }
        
        if (!data) {
            throw new Error(error?.message || 'Data tidak ditemukan');
        }
        
        setCache(cacheKey, data);
        res.json(data);
        
    } catch (error) {
        console.error(`❌ Detail error for ${slug}:`, error.message);
        res.status(500).json({ 
            error: error.message,
            message: 'Gagal memuat detail komik',
            slug: slug
        });
    }
});

// 6. Baca Chapter
app.get('/api/chapter/:slug', async (req, res) => {
    const { slug } = req.params;
    if (!slug) {
        return res.status(400).json({ error: 'Slug diperlukan' });
    }
    
    console.log(`📖 Chapter: ${slug}`);
    const cacheKey = `chapter_${slug}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    try {
        const data = await apiCall(`/chapter/${slug}`, {}, 3);
        console.log(`✅ Chapter berhasil: ${slug}`);
        
        let images = [];
        if (data.images && Array.isArray(data.images)) {
            images = data.images;
        } else if (data.data && Array.isArray(data.data)) {
            images = data.data;
        } else if (data.img && Array.isArray(data.img)) {
            images = data.img;
        } else if (data.gambar && Array.isArray(data.gambar)) {
            images = data.gambar;
        } else if (Array.isArray(data)) {
            images = data;
        }
        
        images = images.filter(img => typeof img === 'string' && img.trim()).map(img => {
            let url = img.trim();
            if (url.startsWith('//')) url = 'https:' + url;
            if (!url.startsWith('http')) url = 'https://' + url;
            return url;
        });
        
        console.log(`🖼️ Total gambar: ${images.length}`);
        if (images.length > 0) {
            console.log(`📸 Contoh URL: ${images[0].substring(0, 80)}...`);
        }
        
        const result = { images: images };
        setCache(cacheKey, result);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Chapter error for ${slug}:`, error.message);
        res.status(500).json({ 
            error: error.message,
            images: [],
            message: 'Gagal memuat chapter'
        });
    }
});

// 7. Status
app.get('/api/status', (req, res) => {
    const now = Date.now();
    const resetIn = Math.max(0, WINDOW_MS - (now - windowStart));
    res.json({
        requestsUsed: requestCount,
        requestsRemaining: MAX_REQUESTS - requestCount,
        maxRequests: MAX_REQUESTS,
        resetInSeconds: Math.ceil(resetIn / 1000),
        cacheSize: Object.keys(cache).length
    });
});

// ============ MAIN ROUTE ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============ EXPORT UNTUK VERCEL ============
module.exports = app;

// ============ START SERVER (LOKAL) ============
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Komikan running at http://localhost:${PORT}`);
        console.log(`📚 Base URL: ${BASE_URL}`);
        console.log(`⚡ Rate Limit: ${MAX_REQUESTS}/menit`);
        console.log(`💾 Cache: ${CACHE_DURATION/1000} detik`);
    });
}