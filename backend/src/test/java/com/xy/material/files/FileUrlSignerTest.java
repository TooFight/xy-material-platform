package com.xy.material.files;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class FileUrlSignerTest {

    private static final String PATH = "/files/assets/abc.png";
    private static final Instant NOW = Instant.parse("2026-11-05T10:15:00Z");
    private static final FileUrlSigner SIGNER =
            new FileUrlSigner("test-secret", Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void signsWithStableHourlyWindowAndVerifies() {
        String first = SIGNER.sign(PATH);
        String second = SIGNER.sign(PATH);

        assertThat(second).isEqualTo(first);
        assertThat(first).matches(PATH + "\\?exp=\\d+&sig=[A-Za-z0-9_-]+");
        long exp = expOf(first);
        assertThat(exp).isEqualTo(Instant.parse("2026-11-05T12:00:00Z").getEpochSecond());
        assertThat(SIGNER.verify(PATH, exp, sigOf(first))).isTrue();
    }

    @Test
    void rejectsTamperedMissingAndExpiredSignature() {
        String url = SIGNER.sign(PATH);
        long exp = expOf(url);
        String signature = sigOf(url);

        assertThat(SIGNER.verify(PATH, exp, signature + "x")).isFalse();
        assertThat(SIGNER.verify(PATH, exp, "")).isFalse();

        long expired = NOW.getEpochSecond() - 1;
        String expiredSignature = SIGNER.signature(PATH, expired);
        assertThat(SIGNER.verify(PATH, expired, expiredSignature)).isFalse();
    }

    @Test
    void nextHourBoundaryStartsANewWindow() {
        FileUrlSigner later = new FileUrlSigner(
                "test-secret", Clock.fixed(Instant.parse("2026-11-05T11:00:00Z"), ZoneOffset.UTC));
        String url = later.sign(PATH);
        assertThat(expOf(url))
                .isEqualTo(Instant.parse("2026-11-05T13:00:00Z").getEpochSecond());
    }

    private static long expOf(String url) {
        int start = url.indexOf("exp=") + 4;
        int end = url.indexOf("&sig=");
        return Long.parseLong(url.substring(start, end));
    }

    private static String sigOf(String url) {
        return url.substring(url.indexOf("&sig=") + 5);
    }
}
