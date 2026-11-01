// Si ya hay una sesión vigente no tiene sentido mostrar el login
Auth.redirectIfLoggedIn();

const loginOption = document.getElementById('login-option');
const registerOption = document.getElementById('register-option');
const loginContent = document.getElementById('login-content');
const registerContent = document.getElementById('register-content');

let activeOption = 1;

// Cambiar entre las pestañas
const changeActiveOption = () => {
    if (activeOption === 1) {
        loginOption.classList.value = 'tab-item option-active login-tab';
        loginContent.classList.value = 'content content-active';

        registerOption.classList.value = 'tab-item';
        registerContent.classList.value = 'content';
    } else {
        loginOption.classList.value = 'tab-item';
        loginContent.classList.value = 'content';

        registerOption.classList.value = 'tab-item option-active register-tab';
        registerContent.classList.value = 'content content-active';
    }
};

loginOption.addEventListener('click', () => {
    activeOption = 1;
    changeActiveOption();
});

registerOption.addEventListener('click', () => {
    activeOption = 2;
    changeActiveOption();
});

// Links "Regístrate aquí" / "Inicia sesión aquí"
document.querySelectorAll('a[href="#register-option"]').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        activeOption = 2;
        changeActiveOption();
    });
});

document.querySelectorAll('a[href="#login-option"]').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        activeOption = 1;
        changeActiveOption();
    });
});

// Página a la que volver después del login (la guarda guard.js en ?next=)
const obtenerDestino = () => {
    const next = new URLSearchParams(window.location.search).get('next');
    // Solo se aceptan páginas propias: index.html o templates/*.html
    // (evita redirecciones a otros sitios)
    if (next && /^(templates\/)?[a-z0-9\-]+\.html(\?.*)?$/i.test(next)) {
        return Auth.url(next);
    }
    return Auth.url(Auth.HOME_PAGE);
};

// ========================================
// INICIAR SESIÓN  ->  POST /auth/login (Spring)
// ========================================

const loginForm = document.getElementById('login-form');
const mensajeLogin = document.getElementById('login-mensaje');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    mensajeLogin.hidden = true;
    mensajeLogin.textContent = '';
    mensajeLogin.className = 'login-mensaje';

    const boton = loginForm.querySelector('button[type="submit"]');
    boton.disabled = true;

    try {
        const username = loginForm.elements.username.value.trim().toLowerCase();
        const password = loginForm.elements.password.value;
        const recordar = loginForm.elements['remember-me'].checked;

        if (!username || !password) {
            throw new Error('Ingresa tu correo electrónico y contraseña.');
        }

        // Respuesta: { username, message, jwt, status }
        const resultado = await Auth.apiFetch('/auth/login', {
            method: 'POST',
            auth: false,
            body: { username, password }
        });

        if (!resultado || !resultado.status || !resultado.jwt) {
            throw new Error('No se pudo iniciar sesión.');
        }

        Auth.saveSession(resultado.jwt, resultado.username, recordar);

        mensajeLogin.textContent = `¡Bienvenido/a! Ingresando...`;
        mensajeLogin.classList.add('exito');
        mensajeLogin.hidden = false;

        setTimeout(() => {
            window.location.href = obtenerDestino();
        }, 1000);

    } catch (error) {
        mensajeLogin.textContent =
            error.message || 'Ocurrió un error al iniciar sesión.';

        mensajeLogin.classList.add('error');
        mensajeLogin.hidden = false;
        boton.disabled = false;
    }
});

// ========================================
// REGISTRAR USUARIO  ->  POST /api/users (Spring)
// ========================================

const registerForm = document.getElementById('register-form');
const mensajeRegistro = document.getElementById('registro-mensaje');

// Cargar provincias, departamentos y localidades desde la API
Ubicaciones.iniciar({
    provincia: document.getElementById('reg-provincia'),
    departamento: document.getElementById('reg-department'),
    localidad: document.getElementById('reg-localidad')
}).catch((error) => {
    mensajeRegistro.textContent =
        'No se pudieron cargar las provincias: ' + error.message;
    mensajeRegistro.style.color = 'red';
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    mensajeRegistro.textContent = '';
    mensajeRegistro.style.color = '';

    const boton = registerForm.querySelector('button[type="submit"]');
    boton.disabled = true;

    try {
        const f = registerForm.elements;

        if (f.password.value !== f.password_confirm.value) {
            throw new Error('Las contraseñas no coinciden.');
        }

        if (!f.terms.checked) {
            throw new Error('Debes aceptar los términos y condiciones.');
        }

        const email = f.email.value.trim().toLowerCase();

        // Mismo formato que UsuarioRequestDTO del back.
        // Como en el servidor Node, el email se usa como nombre de usuario.
        const usuario = {
            username: email,
            name: f.name.value.trim(),
            lastname: f.surname.value.trim(),
            password: f.password.value,
            email,
            dni: f.dni.value.trim(),
            telefono: f.telefono.value.trim(),
            direccion: f.direccion.value.trim(),
            fechaNacimiento: f.fechaNacimiento.value, // "AAAA-MM-DD" -> LocalDate
            idProvincia: Number(f.idProvincia.value),
            idDepartamento: Number(f.idDepartamento.value),
            idLocalidad: Number(f.idLocalidad.value)
        };

        await Auth.apiFetch('/api/users', {
            method: 'POST',
            auth: false,
            body: usuario
        });

        mensajeRegistro.textContent = 'Registro exitoso. Ya puedes iniciar sesión con tu email.';
        mensajeRegistro.style.color = 'green';

        registerForm.reset();
        // Recalcular departamentos/localidades después del reset
        registerForm.elements.idProvincia.dispatchEvent(new Event('change'));

        setTimeout(() => {
            activeOption = 1;
            changeActiveOption();
            loginForm.elements.username.value = email;
            mensajeRegistro.textContent = '';
        }, 2500);

    } catch (error) {
        mensajeRegistro.textContent =
            error.message || 'Ocurrió un error al registrar el usuario.';

        mensajeRegistro.style.color = 'red';

    } finally {
        boton.disabled = false;
    }
});
