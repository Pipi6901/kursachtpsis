package com.HotelManager.DTO;

import com.HotelManager.entity.Comment;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import lombok.Data;

import java.util.List;

@Data
public class RoomDTO {

    private Long id;
    private String name;
    private int price;
    private String photo;
    private boolean free;
    private int days;
    private Type type;
    private Beds beds;
    private int number;
    private String description;
    private int floor;
    private List<Comment> comments;

    /** Площадь, м²; вид из окна; удобства (коды); фотографии по порядку (первая – обложка). */
    private Integer area;
    private String view;
    private List<String> amenities;
    private List<Image> images;

    /** Фотография в ответе: идентификатор нужен клиенту для удаления и перестановки при редактировании. */
    public record Image(Long id, String url) {
    }

    /**
     * Только при редактировании: идентификаторы сохраняемых фотографий в нужном порядке. Не перечисленные
     * фотографии удаляются; {@code null} – оставить как есть. Новые файлы добавляются в конец.
     */
    private List<Long> imageOrder;
}
