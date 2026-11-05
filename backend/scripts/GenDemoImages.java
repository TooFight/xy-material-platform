import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

/**
 * 生成演示图片（纯色/渐变背景 + 文字，全部由 JDK 自带 AWT 绘制，无版权问题）。
 *
 * <p>模板封面（static/demo/covers/*.jpg）不由本脚本生成：它们是来自 Unsplash 的免费授权照片，
 * 来源与作者见根目录 README 的「素材、脚手架与开源来源」一节。
 *
 * <p>用法（需要 JDK 21）：
 * <pre>
 *   cd backend
 *   java scripts/GenDemoImages.java
 * </pre>
 * 也可以在仓库根目录执行 {@code java backend/scripts/GenDemoImages.java}。
 *
 * <p>输出：
 * <ul>
 *   <li>backend/src/main/resources/static/demo/results/ 下 7 张示例结果图（800x600 PNG）</li>
 *   <li>docs/sample-images/ 下 4 张上传测试图（JPEG/PNG）与 fake.jpg（文本改名，用于类型校验演示）</li>
 * </ul>
 */
public final class GenDemoImages {

    private static final int WIDTH = 800;
    private static final int HEIGHT = 600;
    private static final long MAX_DEMO_BYTES = 200L * 1024L;

    private static record Template(String slug, String title, String category, Color from, Color to) {
    }

    private static final List<Template> TEMPLATES = List.of(
            new Template("postcard", "旅行明信片", "创意图片",
                    new Color(255, 152, 102), new Color(214, 69, 65)),
            new Template("polaroid", "拍立得相框", "创意图片",
                    new Color(120, 198, 255), new Color(41, 98, 255)),
            new Template("comic", "漫画分镜", "创意图片",
                    new Color(255, 224, 102), new Color(245, 124, 0)),
            new Template("spring-card", "新春贺卡", "节日贺卡",
                    new Color(244, 100, 95), new Color(155, 20, 30)),
            new Template("birthday", "生日祝福", "节日贺卡",
                    new Color(205, 130, 220), new Color(94, 26, 140)),
            new Template("grid9", "九宫格海报", "拼图海报",
                    new Color(77, 196, 180), new Color(0, 96, 88)),
            new Template("poster", "双图对比海报", "拼图海报",
                    new Color(150, 170, 185), new Color(52, 68, 82))
    );

    private static String fontFamily = Font.SANS_SERIF;

    private GenDemoImages() {
    }

    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        Path workingDir = Path.of("").toAbsolutePath();
        Path backendDir;
        if (Files.isDirectory(workingDir.resolve("backend/src/main/resources"))) {
            // 从仓库根目录运行：java backend/scripts/GenDemoImages.java
            backendDir = workingDir.resolve("backend");
        } else if (Files.isDirectory(workingDir.resolve("src/main/resources"))) {
            // 从 backend/ 运行：java scripts/GenDemoImages.java
            backendDir = workingDir;
        } else if (Files.isDirectory(workingDir.resolve("../src/main/resources"))) {
            // 从 backend/scripts/ 运行：java GenDemoImages.java
            backendDir = workingDir.resolve("..").normalize();
        } else {
            throw new IllegalStateException(
                    "请在仓库根目录、backend/ 或 backend/scripts/ 下运行本脚本");
        }
        Path resultsDir = backendDir.resolve("src/main/resources/static/demo/results");
        Path samplesDir = backendDir.resolve("../docs/sample-images").normalize();
        Files.createDirectories(resultsDir);
        Files.createDirectories(samplesDir);

        fontFamily = pickFontFamily();
        System.out.println("Font family: " + fontFamily);

        for (int index = 0; index < TEMPLATES.size(); index++) {
            Template template = TEMPLATES.get(index);
            Path result = resultsDir.resolve(template.slug() + ".png");
            writePng(renderResult(template, index), result);
            ensureDemoSize(result);
            System.out.printf("  %-14s result=%6d B%n", template.slug(), Files.size(result));
        }

        writeJpeg(renderSample("示例素材 · 海滩", new Color(90, 190, 230), new Color(20, 90, 160),
                1200, 800, 1), samplesDir.resolve("sample-beach.jpg"));
        writePng(renderSample("示例素材 · 城市", new Color(170, 140, 230), new Color(70, 40, 130),
                800, 1200, 2), samplesDir.resolve("sample-city.png"));
        writeJpeg(renderSample("示例素材 · 美食", new Color(255, 190, 110), new Color(190, 70, 30),
                1200, 800, 3), samplesDir.resolve("sample-food.jpg"));
        writePng(renderSample("示例素材 · 公园", new Color(150, 220, 140), new Color(30, 110, 70),
                1200, 800, 4), samplesDir.resolve("sample-park.png"));

