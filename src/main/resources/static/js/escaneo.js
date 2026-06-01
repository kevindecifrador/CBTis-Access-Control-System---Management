/**
 * CBTis 134 - Intelligent Access Authentication Engine (QR & Face-ID)
 * @author Kevin Sánchez (2026)
 * * Orquestador perimetral cliente encargado de procesar la autenticación de accesos.
 * Implementa mecanismos anti-spam (Debounce), resolución de pases dinámicos en la nube,
 * renderizado asíncrono sobre Canvas de overlays biométricos y poda predictiva del
 * espacio de búsqueda en matrices de descriptores faciales (FaceMatcher O Array de 128 dimensiones).
 */

let procesandoEscaneo = false;
let ultimoEscaneo = { matricula: "", tiempo: 0 };
let faceMatcher = null;
let escaneoFacialActivo = false;
let streamReconocimiento = null;
let ultimoRostroDetectado = { matricula: "", tiempo: 0 };
let ultimoDesconocido = 0;
let modoEscaneoFacial = 'AMBOS'; 

/**
 * Receptor central de capturas de identidad válidas
 */
async function onScanSuccess(decodedText, parametroExtra = false) {
    if (procesandoEscaneo) return; 

    const esManual = (parametroExtra === true);
    const textoCrudo = decodedText.trim();
    const matricula = textoCrudo.includes('|') ? textoCrudo.split('|')[0] : textoCrudo;
    const ahora = Date.now();

    // Control de histéresis temporal para mitigar lecturas duplicadas continuas
    if (!esManual && ultimoEscaneo.matricula === matricula && (ahora - ultimoEscaneo.tiempo) < 5000) {
        return;
    }

    procesandoEscaneo = true; 
    ultimoEscaneo = { matricula, tiempo: ahora };
    const hoy = obtenerFechaLocal();
    const registroId = `${hoy}_${matricula}`;
    
    try {
        const alumnoDoc = await db.collection("alumnos").doc(matricula).get();

        if (!alumnoDoc.exists || alumnoDoc.data().estatus_escolar !== "Activo") {
            if (typeof sonidoError !== 'undefined') sonidoError.play();
            dispararToastNotificacion('Error de Validación', 'QR no reconocido o inactivo', 'error');
            procesandoEscaneo = false; 
            return;
        }
				
        const al = alumnoDoc.data();
        const registroRef = db.collection("registros_diarios").doc(registroId);
        const regDoc = await registroRef.get();

        const configEscolar = await db.collection("configuracion").doc("escolar").get();
        const configData = configEscolar.data();
        const salidaGeneralActiva = (configData?.salidaGeneralAutorizada === true) && (configData?.fechaSalidaGeneral === hoy);

        // Orquestación de estados lógicos: ENTRADA / SALIDA
        if (!regDoc.exists || regDoc.data().estatus_actual === "FUERA") {
            await registroRef.set({
                matricula, nombre: al.nombre, especialidad: al.especialidad, grado: al.grado, grupo: al.grupo, fecha: hoy,
                hora_entrada: new Date().toLocaleTimeString(), estatus_actual: "DENTRO"
            }, { merge: true });

            await db.collection("alumnos").doc(matricula).update({ estado: "DENTRO", fecha_ultima_asistencia: hoy });
            mostrarResultado(al, "ENTRADA");

            if (!esManual && typeof enviarNotificacionTutor === 'function') enviarNotificacionTutor(al, "ENTRADA");

        } else if (regDoc.data().estatus_actual === "DENTRO") {
            await validarSalida(al, registroRef, salidaGeneralActiva);
        }
    } catch (e) { 
        console.error("Error crítico en lazo central de escaneo:", e); 
    } finally {
        setTimeout(() => { procesandoEscaneo = false; }, 1000);
    }
}

/**
 * Validación y matching dinámico de pases individuales y grupales en la nube
 */
async function validarSalida(al, registroRef, salidaGeneralActiva) {
    const gpoKey = `${al.grado}${al.grupo}-${al.especialidad}`;
    const tienePase = pasesIndividualesHoy.includes(al.matricula) || gruposAutorizadosHoy.includes(gpoKey);

    if (tienePase || salidaGeneralActiva) {
        let motivo = tienePase ? "PASE AUTORIZADO" : "SALIDA GENERAL";
        let colorBanda = tienePase ? "#198754" : "#0d6efd";

        await registroRef.update({ hora_salida: new Date().toLocaleTimeString(), estatus_actual: "FUERA", tipo_salida: motivo });
        await db.collection("alumnos").doc(al.matricula).update({ estado: "FUERA" });

        mostrarResultado(al, "SALIDA");
        if (document.getElementById('bandaEstatus')) document.getElementById('bandaEstatus').style.backgroundColor = colorBanda;
        if (typeof enviarNotificacionTutor === 'function') enviarNotificacionTutor(al, "SALIDA");

    } else {
        if (typeof sonidoError !== 'undefined') sonidoError.play();
        if (document.getElementById('bandaEstatus')) document.getElementById('bandaEstatus').style.backgroundColor = "#dc3545";

        Swal.fire({
            icon: 'error', title: 'SALIDA DENEGADA', html: 'El alumno no cuenta con pases de salida vigentes.',
            position: 'bottom-end', toast: true, width: '800px', padding: '3rem', timer: 4500, showConfirmButton: false 
        });
    }
}

