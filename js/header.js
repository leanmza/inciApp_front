// ========================================
// ENCABEZADO COMPARTIDO
// ========================================
// Carga templates/header.html (antes lo servía Node en /header.html)
// y muestra u oculta las opciones según si hay sesión iniciada.

document.addEventListener('DOMContentLoaded', async () => {
    const contenedor = document.getElementById('shared-header');

    if (!contenedor) return;

    try {
        // Ruta relativa a la página actual (index.html o templates/*.html)
        const respuesta = await fetch(Auth.url('templates/header.html'), { cache: 'no-cache' });

        if (!respuesta.ok) {
            throw new Error('No se pudo cargar el encabezado');
        }

        contenedor.innerHTML = await respuesta.text();
        ajustarRutas(contenedor);
        aplicarEstadoSesion(contenedor);

    } catch (error) {
        console.error('Error al cargar el encabezado:', error);
    }
});

// Los href del header están escritos desde la raíz del front
// ('index.html', 'templates/profile.html'). Se les agrega el prefijo
// necesario según dónde esté la página actual.
function ajustarRutas(contenedor) {
    contenedor.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href');
        // Se dejan igual anclas, URLs absolutas y rutas desde la raíz del servidor
        if (/^(#|[a-z]+:|\/)/i.test(href)) return;
        link.dataset.ruta = href;            // ruta original, para marcar el link activo
        link.setAttribute('href', Auth.url(href));
    });
}

function aplicarEstadoSesion(contenedor) {
    const logueado = window.Auth && Auth.isLoggedIn();

    // Elementos que solo ve un usuario logueado
    contenedor.querySelectorAll('[data-auth="user"]').forEach((el) => {
        el.hidden = !logueado;
    });

    // Elementos que solo ve un visitante sin sesión
    contenedor.querySelectorAll('[data-auth="guest"]').forEach((el) => {
        el.hidden = logueado;
    });

    // Marcar el link de la página actual
    const actual = Auth.paginaActual();
    contenedor.querySelectorAll('a[data-ruta]').forEach((link) => {
        if (link.dataset.ruta === actual) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
}
