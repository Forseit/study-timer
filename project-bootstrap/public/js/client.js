// public/js/client.js

// === 1. КОНФИГУРАЦИЯ ===
const APP_CONFIG = {
    app: 54421613,
    // !!! ВСТАВЬ СЮДА СВОЮ ССЫЛКУ (без слэша в конце) !!!
    redirectUrl: 'https://yrodskoe-nazv-v-vanie-dlya21939-testa.loca.lt', 
};

document.addEventListener("DOMContentLoaded", () => {
    initUI();   // Запускаем логику интерфейса (меню, профиль)
    initAuth(); // Запускаем логику входа (VK)
});

// ==========================================
// === UI ЛОГИКА (Работает везде) ===
// ==========================================
function initUI() {
    // --- 1. САЙДБАР (Меню слева) ---
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');

    // Функция открытия/закрытия
    function toggleSidebar() {
        if (!sidebar || !overlay) return;
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }

    // Клик по бургеру
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Чтобы клик не ушел дальше
            toggleSidebar();
        });
    }

    // Клик по затемнению (чтобы закрыть)
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // --- 2. ПРОФИЛЬ (Выпадающее меню) ---
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Важно!
            dropdown.classList.toggle('show');
        });

        // Закрываем меню, если кликнули в любое другое место
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    // --- 3. ВЫХОД (Logout) ---
    // Ищем кнопку по ID (везде) или по классу (внутри дропдаунов)
    const logoutBtns = document.querySelectorAll('#logout-btn, .logout-btn');
    
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('/api/logout', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) window.location.reload();
                })
                .catch(err => console.error('Logout error:', err));
        });
    });
}

// ==========================================
// === AUTH ЛОГИКА (Только для страницы входа) ===
// ==========================================
function initAuth() {
    // 1. Проверяем код в URL (возврат от ВК)
    if (checkUrlForCode()) return;

    // 2. Рисуем кнопку, если мы на странице входа
    const vkContainer = document.getElementById('vk-button-container');
    if (vkContainer) {
        renderVKButton(vkContainer);
    }
}

function checkUrlForCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const deviceId = params.get('device_id');

    if (code && deviceId && window.VKIDSDK) {
        // Показываем лоадер, если он есть
        const loader = document.getElementById('loader');
        const container = document.getElementById('vk-button-container');
        if(loader) loader.classList.remove('hidden');
        if(container) container.classList.add('hidden');

        const VKID = window.VKIDSDK;
        VKID.Config.init({
            app: APP_CONFIG.app,
            redirectUrl: APP_CONFIG.redirectUrl,
            responseMode: VKID.ConfigResponseMode.Callback,
            source: VKID.ConfigSource.LOWCODE,
        });

        VKID.Auth.exchangeCode(code, deviceId)
            .then(data => {
                window.history.replaceState({}, document.title, "/");
                sendTokenToServer(data.access_token, data.user_id);
            })
            .catch(err => {
                console.error("VK Error:", err);
                alert("Ошибка авторизации VK");
                window.location.replace('/');
            });
        return true;
    }
    return false;
}

function renderVKButton(container) {
    if (!window.VKIDSDK) return;

    const VKID = window.VKIDSDK;
    VKID.Config.init({
        app: APP_CONFIG.app,
        redirectUrl: APP_CONFIG.redirectUrl,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'bdate'
    });

    const oneTap = new VKID.OneTap();
    
    oneTap.render({
        container: container,
        showAlternativeLogin: true,
        styles: { borderRadius: 12, height: 48 }
    })
    .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
        if (payload.code && payload.device_id) {
            container.classList.add('hidden');
            const loader = document.getElementById('loader');
            if(loader) loader.classList.remove('hidden');

            VKID.Auth.exchangeCode(payload.code, payload.device_id)
                .then(data => sendTokenToServer(data.access_token, data.user_id));
        }
    });
}

function sendTokenToServer(token, userId) {
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.replace('/');
        } else {
            alert(data.reason || "Доступ запрещен (18+)");
            window.location.replace('/');
        }
    })
    .catch(() => alert("Ошибка сети"));
}