/**
 * Inicialización optimizada del motor neuronal Face-API.js
 * Poda de forma matemática el array lineal reduciendo comparaciones Euclidianeas innecesarias en CPU.
 */
async function inicializarMotorFacial() {
    try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
            const rutaModelos = window.location.origin + '/models';
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(rutaModelos),
                faceapi.nets.faceLandmark68Net.loadFromUri(rutaModelos),
                faceapi.nets.faceRecognitionNet.loadFromUri(rutaModelos)
            ]);
        }

        const descriptoresEtiquetados = [];
        const horaActual = new Date().getHours(); 

        alumnosCache.forEach(al => {
            if (al.descriptor_facial && al.descriptor_facial.length === 128) {
                // PODA PREDICTIVA: Filtra alumnos vespertinos en horarios matutinos (Optimización de O(N) a O(M))
                const esVespertino = (al.turno && al.turno.toUpperCase() === 'VESPERTINO');
                if (horaActual < 10 && esVespertino && modoEscaneoFacial !== 'SALIDA') return; 

                if (modoEscaneoFacial === 'ENTRADA' && al.estado === 'DENTRO') return;
                else if (modoEscaneoFacial === 'SALIDA' && al.estado !== 'DENTRO') return;

                const floatArray = new Float32Array(al.descriptor_facial);
                descriptoresEtiquetados.push(new faceapi.LabeledFaceDescriptors(al.matricula, [floatArray]));
            }
        });

        faceMatcher = descriptoresEtiquetados.length > 0 ? new faceapi.FaceMatcher(descriptoresEtiquetados, 0.45) : null;
    } catch (error) { console.error("Error de inicialización en red neuronal:", error); }
}

/**
 * Bucle asíncrono de renderizado de fotogramas y cálculo de distancias vectoriales (Face Matching)
 */
async function procesarFotogramasFaciales() {
    const video = document.getElementById('videoReconocimiento');
    const canvas = document.getElementById('canvasOverlayFacial');
    if (video.paused || video.ended || !escaneoFacialActivo) return;

    try {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        if (canvas.width !== displaySize.width) faceapi.matchDimensions(canvas, displaySize);

        const opcionesDeteccion = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        const deteccion = await faceapi.detectSingleFace(video, opcionesDeteccion).withFaceLandmarks().withFaceDescriptor();
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (deteccion && faceMatcher) {
            const deteccionAjustada = faceapi.resizeResults(deteccion, displaySize);
            const coincidencia = faceMatcher.findBestMatch(deteccion.descriptor);
            
            const esConocido = coincidencia.label !== 'unknown';
            const colorCaja = esConocido ? '#198754' : '#dc3545';
            const textoCaja = esConocido ? coincidencia.label : 'ROSTRO DESCONOCIDO';

            // Dibujado del bounding box dinámico sobre el Canvas Overlay
            new faceapi.draw.DrawBox(deteccionAjustada.detection.box, { label: textoCaja, boxColor: colorCaja, lineWidth: 3 }).draw(canvas);

            if (!Swal.isVisible()) {
                const ahora = Date.now();
                if (esConocido) {
                    const matriculaIdentificada = coincidencia.label;
                    if (ultimoRostroDetectado.matricula !== matriculaIdentificada || (ahora - ultimoRostroDetectado.tiempo) > 5000) {
                        ultimoRostroDetectado = { matricula: matriculaIdentificada, tiempo: ahora };
                        onScanSuccess(matriculaIdentificada, false);
                    }
                } else if (ahora - ultimoDesconocido > 4000) {
                    ultimoDesconocido = ahora;
                    if (typeof sonidoError !== 'undefined') sonidoError.play();
                    dispararToastNotificacion('ROSTRO DESCONOCIDO', 'No se encontró registro biométrico válido.', 'error', 3000);
                }
            }
        } else if (deteccion && !faceMatcher) {
            const deteccionAjustada = faceapi.resizeResults(deteccion, displaySize);
            new faceapi.draw.DrawBox(deteccionAjustada.detection.box, { label: "ESPERANDO MATRIZ...", boxColor: "#ffc107", lineWidth: 3 }).draw(canvas);
        }
    } catch (e) { console.error("Fallo de captura en frame facial:", e); }

    if (escaneoFacialActivo) setTimeout(procesarFotogramasFaciales, 2000);
}

function dispararToastNotificacion(title, text, icon, timer = 4000) {
    Swal.fire({ icon, title, text, position: 'bottom-end', toast: true, width: '700px', timer, showConfirmButton: false });
}

async function cambiarModoFacial(modo) {
    modoEscaneoFacial = modo;
    await inicializarMotorFacial();
}
