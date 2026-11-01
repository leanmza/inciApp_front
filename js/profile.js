// ========================================
// MI PERFIL  ->  /api/users/me (Spring, con JWT)
// ========================================
//   GET    /api/users/me   datos del usuario logueado
//   PUT    /api/users/me   modificar datos
//   DELETE /api/users/me   desactivar la cuenta (soft delete)

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('profile-form');
    const mensaje = document.getElementById('profile-message');
    const botonEliminar = document.getElementById('delete-account-button');

    const selects = {
        provincia: document.getElementById('provincia_id'),
        departamento: document.getElementById('departamento_id'),
        localidad: document.getElementById('localidad_id')
    };

    const mostrarMensaje = (texto, tipo) => {
        mensaje.textContent = texto;
        mensaje.className = `profile-message ${tipo}`;
        mensaje.hidden = false;
    };

    const ocultarMensaje = () => {
        mensaje.textContent = '';
        mensaje.hidden = true;
    };

    // "AAAA-MM-DD" -> "DD/MM/AAAA" sin problemas de zona horaria
    const formatearFecha = (iso) => {
        if (!iso) return 'No disponible';
        const [anio, mes, dia] = String(iso).split('-');
        return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
    };

    // Cargar los datos de la cuenta
    const cargarPerfil = async () => {
        try {
            // Si el token venció, apiFetch redirige al login
            const datos = await Auth.apiFetch('/api/users/me', { cache: 'no-store' });

            formulario.elements.nombre.value = datos.name || '';
            formulario.elements.apellido.value = datos.lastname || '';
            formulario.elements.dni.value = datos.dni || '';
            formulario.elements.email.value = datos.email || '';
            formulario.elements.telefono.value = datos.telefono || '';
            formulario.elements.direccion.value = datos.direccion || '';
            formulario.elements.fechaNacimiento.value = datos.fechaNacimiento || '';

            document.getElementById('fecha_registro').value =
                formatearFecha(datos.fechaRegistro);

            await Ubicaciones.iniciar(selects, {
                idProvincia: datos.provincia && datos.provincia.id,
                idDepartamento: datos.departamento && datos.departamento.id,
                idLocalidad: datos.localidad && datos.localidad.id
            });

        } catch (error) {
            mostrarMensaje(error.message, 'error');
        }
    };

    // Guardar las modificaciones
    formulario.addEventListener('submit', async (event) => {
        event.preventDefault();
        ocultarMensaje();

        const botonGuardar = formulario.querySelector('button[type="submit"]');
        botonGuardar.disabled = true;

        try {
            const f = formulario.elements;

            // Mismo formato que UsuarioUpdateRequestDTO del back
            const datos = {
                name: f.nombre.value.trim(),
                lastname: f.apellido.value.trim(),
                dni: f.dni.value.trim(),
                email: f.email.value.trim().toLowerCase(),
                telefono: f.telefono.value.trim(),
                direccion: f.direccion.value.trim(),
                fechaNacimiento: f.fechaNacimiento.value || null,
                idProvincia: Number(f.idProvincia.value) || null,
                idDepartamento: Number(f.idDepartamento.value) || null,
                idLocalidad: Number(f.idLocalidad.value) || null
            };

            await Auth.apiFetch('/api/users/me', {
                method: 'PUT',
                body: datos
            });

            mostrarMensaje('Tus datos se actualizaron correctamente.', 'success');

        } catch (error) {
            mostrarMensaje(error.message || 'No se pudieron guardar los cambios.', 'error');
        } finally {
            botonGuardar.disabled = false;
        }
    });

    // Eliminar (desactivar) la cuenta con confirmación
    botonEliminar.addEventListener('click', async () => {
        const confirmacion = confirm(
            '¿Estás seguro de que querés eliminar tu cuenta? Esta acción no se puede deshacer.'
        );

        if (!confirmacion) {
            return;
        }

        const segundaConfirmacion = confirm(
            'Confirmá nuevamente: se eliminará tu cuenta de Reporte Ciudadano.'
        );

        if (!segundaConfirmacion) {
            return;
        }

        ocultarMensaje();
        botonEliminar.disabled = true;

        try {
            const resultado = await Auth.apiFetch('/api/users/me', {
                method: 'DELETE'
            });

            alert((resultado && resultado.mensaje) || 'Tu cuenta fue eliminada correctamente.');
            Auth.logout();

        } catch (error) {
            mostrarMensaje(error.message, 'error');
            botonEliminar.disabled = false;
        }
    });

    cargarPerfil();
});
