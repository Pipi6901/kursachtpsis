window.DIAGRAMS = window.DIAGRAMS || {};

// Рисунок 3.6 — физическая модель данных гостиничной подсистемы
window.DIAGRAMS.fig_3_6 = function () {
  const W = 1140, F = 19;
  const D = new Diagram(W, 1000, { font: F });
  const w = 340, X = [10, 400, 790];
  const E = (col, y, title, rows) => D.entity(X[col], y, w, title, rows, { size: 18 });
  const yA = 20;
  const users = E(0, yA, 'users', [['PK', 'id', 'bigint'], ['', 'username', 'varchar(255)'], ['', 'password', 'varchar(255)'], ['', 'name', 'varchar(255)'],
    ['', 'email', 'varchar(255)'], ['', 'phone', 'varchar(255)'], ['', 'balance', 'integer']]);
  const ur = E(1, yA, 'users_roles', [['PK,FK', 'user_id', 'bigint'], ['PK,FK', 'role_id', 'integer']]);
  const roles = E(2, yA, 'roles', [['PK', 'id', 'integer'], ['', 'name', 'varchar(255)']]);
  const yB = users.b + 76;
  const rec = E(0, yB, 'receipts', [['PK', 'id', 'bigint'], ['FK', 'reservation_id', 'bigint'], ['FK', 'user_id', 'bigint'], ['', 'total_amount', 'double'],
    ['', 'created_at', 'timestamp'], ['', 'status', 'varchar(255)']]);
  const res = E(1, yB, 'reservation', [['PK', 'id', 'bigint'], ['FK', 'room_room_id', 'bigint'], ['', 'owner', 'varchar(255)'], ['', 'status', 'varchar(255)'],
    ['', 'price', 'integer'], ['', 'days', 'integer'], ['', 'start_date', 'date'], ['', 'end_date', 'date'], ['', 'moved_out_at', 'timestamp'],
    ['', 'name', 'varchar(255)'], ['', 'type', 'varchar(255)'], ['', 'beds', 'varchar(255)'], ['', 'number', 'integer'], ['', 'floor', 'integer'],
    ['', 'description', 'varchar(255)'], ['', 'photo', 'varchar(255)'], ['', 'free', 'boolean']]);
  const room = E(2, yB, 'room', [['PK', 'room_id', 'bigint'], ['', 'name', 'varchar(255)'], ['', 'price', 'integer'], ['', 'type', 'varchar(255)'],
    ['', 'beds', 'varchar(255)'], ['', 'number', 'integer'], ['', 'floor', 'integer'], ['', 'description', 'varchar(255)'], ['', 'photo', 'varchar(255)'],
    ['', 'free', 'boolean'], ['', 'days', 'integer']]);
  const com = E(2, room.b + 70, 'comments', [['PK', 'id', 'bigint'], ['FK', 'room_id', 'bigint'], ['', 'author', 'varchar(255)'], ['', 'text', 'varchar(5000)'],
    ['', 'created_at', 'timestamp']]);
  const stats = E(1, res.b + 70, 'stats', [['PK', 'id', 'bigint'], ['FK', 'room_id', 'bigint'], ['', 'days', 'integer'], ['', 'price', 'integer']]);

  const rel = (pts, a, b) => { D.flow(pts, { noArrow: true }); D.crow(a[0], a[1], a[2], 'one'); D.crow(b[0], b[1], b[2], 'many'); };
  // users 1—N users_roles
  let y = ur.rowY(0);
  rel([[users.r, y], [ur.l, y]], [users.r, y, 'r'], [ur.l, y, 'l']);
  // roles 1—N users_roles
  y = ur.rowY(1);
  rel([[roles.l, y], [ur.r, y]], [roles.l, y, 'l'], [ur.r, y, 'r']);
  // users 1—N receipts
  rel([[users.cx, users.b], [users.cx, rec.t]], [users.cx, users.b, 'd'], [users.cx, rec.t, 'u']);
  // reservation 1—N receipts
  y = rec.rowY(1);
  rel([[res.l, y], [rec.r, y]], [res.l, y, 'l'], [rec.r, y, 'r']);
  // room 1—N reservation
  y = res.rowY(1);
  rel([[room.l, y], [res.r, y]], [room.l, y, 'l'], [res.r, y, 'r']);
  // room 1—N comments
  rel([[room.cx, room.b], [room.cx, com.t]], [room.cx, room.b, 'd'], [room.cx, com.t, 'u']);
  // room 1—N stats
  const yr = room.rowY(9), ys = stats.rowY(1), xg = (res.r + room.l) / 2;
  rel([[room.l, yr], [xg, yr], [xg, ys], [stats.r, ys]], [room.l, yr, 'l'], [stats.r, ys, 'r']);

  // добавленные столбцы reservation
  const y1 = res.rowY(6) - 12.4, y2 = res.rowY(8) + 12.4;
  D.rect(res.x + 3, y1, res.w - 6, y2 - y1, { fill: 'none', sw: 2, stroke: '#000', dash: '8 6' });
  // пояснения
  const nx = 20, ny = stats.t - 30;
  D.rect(nx, ny + 4, 50, 22, { fill: 'none', sw: 2, dash: '8 6' });
  D.text(nx + 62, ny + 15, 'столбцы, добавленные при доработке', { anchor: 'start', nowrap: true, size: 18 });
  D.text(nx + 62, ny + 39, 'бронирования по датам', { anchor: 'start', nowrap: true, size: 18 });
  D.text(nx, ny + 84, 'Столбцы owner и author хранят имя', { anchor: 'start', nowrap: true, size: 18 });
  D.text(nx, ny + 108, 'пользователя без внешнего ключа', { anchor: 'start', nowrap: true, size: 18 });
  D.h = Math.max(stats.b, com.b) + 24;
  return D;
};
