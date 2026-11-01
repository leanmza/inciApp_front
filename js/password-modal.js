document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('password-modal');
    const openButton = document.getElementById('open-password-modal');
    const closeButton = document.getElementById('close-password-modal');
    const cancelButton = document.getElementById('cancel-password-modal');
    const form = document.getElementById('password-form');
    const message = document.getElementById('password-message');
    const saveButton = document.getElementById('save-password-button');

    if (!modal || !openButton || !form || !message || !saveButton) {
        console.error('No se encontraron los elementos de cambio de contraseña.');
        return;
    }

    function showMessage(text, type) {
        message.textContent = text;
        message.className = `password-message ${type}`;
        message.hidden = false;
    }

    function clearMessage() {
        message.textContent = '';
        message.hidden = true;
        message.className = 'password-message';
    }

    function openModal() {
        form.reset();
        clearMessage();
        modal.hidden = false;
        document.getElementById('current-password').focus();
    }

    function closeModal() {
        modal.hidden = true;
        form.reset();
        clearMessage();
        saveButton.disabled = false;
        saveButton.textContent = 'Guardar nueva contraseña';
    }

    openButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessage();

        const currentPassword =
            document.getElementById('current-password').value;
        const newPassword =
            document.getElementById('new-password').value;
        const confirmNewPassword =
            document.getElementById('confirm-new-password').value;

        if (newPassword.length < 8) {
            showMessage(
                'La nueva contraseña debe tener al menos 8 caracteres.',
                'error'
            );
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showMessage(
                'Las dos contraseñas nuevas no coinciden.',
                'error'
            );
            return;
        }

        if (currentPassword === newPassword) {
            showMessage(
                'La nueva contraseña debe ser diferente de la actual.',
                'error'
            );
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';

        try {
            // PATCH /api/users/me/password (Spring, con JWT)
            const data = await Auth.apiFetch('/api/users/me/password', {
                method: 'PATCH',
                body: {
                    currentPassword,
                    newPassword
                }
            });

            showMessage(
                (data && data.mensaje) || 'La contraseña se cambió correctamente.',
                'success'
            );

            form.reset();

            setTimeout(() => {
                closeModal();
            }, 3000);

        } catch (error) {
            showMessage(
                error.message || 'No se pudo cambiar la contraseña.',
                'error'
            );
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar nueva contraseña';
        }
    });
});