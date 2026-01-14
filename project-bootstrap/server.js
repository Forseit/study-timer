const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const svgCaptcha = require('svg-captcha');
const helmet = require('helmet');
const i18n = require('i18n');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');

// === НАСТРОЙКИ (ВСТАВЬ СВОИ) ===
const SUPABASE_URL = 'https://glqfmrfyvsuohbtzdpny.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscWZtcmZ5dnN1b2hidHpkcG55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5MzMwMCwiZXhwIjoyMDgzOTY5MzAwfQ.9zfqnhi0jHgUyhSk_-BiFMcq-ACLIRuDPjM2E8W2dCU'; // Service Role (Secret)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
const PORT = 3000;
const ENABLE_CAPTCHA = false;

// === СЖАТИЕ ===
app.use(compression());

// === ФАЙЛЫ ===
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const p = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        cb(null, p);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

app.set('trust proxy', 1);

// === БЕЗОПАСНОСТЬ ===
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://*.vk.com", "https://vk.com", "https://id.vk.ru", "https://*.vk.ru", "https://cdn.plyr.io"], // Добавили CDN Plyr
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.plyr.io"], // Добавили CDN Plyr
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://*.vk.com", "*"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://*.vk.com", "https://vk.com", "https://id.vk.ru", "https://*.vk.ru", "https://login.vk.com", SUPABASE_URL],
            frameSrc: ["'self'", "https://*.vk.com", "https://vk.com", "https://id.vk.ru", "https://*.vk.ru"],
            upgradeInsecureRequests: [], 
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, 
}));

i18n.configure({ locales: ['ru', 'en'], directory: path.join(__dirname, 'locales'), defaultLocale: 'ru', cookie: 'lang', updateFiles: false, objectNotation: true });
app.use(cookieParser());
app.use(i18n.init);
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.set('view engine', 'ejs');

app.use(session({
    name: 'ruhub_sid',
    secret: 'ruhub_pro_v2026',
    resave: false, saveUninitialized: true,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, secure: false, sameSite: 'lax' }
}));

// ================= РОУТЫ =================

// 1. ГЛАВНАЯ
app.get('/', async (req, res) => {
    const status = req.session.authStatus || 'guest';
    let videos = [];
    if (status === 'allowed') {
        const { data } = await supabase
            .from('videos')
            .select('title, preview_url, category, slug, views, created_at')
            .order('created_at', { ascending: false });
        videos = data || [];
    }
    res.render('pages/index', { status, user: req.session.userData, videos, enableCaptcha: ENABLE_CAPTCHA, currentPage: 'home' });
});

// 2. РАЗДЕЛЫ
app.get('/section/:category', async (req, res) => {
    if ((req.session.authStatus || 'guest') !== 'allowed') return res.redirect('/');
    const { data } = await supabase
        .from('videos')
        .select('title, preview_url, category, slug, views, created_at')
        .ilike('category', req.params.category)
        .order('created_at', { ascending: false });
    res.render('pages/index', { status: 'allowed', user: req.session.userData, videos: data || [], enableCaptcha: ENABLE_CAPTCHA, currentPage: req.params.category });
});

// 3. ВИДЕО
app.get('/video/:slug', async (req, res) => {
    if ((req.session.authStatus || 'guest') !== 'allowed') return res.redirect('/');
    const { data } = await supabase.from('videos').select('*').eq('slug', req.params.slug).single();
    if (!data) return res.status(404).send('Видео не найдено');
    supabase.from('videos').update({ views: (data.views || 0) + 1 }).eq('id', data.id).then(() => {});
    res.render('pages/video', { user: req.session.userData, video: data });
});

// 4. ЗАГРУЗКА
app.get('/upload', (req, res) => {
    if ((req.session.authStatus || 'guest') !== 'allowed') return res.redirect('/');
    res.render('pages/upload', { user: req.session.userData });
});
app.post('/api/upload', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'previewFile', maxCount: 1 }]), async (req, res) => {
    if ((req.session.authStatus || 'guest') !== 'allowed') return res.status(403).send('Forbidden');
    try {
        const { title, description, category, tags } = req.body;
        const vFile = req.files['videoFile'] ? req.files['videoFile'][0] : null;
        const pFile = req.files['previewFile'] ? req.files['previewFile'][0] : null;
        if (!vFile || !title) return res.send('Ошибка данных');

        const { error } = await supabase.from('videos').insert({
            title, description, category, tags,
            video_url: '/uploads/' + vFile.filename,
            preview_url: pFile ? '/uploads/' + pFile.filename : 'https://vk.com/images/camera_200.png',
            slug: Math.random().toString(36).substring(2, 10) + '-' + Date.now(),
            views: 0
        });
        if (error) throw error;
        res.redirect('/');
    } catch (e) { res.send('Ошибка: ' + e.message); }
});

// 5. ЮРИДИЧЕСКИЕ СТРАНИЦЫ (НОВОЕ)
app.get('/privacy', (req, res) => {
    res.render('pages/privacy', { 
        user: req.session.userData || null, 
        status: req.session.authStatus || 'guest' 
    });
});

app.get('/terms', (req, res) => {
    res.render('pages/terms', { 
        user: req.session.userData || null, 
        status: req.session.authStatus || 'guest' 
    });
});

// 6. AUTH API
app.post('/api/login', async (req, res) => {
    const { token, userId } = req.body;
    try {
        const r = await axios.get(`https://api.vk.com/method/users.get`, { params: { users_ids: userId, fields: 'bdate,photo_200', access_token: token, v: '5.131' } });
        if (r.data.error) return res.json({ success: false });
        const u = r.data.response[0];
        const check = checkAge(u.bdate);
        if (check.allowed) {
            req.session.authStatus = 'allowed';
            req.session.userId = userId;
            req.session.userData = { id: userId, firstName: u.first_name, lastName: u.last_name, photo: u.photo_200 };
            supabase.from('users').upsert({ id: userId, first_name: u.first_name, last_name: u.last_name, photo_url: u.photo_200 }).then(() => {});
        }
        req.session.save(() => res.json({ success: check.allowed, reason: check.reason }));
    } catch (e) { res.json({ success: false }); }
});
app.post('/api/logout', (req, res) => { req.session.destroy(() => res.json({ success: true })); });
app.get('/api/captcha', (req, res) => { if(!ENABLE_CAPTCHA) return res.status(404).send('off'); const c = svgCaptcha.create({size:5, background:'#222'}); req.session.captcha = c.text; res.type('svg').send(c.data); });
app.post('/api/verify-captcha', (req, res) => { res.json({ success: true }); });

function checkAge(bdate) {
    if (!bdate || bdate.split('.').length < 3) return { allowed: false };
    return (new Date().getFullYear() - parseInt(bdate.split('.')[2])) >= 18 ? { allowed: true } : { allowed: false, reason: '18+' };
}

app.listen(PORT, () => console.log(`🚀 RuHub Pro started on ${PORT}`));