// ========================================
// AUTENTICACIÓN CON JWT + LLAMADAS A LA API
// ========================================
// Reemplaza a la sesión de express-session del servidor Node.
// El JWT que genera Spring (POST /auth/login) se guarda en el navegador
// y se envía en cada petición como "Authorization: Bearer <token>".

(function () {
    const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || 'http://localhost:8080';
    const TOKEN_KEY = 'inciapp_token';
    const USER_KEY = 'inciapp_username';

    // ---------- Rutas ----------
    // index.html está en la raíz y el resto de las páginas en templates/.
    // ROOT es el prefijo para llegar a la raíz del front desde la página actual.
    const EN_TEMPLATES = /\/templates\/[^/]*$/.test(window.location.pathname);
    const ROOT = EN_TEMPLATES ? '../' : '';

    // Rutas escritas desde la raíz del front
    const LOGIN_PAGE = 'templates/login.html';
    const HOME_PAGE = 'index.html';

    // Convierte una ruta escrita desde la raíz ('templates/profile.html')
    // en una ruta válida desde la página actual ('../templates/profile.html', etc.)
    function url(rutaDesdeRaiz) {
        return ROOT + rutaDesdeRaiz;
    }

    // Ruta de la página actual escrita desde la raíz, ej. 'templates/profile.html'
    function paginaActual() {
        const archivo = window.location.pathname.split('/').pop() || HOME_PAGE;
        return (EN_TEMPLATES ? 'templates/' : '') + archivo;
    }

    // ---------- Token ----------

    // Lee el token de localStorage ("recordar sesión") o de sessionStorage
    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    }

    function getUsername() {
        try {
            return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
        } catch {
            return null;
        }
    }

    function saveSession(token, username, remember) {
        clearSession();
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEY, token);
        if (username) storage.setItem(USER_KEY, username);
    }

    function clearSession() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
        } catch {
            /* sin almacenamiento disponible */
        }
    }

    // Decodifica el payload del JWT (sin verificar la firma: eso lo hace el back)
    function decodeToken(token) {
        try {
            const payload = token.split('.')[1]
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(payload)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    // Hay sesión si existe un token y no está vencido (claim "exp" en segundos)
    function isLoggedIn() {
        const token = getToken();
        if (!token) return false;

        const payload = decodeToken(token);
        if (!payload || !payload.exp) {
            clearSession();
            return false;
        }

        if (payload.exp * 1000 <= Date.now()) {
            clearSession();
            return false;
        }
        return true;
    }

    // ---------- Navegación según la sesión ----------

    function goToLogin() {
        const actual = paginaActual();
        const next = actual === LOGIN_PAGE ? '' : `?next=${encodeURIComponent(actual + window.location.search)}`;
        window.location.replace(url(LOGIN_PAGE) + next);
    }

    // Llamar al principio de cada página protegida
    function requireAuth() {
        if (!isLoggedIn()) {
            goToLogin();
            return false;
        }
        return true;
    }

    // En login.html: si ya hay sesión, ir directo al inicio
    function redirectIfLoggedIn() {
        if (isLoggedIn()) {
            window.location.replace(url(HOME_PAGE));
        }
    }

    function logout() {
        clearSession();
        window.location.href = url(LOGIN_PAGE);
    }

    // ---------- Fetch a la API ----------

    // Saca un mensaje legible de las distintas respuestas de error del back:
    // {"error": "..."}, {"campo": "mensaje", ...} (validaciones) o texto plano
    function extractMessage(data, fallback) {
        if (!data) return fallback;
        if (typeof data === 'string') return data || fallback;
        if (data.mensaje) return data.mensaje;
        if (data.error && typeof data.error === 'string') return data.error;
        if (data.message) return data.message;
        const valores = Object.values(data).filter(v => typeof v === 'string');
        return valores.length ? valores.join(' ') : fallback;
    }

    /**
     * Hace un fetch a la API agregando el JWT.
     * - path: ruta relativa a API_URL, ej. '/api/users/me'
     * - options.body: si es un objeto plano se envía como JSON; FormData se envía tal cual
     * - options.auth: false para no enviar el token (login, registro)
     * Devuelve los datos parseados o lanza un Error con el mensaje del back.
     */
    async function apiFetch(path, options = {}) {
        const { auth = true, body, headers = {}, ...rest } = options;
        const finalHeaders = { ...headers };
        let finalBody = body;

        if (body && !(body instanceof FormData) && typeof body !== 'string') {
            finalHeaders['Content-Type'] = 'application/json';
            finalBody = JSON.stringify(body);
        }

        if (auth) {
            const token = getToken();
            if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
        }

        let respuesta;
        try {
            respuesta = await fetch(API_URL + path, {
                ...rest,
                headers: finalHeaders,
                body: finalBody
            });
        } catch {
            throw new Error('No se pudo conectar con el servidor. Verificá que la API esté en ejecución.');
        }

        const texto = await respuesta.text();
        let datos = null;
        if (texto) {
            try {
                datos = JSON.parse(texto);
            } catch {
                datos = texto;
            }
        }

        // Token vencido o inválido en una ruta protegida: cerrar sesión e ir al login
        if (respuesta.status === 401 && auth && getToken()) {
            clearSession();
            goToLogin();
            throw new Error('Tu sesión expiró. Iniciá sesión nuevamente.');
        }

        if (!respuesta.ok) {
            const error = new Error(extractMessage(datos, `Error ${respuesta.status}`));
            error.status = respuesta.status;
            error.data = datos;
            throw error;
        }

        return datos;
    }

    window.Auth = {
        API_URL,
        ROOT,
        HOME_PAGE,
        url,
        paginaActual,
        getToken,
        getUsername,
        saveSession,
        clearSession,
        decodeToken,
        isLoggedIn,
        requireAuth,
        redirectIfLoggedIn,
        logout,
        apiFetch,
        extractMessage
    };
})();
