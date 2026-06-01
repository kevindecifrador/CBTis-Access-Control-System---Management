package com.cbtis134.sistema.controller;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp")
public class WhatsappController {

    @PostMapping("/twilio")
    public ResponseEntity<?> enviarMensajeTwilio(@RequestBody Map<String, String> payload) {
        String accountSid = payload.get("accountSid");
        String authToken = payload.get("authToken");
        String to = payload.get("to");
        String from = payload.get("from");
        String body = payload.get("body");

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(accountSid, authToken);

        try {
            String requestBody = "To=" + URLEncoder.encode(to, StandardCharsets.UTF_8.toString()) +
                                 "&From=" + URLEncoder.encode(from, StandardCharsets.UTF_8.toString()) +
                                 "&Body=" + URLEncoder.encode(body, StandardCharsets.UTF_8.toString());

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de Twilio: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de Twilio: " + e.getMessage());
        }
    }

    @PostMapping("/openwa")
    public ResponseEntity<?> enviarMensajeOpenWA(@RequestBody Map<String, String> payload) {

        String apiUrl = payload.get("apiUrl");
        String token = payload.get("token");
        String sessionId = payload.get("sessionId");
        String to = payload.get("to");     
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.contains("/api/")) {
            apiUrl = apiUrl.split("/api/")[0]; 
        }
        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String numeroLimpio = to.replace("whatsapp:", "").replace("+", "");

        String urlFinal = apiUrl + "/api/sessions/" + sessionId + "/messages/send-text";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }

        Map<String, String> jsonMap = Map.of(
            "chatId", numeroLimpio + "@c.us", 
            "text", body
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            System.out.println("[Proxy OpenWA] Disparando a: " + urlFinal);
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de OpenWA: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de OpenWA: " + e.getMessage());
        }
    }
}
