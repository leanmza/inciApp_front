// ========================================
// BOTÓN FLOTANTE "CERRAR SESIÓN" + CONFIRMACIÓN
// ========================================
// Con JWT no hay sesión en el servidor: cerrar sesión = borrar el token
// (Auth.logout). Antes de hacerlo se pide confirmación en una ventana.

document.addEventListener('DOMContentLoaded', () => {
    // 1. Si no hay sesión iniciada, no mostrar el botón
    if (!window.Auth || !Auth.isLoggedIn()) {
        return;
    }

    // 2. Crear el botón flotante
    const contenedor = document.createElement('div');
    contenedor.id = 'logout-floating-form';
    contenedor.classList.add('logout-floating-form');

    const botonCerrarSesion = document.createElement('button');
    botonCerrarSesion.type = 'button';
    botonCerrarSesion.textContent = 'Cerrar sesión';
    botonCerrarSesion.classList.add('logout-floating-button');
    botonCerrarSesion.title = 'Cerrar la sesión actual';

    contenedor.appendChild(botonCerrarSesion);
    document.body.appendChild(contenedor);

    // 3. Crear la ventana de confirmación
    const modal = document.createElement('div');
    modal.id = 'logout-confirm-modal';
    modal.className = 'logout-confirm-modal';
    modal.hidden = true;

    modal.innerHTML = `
        <div class="logout-confirm-content"
             role="dialog"
             aria-modal="true"
             aria-labelledby="logout-confirm-title">

            <h2 id="logout-confirm-title">Cerrar sesión</h2>

            <p>¿Estás seguro de que querés cerrar tu sesión?</p>

            <div class="logout-confirm-buttons">
                <button type="button" id="confirm-logout">
                    Sí, cerrar sesión
                </button>

                <button type="button" id="cancel-logout">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 4. Botones de la ventana
    const confirmar = modal.querySelector('#confirm-logout');
    const cancelar = modal.querySelector('#cancel-logout');

    const abrirModal = () => {
        modal.hidden = false;
        confirmar.focus();
    };

    const cerrarModal = () => {
        modal.hidden = true;
        botonCerrarSesion.focus();
    };

    // 5. Abrir la ventana al intentar cerrar sesión
    botonCerrarSesion.addEventListener('click', abrirModal);

    // 6. Confirmar: borrar el token y volver al login
    confirmar.addEventListener('click', () => Auth.logout());

    // 7. Cancelar
    cancelar.addEventListener('click', cerrarModal);

    // 8. Cerrar al hacer clic fuera de la ventana
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            cerrarModal();
        }
    });

    // 9. Cerrar al presionar Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            cerrarModal();
        }
    });
});
