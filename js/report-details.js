// ========================================
// DETALLE DE UN INCIDENTE  ->  GET /api/incidentes/{id} (Spring, con JWT)
// ========================================
// Se llega desde my-reports.html con report-details.html?id=123
// Respuesta: IncidenteResponseDTO
//   { id, tipo, descripcion, direccion, fecha, estado, prioridad,
//     localidad, departamento, usuario, images: [...] }

document.addEventListener('DOMContentLoaded', () => {
    const mensaje = document.getElementById('details-message');
    const tarjeta = document.getElementById('details-card');

    // Ids de la tabla de estados del back (mismos que en my-reports.js)
    const ESTADO = {
        PENDIENTE: 1,
        EN_REVISION: 2,
        EN_PROCESO: 3,
        RESUELTO: 4,
        CERRADO: 5,
        RECHAZADO: 6
    };

    // Clase de la "pill" según el estado
    const CLASES_ESTADO = {
        [ESTADO.PENDIENTE]: 'status-pill-pendiente',
        [ESTADO.EN_REVISION]: 'status-pill-gestional',
        [ESTADO.EN_PROCESO]: 'status-pill-gestional',
        [ESTADO.RESUELTO]: 'status-pill-resuelto',
        [ESTADO.CERRADO]: 'status-pill-cerrado',
        [ESTADO.RECHAZADO]: 'status-pill-rechazado'
    };

    const IMAGEN_POR_DEFECTO = '../assets/img/camara.png';

    // ---------- Helpers para leer los DTO anidados ----------

    // Devuelve el primer campo de texto que exista en el objeto.
    // Si los DTO del back usan otro nombre, agregarlo a la lista correspondiente.
    const texto = (obj, claves) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        const clave = claves.find(c => obj[c]);
        return clave ? String(obj[clave]) : '';
    };

    const nombreTipo = (i) => texto(i.tipo, ['tipo', 'nombre', 'descripcion']);
    const nombreEstado = (i) => texto(i.estado, ['estado', 'nombre', 'descripcion']);
    const nombrePrioridad = (i) => texto(i.prioridad, ['prioridad', 'nombre', 'descripcion']);
    const nombreLocalidad = (i) => texto(i.localidad, ['nombre', 'localidad']);
    const nombreDepartamento = (i) => texto(i.departamento, ['nombre', 'departamento']);

    const nombreUsuario = (u) => {
        if (!u) return '';
        const completo = [u.name, u.lastname].filter(Boolean).join(' ');
        return completo || texto(u, ['username', 'email']);
    };

    const urlImagen = (imagen) => {
        const ruta = texto(imagen, ['url', 'imageUrl', 'ruta', 'path']);
        if (!ruta) return '';
        // URL absoluta (ej. Cloudinary) o ruta servida por el back
        if (/^(https?:|data:)/i.test(ruta)) return ruta;
        return Auth.API_URL + (ruta.startsWith('/') ? '' : '/') + ruta;
    };

    // ---------- Formato ----------

    // "AAAA-MM-DD" (LocalDate) -> "Reportado hoy", "Reportado ayer" o "Reportado el DD/MM/AAAA"
    const formatearFecha = (iso) => {
        if (!iso) return 'Fecha no informada';
        const [anio, mes, dia] = String(iso).split('-').map(Number);
        if (!anio || !mes || !dia) return iso;

        const fecha = new Date(anio, mes - 1, dia);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - fecha) / 86400000);

        if (dias === 0) return 'Reportado hoy';
        if (dias === 1) return 'Reportado ayer';
        return `Reportado el ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
    };

    // ---------- Render ----------

    const setTexto = (id, valor) => {
        document.getElementById(id).textContent = valor;
    };

    const mostrarFotos = (i) => {
        const foto = document.getElementById('detail-foto');
        const overlay = document.getElementById('detail-foto-overlay');
        const miniaturas = document.getElementById('detail-miniaturas');
        const urls = (i.images || []).map(urlImagen).filter(Boolean);

        // Si una foto no carga se muestra la imagen por defecto (una sola vez, evita un bucle)
        foto.addEventListener('error', () => {
            if (foto.dataset.porDefecto) return;
            foto.dataset.porDefecto = 'si';
            foto.src = IMAGEN_POR_DEFECTO;
        });

        overlay.textContent = [i.direccion, formatearFecha(i.fecha)].filter(Boolean).join(' • ');

        if (urls.length === 0) {
            foto.src = IMAGEN_POR_DEFECTO;
            foto.alt = 'El reporte no tiene fotos';
            return;
        }

        const verFoto = (indice) => {
            delete foto.dataset.porDefecto;
            foto.src = urls[indice];
            foto.alt = `Foto ${indice + 1} de ${urls.length} del reporte #REP-${i.id}`;
            miniaturas.querySelectorAll('button').forEach((b, n) => {
                b.classList.toggle('active', n === indice);
                b.setAttribute('aria-pressed', String(n === indice));
            });
        };

        // Con más de una foto se muestran miniaturas para cambiar la principal
        if (urls.length > 1) {
            urls.forEach((url, indice) => {
                const boton = document.createElement('button');
                boton.type = 'button';
                boton.className = 'photo-thumb';
                boton.setAttribute('aria-label', `Ver foto ${indice + 1}`);

                const img = document.createElement('img');
                img.src = url;
                img.alt = '';
                img.addEventListener('error', () => { img.src = IMAGEN_POR_DEFECTO; }, { once: true });

                boton.appendChild(img);
                boton.addEventListener('click', () => verFoto(indice));
                miniaturas.appendChild(boton);
            });
            miniaturas.hidden = false;
        }

        verFoto(0);
    };

    // Los datos del back se cargan con textContent (evita inyectar HTML)
    const mostrarIncidente = (i) => {
        const tipo = nombreTipo(i) || 'Sin categoría';
        const estado = document.getElementById('detail-estado');
        const zona = [nombreLocalidad(i), nombreDepartamento(i)].filter(Boolean).join(', ');
        const prioridad = nombrePrioridad(i);

        document.title = `#REP-${i.id} ${tipo} - Reporte Ciudadano`;

        setTexto('detail-id', `#REP-${i.id}`);
        setTexto('detail-tipo', tipo.toUpperCase());
        setTexto('detail-titulo', tipo);

        estado.textContent = `• ${nombreEstado(i) || 'Sin estado'}`;
        estado.classList.add(CLASES_ESTADO[Number(i.estado && i.estado.id)] || 'status-pill-pendiente');

        const fecha = document.getElementById('detail-fecha');
        fecha.textContent = formatearFecha(i.fecha);
        if (i.fecha) fecha.dateTime = i.fecha;

        setTexto('detail-direccion', i.direccion || 'Dirección no informada');
        setTexto('detail-zona', zona);
        setTexto('detail-prioridad', prioridad || 'Sin asignar');
        setTexto('detail-usuario', nombreUsuario(i.usuario) || 'No informado');
        setTexto('detail-usuario-email', (i.usuario && i.usuario.email) || '');
        setTexto('detail-descripcion', i.descripcion || 'Sin descripción.');

        mostrarFotos(i);

        mensaje.hidden = true;
        tarjeta.hidden = false;
    };

    const mostrarError = (texto) => {
        mensaje.textContent = texto;
        mensaje.classList.add('error');
        mensaje.hidden = false;
        tarjeta.hidden = true;
    };

    // ---------- Link "Volver" ----------

    // Se llega desde Mis Incidentes o desde Incidentes Activos: volver a la lista de origen
    const ajustarVolver = () => {
        if (!/\/active-incidents\.html/.test(document.referrer)) return;
        const volver = document.querySelector('.back-link');
        volver.href = 'active-incidents.html';
        volver.textContent = '← Volver a Incidentes Activos';
    };

    // ---------- Carga ----------

    const cargarIncidente = async () => {
        const id = new URLSearchParams(window.location.search).get('id');

        if (!id || !/^\d+$/.test(id)) {
            mostrarError('No se indicó qué reporte mostrar. Volvé a Mis Incidentes y elegí uno.');
            return;
        }

        try {
            const incidente = await Auth.apiFetch(`/api/incidentes/${id}`, { cache: 'no-store' });
            mostrarIncidente(incidente);

        } catch (error) {
            if (error.status === 404) {
                mostrarError(`No existe el reporte #REP-${id}.`);
            } else if (error.status === 403) {
                mostrarError('No tenés permiso para ver este reporte.');
            } else {
                mostrarError('No se pudo cargar el reporte: ' + error.message);
            }
        }
    };

    ajustarVolver();
    cargarIncidente();
});