        String fakeText = """
                这不是一张图片。

                This is a plain-text file renamed to fake.jpg on purpose.
                It is used to demonstrate that upload validation reads magic numbers,
                not the file extension or the browser-provided Content-Type.
                """;
        Files.writeString(samplesDir.resolve("fake.jpg"), fakeText, StandardCharsets.UTF_8);

        System.out.println("Generated demo images in " + resultsDir);
        System.out.println("Generated sample images in " + samplesDir);
    }

    private static BufferedImage renderResult(Template template, int index) {
        BufferedImage image = newImage();
        Graphics2D graphics = image.createGraphics();
        paintBackground(graphics, template, index);
        drawDecorations(graphics, index, false);

        graphics.setComposite(AlphaComposite.SrcOver);
        graphics.setColor(new Color(30, 30, 30, 55));
        graphics.fillRoundRect(188, 152, 440, 330, 26, 26);
        graphics.setColor(Color.WHITE);
        graphics.fillRoundRect(170, 135, 440, 330, 26, 26);
        graphics.setPaint(new GradientPaint(190, 155, template.from(), 590, 445, template.to()));
        graphics.fillRoundRect(190, 155, 400, 260, 18, 18);

        graphics.setColor(new Color(255, 255, 255, 210));
        graphics.setStroke(new BasicStroke(3f));
        graphics.drawRoundRect(190, 155, 400, 260, 18, 18);

        drawCentered(graphics, template.title(), WIDTH / 2, 505, fitFont(graphics, template.title(), 520, Font.BOLD, 38),
                Color.WHITE);
        drawCentered(graphics, "示例结果 · 模拟生成", WIDTH / 2, 548,
                new Font(fontFamily, Font.PLAIN, 20), new Color(255, 255, 255, 210));

        Font badgeFont = new Font(fontFamily, Font.BOLD, 15);
        graphics.setFont(badgeFont);
        FontMetrics badgeMetrics = graphics.getFontMetrics();
        String badgeText = "SAMPLE RESULT";
        int badgeWidth = badgeMetrics.stringWidth(badgeText) + 36;
        graphics.setColor(new Color(255, 255, 255, 225));
        graphics.fillRoundRect(60, 40, badgeWidth, 40, 20, 20);
        graphics.setColor(template.to().darker());
        graphics.drawString(badgeText, 60 + 18, 66);

        graphics.dispose();
        return image;
    }

    private static BufferedImage renderSample(String label, Color from, Color to, int width, int height, int seed) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        quality(graphics);
        graphics.setPaint(new GradientPaint(0, 0, from, width, height, to));
        graphics.fillRect(0, 0, width, height);

        Random random = new Random(seed * 97L + 11);
        for (int i = 0; i < 9; i++) {
            int radius = 90 + random.nextInt(Math.max(1, width / 4));
            int x = random.nextInt(Math.max(1, width - radius));
            int y = random.nextInt(Math.max(1, height - radius));
            graphics.setColor(new Color(255, 255, 255, 18 + random.nextInt(24)));
            graphics.fillOval(x, y, radius, radius);
        }
        graphics.setColor(new Color(255, 255, 255, 80));
        graphics.setStroke(new BasicStroke(2f));
        for (int i = 0; i < 5; i++) {
            int offset = i * 60 + 20;
            graphics.drawLine(offset, 0, offset + width / 3, height);
        }

        graphics.setColor(new Color(0, 0, 0, 55));
        graphics.fillRoundRect(width / 2 - 210 + 4, height / 2 - 55 + 4, 420, 110, 32, 32);
        graphics.setColor(new Color(255, 255, 255, 210));
        graphics.fillRoundRect(width / 2 - 210, height / 2 - 55, 420, 110, 32, 32);

        Font font = fitFont(graphics, label, 360, Font.BOLD, 36);
        drawCentered(graphics, label, width / 2, height / 2 + 14, font, new Color(45, 45, 45));
        graphics.setFont(new Font(fontFamily, Font.PLAIN, 16));
        FontMetrics metrics = graphics.getFontMetrics();
        String caption = "SAMPLE IMAGE";
        graphics.setColor(new Color(90, 90, 90));
        graphics.drawString(caption, width / 2 - metrics.stringWidth(caption) / 2, height / 2 + 48);

        graphics.dispose();
        return image;
    }

    private static void paintBackground(Graphics2D graphics, Template template, int index) {
        quality(graphics);
        graphics.setPaint(new GradientPaint(0, 0, template.from(), WIDTH, HEIGHT, template.to()));
        graphics.fillRect(0, 0, WIDTH, HEIGHT);

        graphics.setPaint(new GradientPaint(0, 0, new Color(255, 255, 255, 26),
                WIDTH, HEIGHT, new Color(0, 0, 0, 20)));
        graphics.fillRect(0, 0, WIDTH, HEIGHT);
    }

    private static void drawDecorations(Graphics2D graphics, int index, boolean cover) {
        Random random = new Random(index * 131L + 7);
        graphics.setComposite(AlphaComposite.SrcOver);
        for (int i = 0; i < 7; i++) {
            int radius = 70 + random.nextInt(150);
            int x = random.nextInt(WIDTH + 100) - 100;
            int y = random.nextInt(HEIGHT + 100) - 100;
            graphics.setColor(new Color(255, 255, 255, 14 + random.nextInt(18)));
            graphics.fillOval(x, y, radius, radius);
        }
        graphics.setColor(new Color(255, 255, 255, 22));
        graphics.setStroke(new BasicStroke(1.5f));
        for (int i = -2; i < 7; i++) {
            int offset = i * 130;
            graphics.drawLine(offset, 0, offset + 220, HEIGHT);
        }
        if (!cover) {
            graphics.setColor(new Color(0, 0, 0, 18));
            graphics.fillRoundRect(0, HEIGHT - 90, WIDTH, 90, 0, 0);
        }
    }

    private static void drawCentered(Graphics2D graphics, String text, int centerX, int baselineY, Font font, Color color) {
        graphics.setFont(font);
        FontMetrics metrics = graphics.getFontMetrics();
        int x = centerX - metrics.stringWidth(text) / 2;
        graphics.setColor(new Color(0, 0, 0, 65));
        graphics.drawString(text, x + 3, baselineY + 3);
        graphics.setColor(color);
        graphics.drawString(text, x, baselineY);
    }

    private static Font fitFont(Graphics2D graphics, String text, int maxWidth, int style, int startSize) {
        int size = startSize;
        Font font = new Font(fontFamily, style, size);
        while (size > 18 && graphics.getFontMetrics(font).stringWidth(text) > maxWidth) {
            size -= 2;
            font = new Font(fontFamily, style, size);
        }
        return font;
    }

    private static BufferedImage newImage() {
        return new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
    }

    private static void quality(Graphics2D graphics) {
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    }

    private static String pickFontFamily() {
        Set<String> available = new HashSet<>(Arrays.asList(
                GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames(Locale.ROOT)));
        List<String> candidates = new ArrayList<>(List.of(
                "Microsoft YaHei", "Microsoft YaHei UI", "SimHei", "Noto Sans CJK SC",
                "Source Han Sans SC", "PingFang SC", "WenQuanYi Micro Hei", "SansSerif"));
        for (String candidate : candidates) {
            if (available.contains(candidate)) {
                return candidate;
            }
        }
        return Font.SANS_SERIF;
    }

    private static void writePng(BufferedImage image, Path target) throws IOException {
        Files.createDirectories(target.getParent());
        try (OutputStream output = Files.newOutputStream(target)) {
            if (!ImageIO.write(image, "png", output)) {
                throw new IOException("No PNG writer available");
            }
        }
    }

    private static void writeJpeg(BufferedImage image, Path target) throws IOException {
        Files.createDirectories(target.getParent());
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam parameter = writer.getDefaultWriteParam();
        parameter.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        parameter.setCompressionQuality(0.9f);
        try (ImageOutputStream output = ImageIO.createImageOutputStream(target.toFile())) {
            writer.setOutput(output);
            writer.write(null, new IIOImage(image, null, null), parameter);
        } finally {
            writer.dispose();
        }
    }

    private static void ensureDemoSize(Path image) throws IOException {
        long size = Files.size(image);
        if (size >= MAX_DEMO_BYTES) {
            throw new IllegalStateException("Demo image exceeds 200KB: " + image + " (" + size + " B)");
        }
    }
}
