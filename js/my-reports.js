// ========================================
// MIS INCIDENTES  ->  GET /api/incidentes/user/me (Spring, con JWT)
// ========================================
// Respuesta: lista de IncidenteResponseDTO
//   { id, tipo, descripcion, direccion, fecha, estado, prioridad,
//     localidad, departamento, usuario, images: [...] }

document.addEventListener('DOMContentLoaded', () => {
    const lista = document.getElementById('incidents-list');
    const contador = document.getElementById('reports-counter');
    const mensaje = document.getElementById('reports-message');
    const buscador = document.getElementById('reports-search');
    const tabs = document.querySelectorAll('.tab-btn[data-filtro]');

    // Ids de la tabla de estados del back
    const ESTADO = {
        PENDIENTE: 1,
        EN_REVISION: 2,
        EN_PROCESO: 3,
        RESUELTO: 4,
        CERRADO: 5,
        RECHAZADO: 6,
        ELIMINADO: 8
    };
    const ESTADOS_FINALIZADOS = [ESTADO.RESUELTO, ESTADO.CERRADO, ESTADO.RECHAZADO];

    // Clase del badge según el estado
    const CLASES_ESTADO = {
        [ESTADO.PENDIENTE]: 'badge-status-active',
        [ESTADO.EN_REVISION]: 'badge-status-cuadrilla',
        [ESTADO.EN_PROCESO]: 'badge-status-cuadrilla',
        [ESTADO.RESUELTO]: 'badge-status-resolved',
        [ESTADO.CERRADO]: 'badge-status-closed',
        [ESTADO.RECHAZADO]: 'badge-status-rejected'
    };

    const IMAGEN_POR_DEFECTO = '../assets/img/camara.png';

    let incidentes = [];
    let filtro = 'todos';

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

    const urlImagen = (i) => {
        const primera = i.images && i.images[0];
        const ruta = texto(primera, ['url', 'imageUrl', 'ruta', 'path']);
        if (!ruta) return IMAGEN_POR_DEFECTO;
        // URL absoluta (ej. Cloudinary) o ruta servida por el back
        if (/^(https?:|data:)/i.test(ruta)) return ruta;
        return Auth.API_URL + (ruta.startsWith('/') ? '' : '/') + ruta;
    };

    const idEstado = (i) => Number(i.estado && i.estado.id);

    const estaFinalizado = (i) => ESTADOS_FINALIZADOS.includes(idEstado(i));

    // ---------- Formato ----------

    // "AAAA-MM-DD" (LocalDate) -> "Hoy", "Ayer" o "DD/MM/AAAA"
    const formatearFecha = (iso) => {
        if (!iso) return '';
        const [anio, mes, dia] = String(iso).split('-').map(Number);
        if (!anio || !mes || !dia) return iso;

        const fecha = new Date(anio, mes - 1, dia);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - fecha) / 86400000);

        if (dias === 0) return 'Hoy';
        if (dias === 1) return 'Ayer';
        return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
    };

    const clasePrioridad = (i) => {
        const p = nombrePrioridad(i).toLowerCase();
        if (p.includes('alta') || p.includes('urgente')) return 'badge-high-severity';
        if (p.includes('media')) return 'badge-medium-severity';
        return 'badge-low-severity';
    };

    const claseEstado = (i) => CLASES_ESTADO[idEstado(i)] || 'badge-status-active';

    // ---------- Render ----------

    const crearTarjeta = (i) => {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'incident-card';

        // Estructura fija; los datos del back se cargan con textContent (evita inyectar HTML)
        tarjeta.innerHTML = `
            <div class="card-media">
                <span class="incident-id-badge"></span>
                <img class="incident-image" alt="">
            </div>
            <div class="card-body">
                <div class="card-header-meta">
                    <div class="badge-group">
                        <span class="badge badge-tipo"></span>
                        <span class="badge badge-estado"></span>
                    </div>
                    <time class="meta-time"></time>
                </div>
                <h2 class="card-title"></h2>
                <div class="card-location">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="location-text"></span>
                </div>
                <p class="card-description"></p>
                <div class="card-footer">
                    <div class="anon-vote-info">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span class="prioridad-text"></span>
                    </div>
                    <div class="my-report-actions">
                        <a class="card-action-link btn-details-fill">Detalles 🡪</a>
                    </div>
                </div>
            </div>`;

        const tipo = nombreTipo(i) || 'Sin categoría';
        const ubicacion = [i.direccion, nombreLocalidad(i), nombreDepartamento(i)].filter(Boolean).join(', ');
        const prioridad = nombrePrioridad(i);

        tarjeta.querySelector('.incident-id-badge').textContent = `#REP-${i.id}`;

        const img = tarjeta.querySelector('.incident-image');
        img.src = urlImagen(i);
        img.alt = tipo;
        img.addEventListener('error', () => { img.src = IMAGEN_POR_DEFECTO; }, { once: true });

        const badgeTipo = tarjeta.querySelector('.badge-tipo');
        badgeTipo.textContent = tipo;
        badgeTipo.classList.add(clasePrioridad(i));

        const badgeEstado = tarjeta.querySelector('.badge-estado');
        badgeEstado.textContent = nombreEstado(i) || 'Sin estado';
        badgeEstado.classList.add(claseEstado(i));

        const tiempo = tarjeta.querySelector('.meta-time');
        tiempo.textContent = formatearFecha(i.fecha);
        if (i.fecha) tiempo.dateTime = i.fecha;

        tarjeta.querySelector('.card-title').textContent = tipo;
        tarjeta.querySelector('.location-text').textContent = ubicacion || 'Ubicación no informada';
        tarjeta.querySelector('.card-description').textContent = i.descripcion || '';
        tarjeta.querySelector('.prioridad-text').textContent =
            prioridad ? `Prioridad: ${prioridad}` : 'Prioridad sin asignar';

        if (estaFinalizado(i)) {
            tarjeta.querySelector('.anon-vote-info').classList.add('voted');
        }

        tarjeta.querySelector('.card-action-link').href =
            `report-details.html?id=${encodeURIComponent(i.id)}`;

        return tarjeta;
    };

    const coincideBusqueda = (i, termino) => {
        if (!termino) return true;
        const campos = [
            `rep-${i.id}`, String(i.id), i.direccion, i.descripcion,
            nombreTipo(i), nombreEstado(i), nombreLocalidad(i), nombreDepartamento(i)
        ];
        return campos.some(c => (c || '').toLowerCase().includes(termino));
    };

    const mostrarVacio = (texto) => {
        const vacio = document.createElement('p');
        vacio.className = 'reports-empty';
        vacio.textContent = texto;
        lista.appendChild(vacio);
    };

    const render = () => {
        const termino = buscador.value.trim().toLowerCase().replace(/^#/, '');

        const visibles = incidentes
            .filter((i) => {
                if (filtro === 'activos') return !estaFinalizado(i);
                if (filtro === 'finalizados') return estaFinalizado(i);
                return true;
            })
            .filter(i => coincideBusqueda(i, termino));

        lista.innerHTML = '';

        if (incidentes.length === 0) {
            mostrarVacio('Todavía no registraste ningún incidente.');
            return;
        }
        if (visibles.length === 0) {
            mostrarVacio('No hay incidentes que coincidan con el filtro.');
            return;
        }

        visibles.forEach(i => lista.appendChild(crearTarjeta(i)));
    };

    const actualizarContador = () => {
        const total = incidentes.length;
        contador.innerHTML = '';
        const numero = document.createElement('strong');
        numero.textContent = total;
        contador.append(numero, total === 1 ? ' solicitud registrada' : ' solicitudes registradas');
    };

    // ---------- Eventos ----------

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            filtro = tab.dataset.filtro;
            render();
        });
    });

    buscador.addEventListener('input', render);

    // ---------- Carga ----------

    const cargarIncidentes = async () => {
        try {
            const datos = await Auth.apiFetch('/api/incidentes/user/me', { cache: 'no-store' });

            // Los eliminados no se muestran; más recientes primero
            incidentes = (Array.isArray(datos) ? datos : [])
                .filter(i => idEstado(i) !== ESTADO.ELIMINADO)
                .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.id - a.id);

            mensaje.hidden = true;
            actualizarContador();
            render();

        } catch (error) {
            lista.innerHTML = '';
            contador.textContent = '';
            mensaje.textContent = 'No se pudieron cargar tus incidentes: ' + error.message;
            mensaje.hidden = false;
        }
    };

    cargarIncidentes();
});
