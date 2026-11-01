// ========================================
// REGISTRAR INCIDENTE  ->  POST /api/incidentes (Spring, multipart)
// ========================================
// El controller espera dos partes:
//   - "incidente": JSON con { descripcion, direccion, idLocalidad, idDepartamento, idTipo }
//     (el usuario lo obtiene el back del JWT)
//   - "images":    uno o más archivos (obligatorio)
// Límite del back: spring.servlet.multipart.max-request-size=3MB (toda la petición).

document.addEventListener('DOMContentLoaded', () => {
    const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
    const MAX_DESCRIPCION = 240;
    const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png'];

    const form = document.getElementById('report-form');
    const grid = document.getElementById('category-grid');
    const inputTipo = document.getElementById('incident-tipo');
    const inputDireccion = document.getElementById('incident-location');
    const inputFotos = document.getElementById('photo-evidence');
    const dropzone = document.getElementById('upload-dropzone');
    const listaPreview = document.getElementById('file-preview-list');
    const textarea = document.getElementById('additional-details');
    const contador = document.getElementById('char-counter');
    const mensaje = document.getElementById('report-message');
    const botonEnviar = document.getElementById('report-submit');
    const botonGps = document.getElementById('gps-btn');

    const selects = {
        provincia: document.getElementById('incident-provincia'),
        departamento: document.getElementById('incident-departamento'),
        localidad: document.getElementById('incident-localidad')
    };

    // Archivos elegidos (se mantienen acá para poder quitar uno y sumar otros)
    let archivos = [];

    // ---------- Mensajes ----------

    const mostrarMensaje = (texto, tipo) => {
        mensaje.textContent = texto;
        mensaje.className = `form-message ${tipo}`;
        mensaje.hidden = false;
        mensaje.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const ocultarMensaje = () => {
        mensaje.hidden = true;
        mensaje.textContent = '';
    };

    // ---------- 1. Categorías desde GET /api/tipos ----------

    // Íconos según palabras del nombre del tipo; si no coincide ninguno, se usa uno genérico
    const ICONOS = [
        { claves: ['vial', 'bache', 'calle', 'pavimento', 'asfalto'], svg: '<path d="M6 3v18M18 3v18M6 12h12M6 7h12M6 17h12"></path>' },
        { claves: ['alumbrado', 'luz', 'luminaria', 'electric'], svg: '<path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path><path d="M9 21h6"></path>' },
        { claves: ['arbol', 'árbol', 'rama', 'poda', 'verde'], svg: '<path d="M12 19V6M12 6L8 10M12 6l4 4"></path><path d="M12 2a7 7 0 0 0-7 7c0 4 7 10 7 10s7-6 7-10a7 7 0 0 0-7-7z"></path>' },
        { claves: ['residuo', 'basura', 'higiene', 'recolec', 'limpieza'], svg: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' },
        { claves: ['semáforo', 'semaforo', 'señal', 'transito', 'tránsito'], svg: '<rect x="6" y="2" width="12" height="20" rx="2"></rect><circle cx="12" cy="6" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="18" r="2"></circle>' },
        { claves: ['agua', 'fuga', 'acequia', 'cloaca', 'desag'], svg: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>' }
    ];
    const ICONO_GENERICO = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';

    const iconoPara = (nombre) => {
        const n = (nombre || '').toLowerCase();
        const encontrado = ICONOS.find(i => i.claves.some(c => n.includes(c)));
        return encontrado ? encontrado.svg : ICONO_GENERICO;
    };

    const seleccionarTipo = (boton) => {
        grid.querySelectorAll('.category-btn').forEach((b) => {
            const activo = b === boton;
            b.classList.toggle('active', activo);
            b.setAttribute('aria-checked', String(activo));
        });
        inputTipo.value = boton.dataset.id;
    };

    const cargarTipos = async () => {
        try {
            // Respuesta: [{ id, tipo }]
            const tipos = await Auth.apiFetch('/api/tipos');
            grid.innerHTML = '';

            if (!tipos || tipos.length === 0) {
                grid.innerHTML = '<span class="dropzone-subtitle">No hay categorías cargadas en el sistema.</span>';
                return;
            }

            tipos.forEach((t) => {
                const boton = document.createElement('button');
                boton.type = 'button';
                boton.className = 'category-btn';
                boton.dataset.id = t.id;
                boton.setAttribute('role', 'radio');
                boton.setAttribute('aria-checked', 'false');
                boton.innerHTML =
                    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">${iconoPara(t.tipo)}</svg>`;
                boton.append(document.createTextNode(t.tipo));
                boton.addEventListener('click', () => seleccionarTipo(boton));
                grid.appendChild(boton);
            });

        } catch (error) {
            grid.innerHTML = '';
            mostrarMensaje('No se pudieron cargar las categorías: ' + error.message, 'error');
        }
    };

    // ---------- 2. Ubicación ----------

    // Se preseleccionan provincia/departamento/localidad del usuario logueado
    const cargarUbicacion = async () => {
        let seleccion = {};
        try {
            const yo = await Auth.apiFetch('/api/users/me');
            seleccion = {
                idProvincia: yo.provincia && yo.provincia.id,
                idDepartamento: yo.departamento && yo.departamento.id,
                idLocalidad: yo.localidad && yo.localidad.id
            };
        } catch {
            // Si falla, se cargan los selects sin preselección
        }

        try {
            await Ubicaciones.iniciar(selects, seleccion);
        } catch (error) {
            mostrarMensaje('No se pudieron cargar las ubicaciones: ' + error.message, 'error');
        }
    };

    // Completa la dirección con las coordenadas (no hay geocodificación inversa)
    botonGps.addEventListener('click', () => {
        if (!navigator.geolocation) {
            mostrarMensaje('Tu navegador no permite obtener la ubicación.', 'error');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const coords = `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                inputDireccion.value = inputDireccion.value.trim()
                    ? `${inputDireccion.value.trim()} (${coords})`
                    : coords;
            },
            () => mostrarMensaje('No se pudo obtener tu ubicación. Revisá los permisos del navegador.', 'error'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    // ---------- 3. Fotos ----------

    const formatearTamano = (bytes) =>
        bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

    const tamanoTotal = () => archivos.reduce((total, f) => total + f.size, 0);

    const renderPreview = () => {
        listaPreview.querySelectorAll('img[data-url]').forEach(img => URL.revokeObjectURL(img.dataset.url));
        listaPreview.innerHTML = '';

        const excedido = tamanoTotal() > MAX_TOTAL_BYTES;

        archivos.forEach((archivo, indice) => {
            const url = URL.createObjectURL(archivo);
            const item = document.createElement('div');
            item.className = 'uploaded-file-preview';
            item.innerHTML = `
                <img class="preview-thumbnail" alt="Previsualización" data-url="${url}" src="${url}">
                <div class="file-info">
                    <span class="file-name"></span>
                    <span class="file-status${excedido ? ' error' : ''}">
                        ${formatearTamano(archivo.size)} • ${excedido ? 'Se supera el límite total de 3 MB' : 'Lista para envío'}
                    </span>
                </div>
                <button type="button" class="remove-file-btn" aria-label="Eliminar archivo">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>`;
            item.querySelector('.file-name').textContent = archivo.name; // textContent: evita inyectar HTML
            item.querySelector('.remove-file-btn').addEventListener('click', () => {
                archivos.splice(indice, 1);
                renderPreview();
            });
            listaPreview.appendChild(item);
        });
    };

    const agregarArchivos = (lista) => {
        ocultarMensaje();
        const nuevos = Array.from(lista);
        const invalidos = nuevos.filter(f => !TIPOS_PERMITIDOS.includes(f.type));

        if (invalidos.length) {
            mostrarMensaje('Solo se aceptan imágenes JPG o PNG.', 'error');
        }

        nuevos
            .filter(f => TIPOS_PERMITIDOS.includes(f.type))
            // evitar duplicados (mismo nombre y tamaño)
            .filter(f => !archivos.some(a => a.name === f.name && a.size === f.size))
            .forEach(f => archivos.push(f));

        renderPreview();
    };

    inputFotos.addEventListener('change', () => {
        agregarArchivos(inputFotos.files);
        inputFotos.value = ''; // permite volver a elegir el mismo archivo
    });

    ['dragenter', 'dragover'].forEach((evento) =>
        dropzone.addEventListener(evento, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        }));

    ['dragleave', 'drop'].forEach((evento) =>
        dropzone.addEventListener(evento, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        }));

    dropzone.addEventListener('drop', (e) => agregarArchivos(e.dataTransfer.files));

    // ---------- 4. Contador de caracteres ----------

    const actualizarContador = () => {
        contador.textContent = `${textarea.value.length}/${MAX_DESCRIPCION}`;
    };
    textarea.addEventListener('input', actualizarContador);

    // ---------- Envío ----------

    const validar = () => {
        if (!inputTipo.value) return 'Seleccioná la categoría del reporte.';
        if (!selects.departamento.value) return 'Seleccioná el departamento.';
        if (!selects.localidad.value) return 'Seleccioná la localidad.';
        if (!inputDireccion.value.trim()) return 'Ingresá la dirección del incidente.';
        if (archivos.length === 0) return 'Adjuntá al menos una foto del incidente.';
        if (tamanoTotal() > MAX_TOTAL_BYTES) return 'Las fotos superan los 3 MB en total. Quitá alguna o usá imágenes más livianas.';
        if (!textarea.value.trim()) return 'Ingresá una descripción del problema.';
        return null;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        ocultarMensaje();

        const error = validar();
        if (error) {
            mostrarMensaje(error, 'error');
            return;
        }

        // Mismo formato que IncidenteRequestDTO.
        // El usuario no se envía: el back lo toma del JWT.
        const incidente = {
            descripcion: textarea.value.trim(),
            direccion: inputDireccion.value.trim(),
            idLocalidad: Number(selects.localidad.value),
            idDepartamento: Number(selects.departamento.value),
            idTipo: Number(inputTipo.value)
        };

        const datos = new FormData();
        // @RequestPart("incidente") necesita que la parte venga con Content-Type application/json
        datos.append('incidente', new Blob([JSON.stringify(incidente)], { type: 'application/json' }));
        archivos.forEach(archivo => datos.append('images', archivo, archivo.name));

        botonEnviar.disabled = true;
        const textoBoton = botonEnviar.firstChild.textContent;
        botonEnviar.firstChild.textContent = 'Enviando... ';

        try {
            // No se setea Content-Type: el navegador arma el multipart con su boundary
            const creado = await Auth.apiFetch('/api/incidentes', {
                method: 'POST',
                body: datos
            });

            mostrarMensaje(
                `Reporte #${creado && creado.id ? creado.id : ''} registrado correctamente. Te llevamos a tus reportes...`,
                'success'
            );

            form.reset();
            archivos = [];
            renderPreview();
            actualizarContador();
            grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));

            setTimeout(() => {
                window.location.href = Auth.url('templates/my-reports.html');
            }, 2000);

        } catch (err) {
            const texto = err.status === 413
                ? 'Las fotos son demasiado grandes para el servidor (máximo 3 MB en total).'
                : err.message || 'No se pudo registrar el reporte.';
            mostrarMensaje(texto, 'error');
            botonEnviar.disabled = false;
            botonEnviar.firstChild.textContent = textoBoton;
        }
    });

    cargarTipos();
    cargarUbicacion();
});
