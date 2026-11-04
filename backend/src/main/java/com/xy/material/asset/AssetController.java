package com.xy.material.asset;

import com.xy.material.user.CurrentUser;
import com.xy.material.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @PostMapping(value = "/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AssetDto> upload(
            @RequestParam("templateId") String templateId,
            @RequestParam("file") MultipartFile file,
            @CurrentUser User currentUser) {
        AssetDto asset = assetService.upload(currentUser.getId(), templateId, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(asset);
    }
}
