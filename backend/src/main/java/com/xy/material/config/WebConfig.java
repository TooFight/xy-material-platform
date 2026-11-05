package com.xy.material.config;

import com.xy.material.files.FileSigningProperties;
import com.xy.material.task.simulation.SimulationProperties;
import com.xy.material.user.CurrentUserArgumentResolver;
import com.xy.material.user.UserInterceptor;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.lang.NonNull;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties({
        CorsProperties.class,
        StorageProperties.class,
        SimulationProperties.class,
        TaskExecutorProperties.class,
        FileSigningProperties.class
})
public class WebConfig implements WebMvcConfigurer {

    /**
     * 不需要 X-User-Id 的公开路径，见 docs/api.md §0.1。
     */
    private static final String[] PUBLIC_PATHS = {
            "/api/health",
            "/api/users",
            "/api/template-categories",
            "/api/templates",
            "/api/templates/**",
            "/api/dev/**",
            "/demo/**",
            "/files/**",
            "/error"
    };

    private final CorsProperties corsProperties;
    private final UserInterceptor userInterceptor;

    public WebConfig(CorsProperties corsProperties, UserInterceptor userInterceptor) {
        this.corsProperties = corsProperties;
        this.userInterceptor = userInterceptor;
    }

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(corsProperties.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Accept", "Content-Type", "X-User-Id")
                .exposedHeaders(HttpHeaders.LOCATION)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(userInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(PUBLIC_PATHS);
    }

    /**
     * api.md §0.2 约定响应为 application/json; charset=utf-8；
     * Jackson 转换器默认不带 charset 参数，这里显式补上。
     */
    @Override
    public void extendMessageConverters(@NonNull List<HttpMessageConverter<?>> converters) {
        converters.stream()
                .filter(MappingJackson2HttpMessageConverter.class::isInstance)
                .map(MappingJackson2HttpMessageConverter.class::cast)
                .forEach(converter -> converter.setDefaultCharset(StandardCharsets.UTF_8));
    }

    @Override
    public void addArgumentResolvers(@NonNull List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());
    }
}
