package com.HotelManager.rooms;

import com.HotelManager.config.RoomImageBackfill;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.Type;
import com.HotelManager.repo.RoomRepository;
import com.HotelManager.utils.JwtTokenUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Несколько фотографий номера, удобства, площадь и вид: добавление и редактирование номера администратором,
 * порядок фотографий (первая – обложка), перенос единственного фото прежних номеров. Основная БД не затрагивается
 * (встраиваемая H2, откат после теста); загруженные файлы пишутся во временный каталог.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "upload.img=target/test-uploads/")
@Transactional
class RoomMediaIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenUtils jwt;
    @Autowired RoomRepository rooms;
    @Autowired RoomImageBackfill backfill;

    private String admin() {
        return "Bearer " + jwt.generateToken(new org.springframework.security.core.userdetails.User("boss", "x",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    private JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private static MockMultipartFile image(String part, String name) {
        return new MockMultipartFile(part, name, "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G', 1, 2, 3});
    }

    private static MockMultipartFile roomJson(String json) {
        return new MockMultipartFile("room", "", "application/json", json.getBytes(StandardCharsets.UTF_8));
    }

    private JsonNode add(String json, MockMultipartFile... files) throws Exception {
        var req = multipart("/rooms/add").file(roomJson(json));
        for (MockMultipartFile f : files) {
            req.file(f);
        }
        return body(mvc.perform(req.header("Authorization", admin())).andExpect(status().isOk()).andReturn());
    }

    private JsonNode edit(long id, String json, MockMultipartFile... files) throws Exception {
        var req = multipart("/rooms/" + id + "/edit").file(roomJson(json)).with(r -> {
            r.setMethod("PUT");
            return r;
        });
        for (MockMultipartFile f : files) {
            req.file(f);
        }
        return body(mvc.perform(req.header("Authorization", admin())).andExpect(status().isOk()).andReturn());
    }

    private static final String BASE = "\"name\":\"Люкс\",\"price\":120,\"type\":\"VIP\",\"beds\":\"TWO\",\"number\":7,"
            + "\"description\":\"Просторный номер\",\"floor\":3,\"days\":14,\"free\":true";

    @Test
    void roomIsCreatedWithSeveralPhotosAmenitiesAreaAndView() throws Exception {
        JsonNode created = add("{" + BASE + ",\"area\":38,\"view\":\"На парк\","
                + "\"amenities\":[\"WIFI\",\"AC\",\"WIFI\",\"bad code!\",\"<script>\"]}",
                image("files", "one.png"), image("files", "two.png"), image("files", "three.png"));

        assertThat(created.get("images")).hasSize(3);
        assertThat(created.get("photo").asString()).isEqualTo(created.get("images").get(0).get("url").asString());
        assertThat(created.get("images").get(1).get("url").asString()).endsWith("_two.png");
        assertThat(created.get("area").asInt()).isEqualTo(38);
        assertThat(created.get("view").asString()).isEqualTo("На парк");
        // повторы и недопустимые коды отброшены
        assertThat(created.get("amenities")).hasSize(2);

        JsonNode loaded = body(mvc.perform(get("/rooms/" + created.get("id").asLong())).andReturn());
        assertThat(loaded.get("images")).hasSize(3);
        assertThat(loaded.get("amenities").get(0).asString()).isEqualTo("WIFI");
    }

    @Test
    void legacySingleFileFieldStillWorks() throws Exception {
        JsonNode created = add("{" + BASE + "}", image("file", "cover.png"));
        assertThat(created.get("images")).hasSize(1);
        assertThat(created.get("photo").asString()).endsWith("_cover.png");
        assertThat(created.get("amenities")).isEmpty();
        assertThat(created.get("area").isNull()).isTrue();
    }

    @Test
    void editReordersRemovesAndAppendsPhotos() throws Exception {
        JsonNode created = add("{" + BASE + "}", image("files", "a.png"), image("files", "b.png"), image("files", "c.png"));
        long id = created.get("id").asLong();
        long a = created.get("images").get(0).get("id").asLong();
        long b = created.get("images").get(1).get("id").asLong();
        long c = created.get("images").get(2).get("id").asLong();

        // c – новая обложка, b удалена, a осталась, добавлена d
        JsonNode edited = edit(id, "{\"imageOrder\":[" + c + "," + a + "],\"amenities\":[\"TV\"],\"area\":30}", image("files", "d.png"));
        List<String> urls = new ArrayList<>();
        edited.get("images").forEach(n -> urls.add(n.get("url").asString()));
        assertThat(urls).hasSize(3);
        assertThat(urls.get(0)).endsWith("_c.png");
        assertThat(urls.get(1)).endsWith("_a.png");
        assertThat(urls.get(2)).endsWith("_d.png");
        assertThat(edited.get("photo").asString()).endsWith("_c.png");
        assertThat(edited.get("amenities")).hasSize(1);
        assertThat(edited.get("area").asInt()).isEqualTo(30);
        assertThat(body(mvc.perform(get("/rooms/" + id)).andReturn()).get("images").toString()).doesNotContain("\"id\":" + b + ",");

        // без imageOrder фотографии и удобства не меняются
        JsonNode same = edit(id, "{\"name\":\"Люкс Плюс\"}");
        assertThat(same.get("images")).hasSize(3);
        assertThat(same.get("amenities")).hasSize(1);
        assertThat(same.get("name").asString()).isEqualTo("Люкс Плюс");

        // пустой порядок удаляет все фотографии, обложки больше нет
        JsonNode none = edit(id, "{\"imageOrder\":[],\"amenities\":[]}");
        assertThat(none.get("images")).isEmpty();
        assertThat(none.get("amenities")).isEmpty();
        assertThat(none.get("photo").isNull()).isTrue();
    }

    @Test
    void notAnImageAndTooManyPhotosAreRejected() throws Exception {
        var notImage = new MockMultipartFile("files", "x.txt", "text/plain", "hello".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/rooms/add").file(roomJson("{" + BASE + "}")).file(notImage).header("Authorization", admin()))
                .andExpect(status().isBadRequest());

        var req = multipart("/rooms/add").file(roomJson("{" + BASE + "}"));
        for (int i = 0; i < 13; i++) {
            req.file(image("files", "p" + i + ".png"));
        }
        mvc.perform(req.header("Authorization", admin())).andExpect(status().isBadRequest());
    }

    @Test
    void guestsCannotAddRooms() throws Exception {
        var user = "Bearer " + jwt.generateToken(new org.springframework.security.core.userdetails.User("guest", "x",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        mvc.perform(multipart("/rooms/add").file(roomJson("{" + BASE + "}")).header("Authorization", user))
                .andExpect(status().isForbidden());
    }

    @Test
    void legacyPhotoIsMovedToImageTableOnce() throws Exception {
        Room old = rooms.save(Room.builder().name("Старый").price(50).free(true).type(Type.STANDARD).beds(Beds.ONE)
                .number(1).description("d").floor(1).photo("legacy.jpg").build());
        assertThat(old.getImages()).isEmpty();

        backfill.run(new DefaultApplicationArguments());
        backfill.run(new DefaultApplicationArguments());

        JsonNode loaded = body(mvc.perform(get("/rooms/" + old.getId())).andReturn());
        assertThat(loaded.get("images")).hasSize(1);
        assertThat(loaded.get("images").get(0).get("url").asString()).endsWith("/legacy.jpg");
        assertThat(loaded.get("photo").asString()).endsWith("/legacy.jpg");
    }
}
