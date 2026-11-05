package com.xy.material.asset;

import com.xy.material.common.ApiException;
import com.xy.material.common.ErrorCodes;
import com.xy.material.files.FileUrlSigner;
import com.xy.material.template.TemplateDetailDto;
import com.xy.material.template.TemplateService;
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AssetService {

    private final AssetMapper assetMapper;
    private final TemplateService templateService;
    private final AssetStorage assetStorage;
    private final FileUrlSigner fileUrlSigner;

    public AssetService(AssetMapper assetMapper,
                        TemplateService templateService,
                        AssetStorage assetStorage,
                        FileUrlSigner fileUrlSigner) {
        this.assetMapper = assetMapper;
        this.templateService = templateService;
        this.assetStorage = assetStorage;
        this.fileUrlSigner = fileUrlSigner;
    }

    public AssetDto upload(long userId, String templateId, MultipartFile file) {
        if (templateId == null || templateId.isBlank()) {
            throw ApiException.validation("templateId 不能为空");
        }

        TemplateDetailDto template = templateService.getTemplate(templateId);
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("文件不能为空");
        }
        if (file.getSize() > template.maxFileSizeBytes()) {
            throw fileTooLarge(template.maxFileSizeBytes());
        }

        ImageFileType type = detectType(file);
        if (!template.acceptedMimeTypes().contains(type.mimeType())) {
            throw ApiException.unsupportedFileType("该模板不接受 " + type.mimeType()
                    + "，仅接受: " + String.join(", ", template.acceptedMimeTypes()));
        }

        String originalFilename = sanitizeOriginalFilename(file.getOriginalFilename());
        AssetStorage.StoredFile stored = assetStorage.store(file, type);

        Asset asset = new Asset();
        asset.setUserId(userId);
        asset.setTemplateId(template.id());
        asset.setStorageKey(stored.storageKey());
        asset.setOriginalFilename(originalFilename);
        asset.setMimeType(type.mimeType());
        asset.setSizeBytes(stored.sizeBytes());
        asset.setCreatedAt(LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS));

        try {
            if (stored.sizeBytes() > template.maxFileSizeBytes()) {
                throw fileTooLarge(template.maxFileSizeBytes());
            }
            int rows = assetMapper.insert(asset);
            if (rows != 1) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "素材记录保存失败");
            }
        } catch (RuntimeException exception) {
            assetStorage.deleteQuietly(stored.path());
            throw exception;
        }

        return AssetDto.from(asset, fileUrlSigner);
    }

    /**
     * B3 复用：按 (userId, assetIds) 查询属于当前用户的素材。
     * 不返回其他用户的素材；空集合直接返回空列表。
     */
    public List<Asset> findOwnedAssets(long userId, Collection<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return List.of();
        }
        List<Long> ids = assetIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        return assetMapper.findByUserIdAndIds(userId, ids);
    }

    private static ImageFileType detectType(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return ImageFileType.detect(input)
                    .orElseThrow(() -> ApiException.unsupportedFileType(
                            "无法识别的图片类型，仅支持 JPEG、PNG、WebP"));
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "读取上传文件失败");
        }
    }

    private static ApiException fileTooLarge(long maxBytes) {
        return ApiException.fileTooLarge("文件大小超过模板上限（" + maxBytes + " 字节）");
    }

    /**
     * 原始文件名只用于展示：去掉路径部分、控制字符并截断到 255 字符，绝不参与存储路径。
     */
    private static String sanitizeOriginalFilename(String originalFilename) {
        if (originalFilename == null) {
            return null;
        }
        String name = originalFilename.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = name.replaceAll("[\\p{Cntrl}]", "_").trim();
        if (name.isEmpty()) {
            return null;
        }
        return name.length() <= 255 ? name : name.substring(0, 255);
    }
}
