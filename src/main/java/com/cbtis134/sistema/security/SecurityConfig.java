package com.cbtis134.sistema.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

import com.cbtis134.sistema.security.FirebaseTokenFilter;

import jakarta.servlet.DispatcherType;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Autowired
    private FirebaseTokenFilter firebaseTokenFilter;

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
	    http
	        .csrf(csrf -> csrf.disable())
	        .authorizeHttpRequests(auth -> auth
	            .dispatcherTypeMatchers(DispatcherType.FORWARD, DispatcherType.ERROR).permitAll()
	            .requestMatchers("/login", "/css/**", "/js/**", "/img/**", "/qrs/**", "/models/**", "/error", "/favicon.ico").permitAll()

	            .requestMatchers("/admin/**").authenticated() 
	            
	            .anyRequest().authenticated()
	        )
	        .addFilterBefore(firebaseTokenFilter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class)
	        .exceptionHandling(ex -> ex
	            .authenticationEntryPoint((request, response, authException) -> {
	                response.sendRedirect("/login");
	            })
	        );
	        
	    return http.build();
	}

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Autenticación por Firebase");
        };
    }
}
