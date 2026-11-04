package com.HotelManager.service;

import com.HotelManager.entity.Room;
import com.HotelManager.entity.RoomImage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Фотографии и удобства номера: сохранение загруженных файлов, порядок фотографий (первая – обложка) и проверка
 * кодов удобств. Файлы с диска не удаляются: имя файла может быть скопировано в брони (reservation.photo).
 */
@Service
public class RoomMediaService {

    /** Предел числа фотографий одного номера и удобств, чтобы форма и карточка оставались разумного размера. */
    public static final int MAX_IMAGES = 12;
    public static final int MAX_AMENITIES = 40;

    private static final Pattern AMENITY_CODE = Pattern.compile("[A-Z0-9_]{2,40}");

    @Value("${upload.img}")
    private String uploadImg;

    /** Допустимые коды удобств в порядке получения; повторы и недопустимые значения отбрасываются. */
    public Set<String> cleanAmenities(List<String> codes) {
        Set<String> result = new LinkedHashSet<>();
        if (codes == null) {
            return result;
        }
        for (String code : codes) {
            if (code != null && AMENITY_CODE.matcher(code.trim()).matches() && result.size() < MAX_AMENITIES) {
                result.add(code.trim());
            }
        }
        return result;
    }

    /** Сохраняет загруженные файлы и возвращает их имена на диске в порядке загрузки; пустые файлы пропускаются. */
    public List<String> store(List<MultipartFile> files) throws IOException {
        List<String> names = new ArrayList<>();
        if (files == null) {
            return names;
        }
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String type = file.getContentType();
            if (type == null || !type.toLowerCase().startsWith("image/")) {
                throw new IOException("«" + file.getOriginalFilename() + "» – не изображение");
            }
            Path dir = Paths.get(uploadImg);
            Files.createDirectories(dir);
            String fileName = UUID.randomUUID() + "_" + safeName(file.getOriginalFilename());
            Files.copy(file.getInputStream(), dir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
            names.add(fileName);
        }
        return names;
    }

    /** Имя файла без пути и служебных символов: в каталог загрузок нельзя записать файл вне него. */
    static String safeName(String original) {
        String name = original == null ? "" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = name.replaceAll("[^\\p{L}\\p{N}._-]", "_");
        if (name.isBlank() || name.startsWith(".")) {
            name = "photo" + name;
        }
        return name.length() > 120 ? name.substring(name.length() - 120) : name;
    }

    /**
     * Приводит фотографии номера к заданному виду: сначала сохраняемые прежние (по порядку {@code keepOrder}; не
     * названные удаляются, {@code null} – оставить все), затем новые файлы. Прежнее поле {@code photo} всегда
     * указывает на обложку (или пусто, если фотографий нет).
     *
     * @throws IllegalArgumentException если фотографий получается больше {@link #MAX_IMAGES}
     */
    public void applyImages(Room room, List<Long> keepOrder, List<String> addedFiles) {
        Map<Long, RoomImage> byId = new LinkedHashMap<>();
        for (RoomImage image : room.getImages()) {
            byId.put(image.getId(), image);
        }
        List<RoomImage> result = new ArrayList<>();
        if (keepOrder == null) {
            result.addAll(room.getImages());
        } else {
            for (Long id : keepOrder) {
                RoomImage image = byId.remove(id);
                if (image != null) {
                    result.add(image);
                }
            }
        }
        for (String fileName : addedFiles) {
            result.add(RoomImage.builder().room(room).fileName(fileName).build());
        }
        if (result.size() > MAX_IMAGES) {
            throw new IllegalArgumentException("У номера может быть не больше " + MAX_IMAGES + " фотографий");
        }
        for (int i = 0; i < result.size(); i++) {
            result.get(i).setPosition(i);
        }
        room.getImages().clear();
        room.getImages().addAll(result);
        room.setPhoto(result.isEmpty() ? "" : result.get(0).getFileName());
    }
}
