package com.xy.material.support;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.ImageIO;

/**
 * 测试用真实 JPEG/PNG 字节，避免依赖仓库里的示例素材。
 */
public final class TestImages {

    static {
        System.setProperty("java.awt.headless", "true");
    }

    private TestImages() {
    }

    public static byte[] jpeg() {
        return image("jpg");
    }

    public static byte[] png() {
        return image("png");
    }

    private static byte[] image(String format) {
        BufferedImage image = new BufferedImage(24, 24, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(40, 120, 200));
        graphics.fillRect(0, 0, 24, 24);
        graphics.dispose();

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try {
            if (!ImageIO.write(image, format, output)) {
                throw new IllegalStateException("No ImageIO writer for " + format);
            }
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
        return output.toByteArray();
    }
}
