package com.xy.material.files;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 为 /files/** 生成和校验签名 URL。
 *
 * <p>签名内容为 {@code path + "\n" + exp} 的 HMAC-SHA256，再 base64url（无 padding）。
 * exp 取整点窗口：{@code ((epochSecond / 3600) + 2) * 3600}，即下一个整点再加 1 小时；
 * 同一小时内 exp 不变，所以轮询返回的 URL 稳定，不会导致 img 反复重载。
 */
@Component
public class FileUrlSigner {

    private static final Logger log = LoggerFactory.getLogger(FileUrlSigner.class);
    private static final long WINDOW_SECONDS = 3600L;
    private static final int SECRET_BYTES = 32;
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String FILES_PREFIX = "/files/";

    private final byte[] secret;
    private final Clock clock;

    @Autowired
    public FileUrlSigner(FileSigningProperties properties) {
        this(properties.signingSecret(), Clock.systemUTC());
    }

    FileUrlSigner(String configuredSecret, Clock clock) {
        this.clock = clock;
        if (configuredSecret == null || configuredSecret.isBlank()) {
            byte[] random = new byte[SECRET_BYTES];
            new SecureRandom().nextBytes(random);
            this.secret = random;
            log.warn("APP_FILES_SIGNING_SECRET is not configured; generated an ephemeral key. "
                    + "Signed /files URLs will become invalid after restart.");
        } else {
            this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
        }
    }

    public String sign(String path) {
        if (path == null || !path.startsWith(FILES_PREFIX)) {
            return path;
        }
        long exp = expiry(clock.instant());
        String separator = path.contains("?") ? "&" : "?";
        return path + separator + "exp=" + exp + "&sig=" + signature(path, exp);
    }

    public boolean verify(String path, long exp, String signature) {
        if (path == null || !path.startsWith(FILES_PREFIX)
                || signature == null || signature.isBlank()) {
            return false;
        }
        if (exp <= clock.instant().getEpochSecond()) {
            return false;
        }
        String expected = signature(path, exp);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    String signature(String path, long exp) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            byte[] digest = mac.doFinal((path + "\n" + exp).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to compute HMAC-SHA256 signature", exception);
        }
    }

    private static long expiry(Instant now) {
        return ((now.getEpochSecond() / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
    }
}
