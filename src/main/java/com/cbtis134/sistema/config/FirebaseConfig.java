package com.cbtis134.sistema.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount;

            String pathKey = System.getProperty("firebase.key.path");

            if (pathKey != null && !pathKey.isEmpty()) {
                serviceAccount = new FileInputStream(pathKey);
                System.out.println("=== [FIREBASE SDK] Inicializado desde ruta externa (PROD) ===");
            } else {
                serviceAccount = new ClassPathResource("serviceAccountKey.json").getInputStream();
                System.out.println("=== [FIREBASE SDK] Inicializado desde ClassPath interno (LOCAL/DEV) ===");
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                System.out.println("=================================================");
                System.out.println("¡CONEXIÓN EXITOSA CON FIREBASE - CBTIS 134!");
                System.out.println("=================================================");
            }
        } catch (IOException e) {
            System.err.println("ERROR CRÍTICO: No se pudo conectar con Firebase. " + e.getMessage());
        }
    }
}
