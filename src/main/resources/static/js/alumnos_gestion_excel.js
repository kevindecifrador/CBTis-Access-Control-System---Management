/**
 * CBTis 134 - Core Data Normalization & Batch Ingestion Engine
 * @author Kevin Sánchez (2026)
 * * Gestiona la lectura asíncrona de flujos binarios binarios de hojas Excel (.xlsx),
 * ejecutando sanitización de llaves en tiempo de ejecución, parseo de nombres compuestos
 * y persistencia por lotes (Batch Loading) tolerante a duplicados en Firestore.
 */

let jsonDatosPendientes = null;

async function procesarCargaMasiva() {
    const input = document.getElementById('excelInput');
    const file = input.files[0];
    if (!file) return Swal.fire("Aviso", "Selecciona un archivo .xlsx", "warning");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            Swal.fire({ title: 'Analizando estructura de datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            // Procesamiento del buffer binario local mediante la librería XLSX
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            jsonDatosPendientes = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: "" });

            let posiblesExitos = 0;
            let descartadosPreviamente = 0;
            const regexMatricula = /^\d{14}$/;

            // Pre-evaluación algorítmica y sanitización perimetral
            for (let row of jsonDatosPendientes) {
                const r = Object.keys(row).reduce((acc, key) => { 
                    const cleanKey = key.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
                    acc[cleanKey] = row[key]; 
                    return acc; 
                }, {});
                const matricula = String(r.matricula || r.no_control || "").trim();
                
                if (regexMatricula.test(matricula)) posiblesExitos++;
                else descartadosPreviamente++;
            }

            Swal.hideLoading(); 

            const result = await Swal.fire({
                title: '¿Iniciar importación transaccional?',
                html: `
                    <div class="text-start p-3 bg-light rounded border">
                        <p class="mb-1"><strong>Archivo origen:</strong> ${file.name}</p>
                        <p class="mb-1"><strong>Total filas detectadas:</strong> ${jsonDatosPendientes.length}</p>
                        <hr class="my-2">
                        <p class="mb-1 text-success"><i class="bi bi-check-circle"></i> <strong>Registros estructurados:</strong> ${posiblesExitos}</p>
                        <p class="mb-0 text-danger"><i class="bi bi-exclamation-triangle"></i> <strong>Ignorados (Estructura inválida):</strong> ${descartadosPreviamente}</p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#7b1b37',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="bi bi-cloud-arrow-up"></i> Iniciar Carga',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) ejecutarCargaReal();
            else { jsonDatosPendientes = null; input.value = ""; }

        } catch (err) { Swal.fire("Error de E/S", err.message, "error"); }
    };
    reader.readAsArrayBuffer(file);
}

async function ejecutarCargaReal() {
    const user = firebase.auth().currentUser;
    const adminUID = user.uid;
    const json = jsonDatosPendientes;

    document.getElementById('statusCarga').classList.remove('d-none');
    document.getElementById('btnIniciarCarga').disabled = true;
    document.getElementById('excelInput').disabled = true;
    
    Swal.fire({ title: 'Insertando registros en la nube...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let exitosos = 0, fallos = 0, duplicados = 0;
    const regexMatricula = /^\d{14}$/;

    for (let row of json) {
        // Mapeo dinámico y tipado seguro de las columnas del Excel hacia Snake_Case
        const r = Object.keys(row).reduce((acc, key) => { 
            const cleanKey = key.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
            acc[cleanKey] = row[key]; 
            return acc; 
        }, {});
        
        //RECORTE POR SEGURIDAD

        // Algoritmo de desestructuración de nombres compactados en una sola columna
        if (nombre && !apepat) {
            const partes = nombre.split(" ");
            if (partes.length >= 3) {
                apepat = partes[0];
                apemat = partes[1];
                nombre = partes.slice(2).join(" ");
            }
        }

        if (!regexMatricula.test(matricula)) { fallos++; continue; }

        try {
            const docRef = db.collection("alumnos").doc(matricula);
            const docSnap = await docRef.get();
            
            // Control e interrupción pacífica contra duplicación de llaves primarias
            if (docSnap.exists) { 
                duplicados++; 
                actualizarProgresoInterfaz(exitosos, fallos, duplicados, json.length);
                continue; 
            }

            const nombreCompletoQR = `${nombre} ${apepat} ${apemat}`.trim().toUpperCase();
            const textoUnicoQR = `${matricula}|${nombreCompletoQR}`;

            let especialidadFinal = "POR ASIGNAR";
            let gradoFinal = String(r.grado || "").trim();
            let grupoFinal = String(r.grupo || "").trim().toUpperCase();
            let turnoFinal = "Matutino";

            if (r.gpo) {
                const infoEscolar = normalizarDatosCBTis(r.gpo);
                especialidadFinal = infoEscolar.especialidad;
                gradoFinal = infoEscolar.grado || gradoFinal;
                grupoFinal = infoEscolar.grupo || grupoFinal;
                turnoFinal = infoEscolar.turno;
            } else {
                const excelEsp = String(r.especialidad || r.carrera || "").trim().toUpperCase();
                const configEsp = especialidadesCache.find(e => e.nombre.toUpperCase() === excelEsp || e.alias === excelEsp);

                if (configEsp) {
                    especialidadFinal = configEsp.nombre;
                    turnoFinal = configEsp.turno || "Matutino";
                } else if (excelEsp !== "") {
                    especialidadFinal = excelEsp;
                }
            }

            // Mapeo normalizado hacia el esquema NoSQL destino
            const alumno = {
                //CAMPOS PERTINENTES
            };

            await docRef.set(alumno);
            exitosos++;
            actualizarProgresoInterfaz(exitosos, fallos, duplicados, json.length);

        } catch (err) { 
            fallos++; 
            actualizarProgresoInterfaz(exitosos, fallos, duplicados, json.length);
        }
    }

    Swal.fire({
        icon: 'success', title: 'Ingestión Masiva Finalizada',
        html: `<div class="text-start"> Éxitos: ${exitosos}<br> Duplicados: ${duplicados}<br> Errores: ${fallos}</div>`,
        confirmButtonColor: '#7b1b37'
    }).then(() => location.reload());
}

function actualizarProgresoInterfaz(exitosos, fallos, duplicados, total) {
    const totalProcesados = exitosos + fallos + duplicados;
    const pct = Math.round((totalProcesados / total) * 100);
    document.getElementById('barraProgreso').style.width = pct + "%";
    if(document.getElementById('textoProgreso')) {
        document.getElementById('textoProgreso').innerText = `Procesando registros... ${pct}%`;
    }
}
