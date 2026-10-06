package com.HotelManager.booking;

import com.HotelManager.entity.Receipt;
import com.HotelManager.entity.Reservation;
import com.HotelManager.entity.Role;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.User;
import com.HotelManager.entity.enums.Beds;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.entity.enums.Type;
import com.HotelManager.repo.ReceiptRepository;
import com.HotelManager.repo.ReservationRepository;
import com.HotelManager.repo.RoleRepository;
import com.HotelManager.repo.RoomRepository;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.utils.JwtTokenUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Календарь бронирования: даты заезда и выезда, проверка занятости по датам, поиск свободных номеров и учёт выселения
 * как состоявшегося проживания в статистике и выручке. Основная БД не затрагивается (встраиваемая H2, откат после теста).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BookingCalendarIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtTokenUtils jwt;
    @Autowired RoomRepository rooms;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired ReservationRepository reservations;
    @Autowired ReceiptRepository receipts;

    private final LocalDate today = LocalDate.now();
    private Room roomA;
    private Room roomB;

    @BeforeEach
    void data() {
        Role user = role("ROLE_USER");
        role("ROLE_ADMIN");
        role("ROLE_MANAGER");
        guest("guest1", 100_000, user);
        guest("guest2", 100_000, user);
        roomA = room("Люкс", 100, 101);
        roomB = room("Стандарт", 80, 102);
    }

    private Role role(String name) {
        return roles.findByName(name).orElseGet(() -> {
            Role r = new Role();
            r.setName(name);
            return roles.save(r);
        });
    }

    private User guest(String name, int balance, Role role) {
        User u = new User();
        u.setUsername(name);
        u.setPassword("x");
        u.setBalance(balance);
        u.setRoles(new java.util.ArrayList<>(List.of(role)));
        return users.save(u);
    }

    private Room room(String name, int price, int number) {
        return rooms.save(Room.builder().name(name).price(price).free(true).type(Type.STANDARD).beds(Beds.TWO)
                .number(number).description("тестовый номер").floor(1).build());
    }

    private String bearer(String username, String authority) {
        return "Bearer " + jwt.generateToken(new org.springframework.security.core.userdetails.User(username, "x",
                List.of(new SimpleGrantedAuthority(authority))));
    }

    private MockHttpServletRequestBuilder rent(String who, Room room, LocalDate from, LocalDate to) {
        return post("/rooms/" + room.getId() + "/createRent?startDate=" + from + "&endDate=" + to)
                .header("Authorization", bearer(who, "ROLE_USER"));
    }

    private JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private long book(String who, Room room, LocalDate from, LocalDate to) throws Exception {
        MvcResult res = mvc.perform(rent(who, room, from, to)).andExpect(status().isOk()).andReturn();
        return body(res).get("id").asLong();
    }

    private void confirm(long id) throws Exception {
        mvc.perform(post("/reservations/" + id + "/confirm").header("Authorization", bearer("manager", "ROLE_MANAGER")))
                .andExpect(status().isOk());
    }

    private void moveOut(long id, String who, int expected) throws Exception {
        mvc.perform(post("/reservations/" + id + "/moveOut").header("Authorization", bearer(who, "ROLE_USER")))
                .andExpect(status().is(expected));
    }

    private JsonNode room(Room r) throws Exception {
        return body(mvc.perform(get("/rooms/" + r.getId())).andReturn());
    }

    private JsonNode analytics(String path) throws Exception {
        return body(mvc.perform(get(path).header("Authorization", bearer("boss", "ROLE_ADMIN"))).andExpect(status().isOk()).andReturn());
    }

    // ------------------------------------------------------------------------------------ даты и занятость

    @Test
    void overlappingDatesAreRejectedAndCheckoutDayIsFree() throws Exception {
        book("guest1", roomA, today.plusDays(10), today.plusDays(13));

        mvc.perform(rent("guest2", roomA, today.plusDays(12), today.plusDays(15))).andExpect(status().isBadRequest());
        mvc.perform(rent("guest2", roomA, today.plusDays(9), today.plusDays(11))).andExpect(status().isBadRequest());
        mvc.perform(rent("guest2", roomA, today.plusDays(11), today.plusDays(12))).andExpect(status().isBadRequest());
        // в день выезда предыдущего гостя и за день до заезда следующего номер свободен
        mvc.perform(rent("guest2", roomA, today.plusDays(13), today.plusDays(16))).andExpect(status().isOk());
        mvc.perform(rent("guest2", roomA, today.plusDays(7), today.plusDays(10))).andExpect(status().isOk());
        // другой номер на те же даты не затронут
        mvc.perform(rent("guest2", roomB, today.plusDays(10), today.plusDays(13))).andExpect(status().isOk());
    }

    @Test
    void futureBookingDoesNotMakeRoomOccupiedToday() throws Exception {
        book("guest1", roomA, today.plusDays(5), today.plusDays(8));
        assertThat(room(roomA).get("free").asBoolean()).isTrue();

        book("guest2", roomB, today, today.plusDays(2));
        assertThat(room(roomB).get("free").asBoolean()).isFalse();
    }

    @Test
    void invalidDatesAreRejected() throws Exception {
        mvc.perform(rent("guest1", roomA, today.minusDays(1), today.plusDays(2))).andExpect(status().isBadRequest());
        mvc.perform(rent("guest1", roomA, today.plusDays(3), today.plusDays(3))).andExpect(status().isBadRequest());
        mvc.perform(rent("guest1", roomA, today.plusDays(4), today.plusDays(2))).andExpect(status().isBadRequest());
        mvc.perform(rent("guest1", roomA, today, today.plusDays(101))).andExpect(status().isBadRequest());
        mvc.perform(post("/rooms/" + roomA.getId() + "/createRent?startDate=" + today)
                .header("Authorization", bearer("guest1", "ROLE_USER"))).andExpect(status().isBadRequest());
        mvc.perform(post("/rooms/" + roomA.getId() + "/createRent").header("Authorization", bearer("guest1", "ROLE_USER")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void insufficientBalanceIsRejectedAndNothingIsSaved() throws Exception {
        User poor = guest("poor", 150, roles.findByName("ROLE_USER").orElseThrow());
        long before = reservations.count();
        mvc.perform(rent("poor", roomA, today.plusDays(1), today.plusDays(3))).andExpect(status().isBadRequest());
        assertThat(reservations.count()).isEqualTo(before);
        assertThat(users.findByUsername("poor").orElseThrow().getBalance()).isEqualTo(poor.getBalance());
    }

    @Test
    void legacyBookingByDaysStartsTodayAndChargesPerDay() throws Exception {
        MvcResult res = mvc.perform(post("/rooms/" + roomA.getId() + "/createRent?days=3")
                .header("Authorization", bearer("guest1", "ROLE_USER"))).andExpect(status().isOk()).andReturn();
        JsonNode r = body(res);
        assertThat(r.get("startDate").asText()).isEqualTo(today.toString());
        assertThat(r.get("endDate").asText()).isEqualTo(today.plusDays(3).toString());
        assertThat(r.get("price").asInt()).isEqualTo(300);
        assertThat(users.findByUsername("guest1").orElseThrow().getBalance()).isEqualTo(100_000 - 300);
        assertThat(room(roomA).get("free").asBoolean()).isFalse();
        mvc.perform(post("/rooms/" + roomA.getId() + "/createRent?days=1").header("Authorization", bearer("guest2", "ROLE_USER")))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------------------------ поиск и календарь

    @Test
    void availableRoomsAreFilteredByDates() throws Exception {
        book("guest1", roomA, today.plusDays(10), today.plusDays(13));

        JsonNode overlapping = body(mvc.perform(get("/rooms/available?from=" + today.plusDays(11) + "&to=" + today.plusDays(14)))
                .andExpect(status().isOk()).andReturn());
        assertThat(ids(overlapping)).containsExactly(roomB.getId());

        JsonNode clear = body(mvc.perform(get("/rooms/available?from=" + today.plusDays(13) + "&to=" + today.plusDays(15)))
                .andExpect(status().isOk()).andReturn());
        assertThat(ids(clear)).containsExactlyInAnyOrder(roomA.getId(), roomB.getId());

        mvc.perform(get("/rooms/available?from=" + today.plusDays(5) + "&to=" + today.plusDays(5))).andExpect(status().isBadRequest());
    }

    @Test
    void rejectedBookingFreesTheDates() throws Exception {
        long id = book("guest1", roomA, today.plusDays(10), today.plusDays(13));
        mvc.perform(post("/reservations/" + id + "/reject").header("Authorization", bearer("manager", "ROLE_MANAGER")))
                .andExpect(status().isOk());
        mvc.perform(rent("guest2", roomA, today.plusDays(10), today.plusDays(13))).andExpect(status().isOk());
    }

    @Test
    void busyPeriodsAreListedWithoutGuestData() throws Exception {
        book("guest1", roomA, today.plusDays(10), today.plusDays(13));
        book("guest2", roomA, today.plusDays(2), today.plusDays(4));
        MvcResult res = mvc.perform(get("/rooms/" + roomA.getId() + "/busy")).andExpect(status().isOk()).andReturn();
        JsonNode periods = body(res);
        assertThat(periods).hasSize(2);
        assertThat(periods.get(0).get("from").asText()).isEqualTo(today.plusDays(2).toString());
        assertThat(periods.get(1).get("to").asText()).isEqualTo(today.plusDays(13).toString());
        assertThat(res.getResponse().getContentAsString()).doesNotContain("guest");
    }

    // ------------------------------------------------------------------------------------ выселение

    @Test
    void moveOutCountsTheStayAsLivedInStatisticsAndRevenue() throws Exception {
        long id = book("guest1", roomA, today, today.plusDays(3));
        confirm(id);

        assertThat(analytics("/api/analytics/metrics").get("completedBookings").asInt()).isZero();
        assertThat(analytics("/stats").get("totalIncome").asInt()).isEqualTo(300);

        moveOut(id, "guest1", 200);

        Reservation r = reservations.findById(id).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(r.getMovedOutAt()).isNotNull();
        assertThat(receipts.findByReservationId(id).orElseThrow().getStatus()).isEqualTo("Завершен");
        assertThat(room(roomA).get("free").asBoolean()).isTrue();

        JsonNode metrics = analytics("/api/analytics/metrics");
        assertThat(metrics.get("completedBookings").asInt()).isEqualTo(1);
        assertThat(metrics.get("totalRevenue").asDouble()).isEqualTo(300.0);
        assertThat(analytics("/stats").get("totalIncome").asInt()).isEqualTo(300);
        assertThat(analytics("/stats").get("topRoomsByBookings").get(0).get("roomName").asText()).isEqualTo("Люкс");
        assertThat(analytics("/api/analytics/revenue/monthly").get(0).get("revenue").asDouble()).isEqualTo(300.0);
        assertThat(analytics("/api/analytics/top/clients").get("clients").get(0).get("totalSpent").asDouble()).isEqualTo(300.0);
        assertThat(analytics("/stats/lenght-of-stay").get("oneThree").asInt()).isEqualTo(1);

        // завершённое проживание остаётся в истории гостя
        JsonNode mine = body(mvc.perform(get("/reservations").header("Authorization", bearer("guest1", "ROLE_USER")))
                .andExpect(status().isOk()).andReturn());
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    void completedStayCannotBeChangedAgain() throws Exception {
        long id = book("guest1", roomA, today, today.plusDays(2));
        confirm(id);
        moveOut(id, "guest1", 200);

        moveOut(id, "guest1", 400);
        mvc.perform(post("/reservations/" + id + "/cancel").header("Authorization", bearer("guest1", "ROLE_USER")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/reservations/" + id + "/reject").header("Authorization", bearer("manager", "ROLE_MANAGER")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/reservations/" + id + "/confirm").header("Authorization", bearer("manager", "ROLE_MANAGER")))
                .andExpect(status().isBadRequest());
        assertThat(reservations.findById(id).orElseThrow().getStatus()).isEqualTo(ReservationStatus.COMPLETED);
    }

    @Test
    void moveOutRequiresConfirmedBookingThatHasStartedAndOwner() throws Exception {
        long waiting = book("guest1", roomA, today, today.plusDays(2));
        moveOut(waiting, "guest1", 400);                       // ещё не подтверждена

        confirm(waiting);
        moveOut(waiting, "guest2", 403);                       // чужая бронь

        long future = book("guest2", roomB, today.plusDays(4), today.plusDays(6));
        confirm(future);
        moveOut(future, "guest2", 400);                        // проживание ещё не началось
        assertThat(reservations.findById(future).orElseThrow().getStatus()).isEqualTo(ReservationStatus.DONE);
    }

    @Test
    void moveOutKeepsRoomBusyWhenAnotherStayCoversTonight() throws Exception {
        long first = book("guest1", roomA, today.minusDays(0), today.plusDays(1));
        confirm(first);
        // вторая бронь заезжает завтра: сегодня номер свободен только после выселения первого гостя
        book("guest2", roomA, today.plusDays(1), today.plusDays(3));
        moveOut(first, "guest1", 200);
        assertThat(room(roomA).get("free").asBoolean()).isTrue();
    }

    @Test
    void legacyReservationWithoutDatesCanBeMovedOutAndKeepsItsDays() throws Exception {
        // бронь, созданная до появления календаря: дат нет, номер помечен занятым, чек выдан вчера
        roomA.setFree(false);
        rooms.save(roomA);
        User owner = users.findByUsername("guest1").orElseThrow();
        Reservation legacy = reservations.save(Reservation.builder().name("Люкс").owner("guest1").price(200).days(2)
                .status(ReservationStatus.DONE).type(Type.STANDARD).beds(Beds.TWO).number(101).floor(1).room(roomA).build());
        receipts.save(Receipt.builder().reservation(legacy).user(owner).totalAmount(200)
                .createdAt(LocalDateTime.now().minusDays(1)).status("Оплачено").build());

        // пока гость не выселен, номер занят и на сегодняшние даты не бронируется
        mvc.perform(rent("guest2", roomA, today, today.plusDays(1))).andExpect(status().isBadRequest());

        moveOut(legacy.getId(), "guest1", 200);

        Reservation done = reservations.findById(legacy.getId()).orElseThrow();
        assertThat(done.getStatus()).isEqualTo(ReservationStatus.COMPLETED);
        assertThat(done.getStartDate()).isEqualTo(today.minusDays(1));
        assertThat(done.getEndDate()).isEqualTo(today.plusDays(1));
        assertThat(room(roomA).get("free").asBoolean()).isTrue();
        assertThat(analytics("/stats").get("totalIncome").asInt()).isEqualTo(200);
    }

    @Test
    void rejectRefundsThePaidAmountExactlyOnce() throws Exception {
        long id = book("guest1", roomA, today.plusDays(3), today.plusDays(6));
        assertThat(users.findByUsername("guest1").orElseThrow().getBalance()).isEqualTo(100_000 - 300);
        mvc.perform(post("/reservations/" + id + "/reject").header("Authorization", bearer("manager", "ROLE_MANAGER")))
                .andExpect(status().isOk());
        assertThat(users.findByUsername("guest1").orElseThrow().getBalance()).isEqualTo(100_000);
        assertThat(receipts.findByReservationId(id).orElseThrow().getStatus()).isEqualTo("Отменен");
        assertThat(analytics("/api/analytics/metrics").get("totalRevenue").asDouble()).isZero();
    }

    private static List<Long> ids(JsonNode array) {
        java.util.ArrayList<Long> out = new java.util.ArrayList<>();
        array.forEach(n -> out.add(n.get("id").asLong()));
        return out;
    }
}
