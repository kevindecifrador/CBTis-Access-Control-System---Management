# CBTis 134 - Sistema Inteligente de Control de Accesos y Gestión Escolar 🚀

Ecosistema web integral y autónomo diseñado para automatizar el control de accesos multifactorial y centralizar la gestión administrativa, conductual y médica de más de **1,800 alumnos** en el CBTis 134.

## 📌 El Problema
Las instituciones educativas masivas enfrentan graves problemas de seguridad y lentitud en sus accesos debido al registro manual de entradas y salidas. Esto genera cuellos de botella en las puertas del plantel, falta de trazabilidad en las salidas autorizadas, retraso en el reporte de incidencias conductuales (Prefectura/Orientación) y una desconexión crítica en la comunicación inmediata con los padres de familia.

## 💡 La Solución
Una plataforma web centralizada de alto rendimiento que unifica la seguridad perimetral y la administración escolar a través de tres pilares:
1. **Identificación Multifactorial en Tiempo Real:** El sistema procesa flujos de video mediante una **webcam local** para realizar escaneo instantáneo de códigos QR y reconocimiento facial biométrico (**Face-ID**) sin requerir hardware externo costoso.
2. **Gestión Escolar de 360°:** Automatiza el seguimiento conductual, reportes de prefectura, orientación educativa, justificantes y el monitoreo de salud de los estudiantes.
3. **Núcleo de Notificaciones Automatizadas:** Backend encargado de procesar la lógica de negocio, generar pases de salida dinámicos en PDF y disparar alertas en tiempo real a los tutores mediante la **API de WhatsApp**.

---

## 🛠️ Stack Tecnológico & Arquitectura Interna

### Backend & Seguridad (Java)
* **Java SE 17 & Spring Boot:** Motor central encargado de la lógica transaccional, servicios del sistema y la API REST.
* **Spring Security & Firebase Token Filter:** Arquitectura de seguridad perimetral basada en filtros personalizados para la validación y protección de rutas institucionales.
* **WhatsApp Controller:** Integración nativa con pasarelas de mensajería para alertas automatizadas de accesos y justificantes.

### Frontend & Visión por Computadora (Client-Side)
* **HTML5, CSS3, Bootstrap & JavaScript (ES6+):** Interfaz administrativa responsiva y dinámica.
* **Modelos Biométricos Embebidos (Face API / MobileNet):** Procesamiento local en el navegador para tareas críticas de visión artificial:
  * `ssd_mobilenetv1`: Detección precisa de rostros en el flujo de video.
  * `face_landmark_68`: Mapeo de puntos faciales clave para alineación.
  * `face_recognition_model`: Reconocimiento e identificación de identidad contra la base de datos.

### Persistencia & Integraciones Cloud
* **Firebase Realtime Database:** Sincronización instantánea de eventos y logs de acceso con latencia cercana a cero.
* **Firebase Config & Service Account Key:** Gestión segura de las credenciales de la infraestructura en la nube.
* **Excel Data Management:** Módulo dedicado para la carga masiva y parseo de datos de alumnos mediante hojas de cálculo (`gestion_excel.js`).

---

## 🏗️ Módulos Integrados del Sistema

El sistema cuenta con una arquitectura de vistas y controladores segmentada por roles y necesidades del plantel:

* **Módulo de Escaneo Inteligente:** Interfaz unificada de lectura (Webcam) para autenticación por QR y validación por Face-ID.
* **Control de Incidencias (Prefectura y Orientación):** Captura y seguimiento digital de reportes de conducta e incidencias internas por alumno.
* **Seguimiento Conductual y Monitoreo de Salud:** Bitácora histórica del comportamiento del estudiante y registro de alertas o condiciones médicas en el módulo de salud.
* **Gestión de Justificantes y Pases de Salida:** Emisión digital de permisos temporales y definitivos con validación automatizada hacia los tutores.
* **Carga Masiva de Alumnos:** Interfaz administrativa que permite la importación de archivos Excel para registrar y normalizar los datos de los estudiantes de forma 100% automatizada.

---

## ⚙️ Estructura del Proyecto

El código fuente está organizado bajo patrones de diseño limpios y separación de responsabilidades:

src/main/

├── java/com/cbtis134/sistema/

│   ├── config/          # Configuraciones de Firebase y Seguridad de Spring

│   ├── controller/      # Controladores REST y de Vistas (WhatsApp, Vistas Web)

│   └── security/        # Filtros de autenticación por Token de Firebase

└── resources/

├── static/

│   ├── js/          # Lógica del cliente, módulos de incidencias y escaneo

│   └── models/      # Shards y manifiestos de los modelos de visión artificial

└── templates/       # Vistas HTML organizadas por administración y autenticación

## 🛡️ Prácticas de Seguridad de Datos
Las llaves privadas de conexión (`serviceAccountKey.json`) y las propiedades críticas del entorno se gestionan mediante variables de entorno en producción. Este repositorio omite explícitamente cualquier credencial confidencial para cumplir con los estándares de seguridad de software y protección de datos institucionales.
