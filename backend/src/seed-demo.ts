import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createDatabase } from './database/connection.js';
import { initializeReceptionSchema } from './database/reception-schema.js';

const DEMO_PASSWORD = 'Demo@123456';
const NAMESPACE = 'salon-demo-v1';

function demoUuid(kind: string, index: number): string {
  const hex = createHash('sha256')
    .update(`${NAMESPACE}:${kind}:${index}`)
    .digest('hex')
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20),
  ].join('-');
}

const barberNames = [
  'Aarav Sharma',
  'Vivaan Kapoor',
  'Aditya Verma',
  'Arjun Mehta',
  'Kabir Malhotra',
  'Rohan Iyer',
  'Kunal Nair',
  'Siddharth Singh',
  'Neeraj Gupta',
  'Rahul Joshi',
];

const firstNames = [
  'Ananya', 'Ishaan', 'Meera', 'Reyansh', 'Kiara', 'Ayaan', 'Saanvi',
  'Dhruv', 'Riya', 'Arnav', 'Nisha', 'Vihaan', 'Diya', 'Krish',
  'Pooja', 'Yash', 'Tanvi', 'Kartik', 'Simran', 'Harsh',
];
const lastNames = [
  'Patel', 'Sharma', 'Singh', 'Rao', 'Iyer', 'Gupta', 'Kapoor',
  'Joshi', 'Nair', 'Verma', 'Mehta', 'Malhotra', 'Bhat', 'Kulkarni',
];

const demoServices = [
  ['classic-haircut', 'Classic Haircut', 'Precision haircut and finishing', 30, 250],
  ['premium-haircut', 'Premium Haircut', 'Consultation, wash, haircut and styling', 45, 450],
  ['beard-sculpt', 'Beard Sculpt', 'Beard shaping and clean lines', 20, 150],
  ['royal-shave', 'Royal Shave', 'Hot-towel traditional shave', 25, 220],
  ['hair-wash', 'Hair Wash', 'Deep cleansing hair wash', 15, 120],
  ['head-massage', 'Head Massage', 'Relaxing head and scalp massage', 20, 300],
  ['hair-spa', 'Hair Spa', 'Nourishing wash and spa treatment', 45, 900],
  ['anti-dandruff', 'Anti-Dandruff Treatment', 'Scalp cleansing and treatment', 50, 850],
  ['keratin', 'Keratin Treatment', 'Frizz control and smoothing treatment', 120, 2200],
  ['hair-botox', 'Hair Botox', 'Repair and volume restoration', 90, 1800],
  ['global-color', 'Global Hair Color', 'Complete hair coloring', 120, 2200],
  ['root-touchup', 'Root Touch-up', 'Gray coverage at roots', 75, 900],
  ['hair-highlights', 'Hair Highlights', 'Partial professional highlights', 150, 2500],
  ['basic-facial', 'Basic Facial', 'Cleanse, scrub and facial massage', 45, 600],
  ['gold-facial', 'Gold Facial', 'Premium glow facial', 60, 1000],
  ['cleanup', 'Skin Cleanup', 'Deep pore cleanup', 35, 450],
  ['bridal-grooming', 'Grooming Package', 'Haircut, shave and facial package', 90, 1400],
  ['party-styling', 'Party Hair Styling', 'Blow-dry and occasion styling', 60, 800],
  ['premium-hair-package', 'Premium Hair Package', 'Cut, spa and styling', 120, 1800],
  ['hair-transformation', 'Hair Transformation', 'Cut, color and finish', 180, 3000],
] as const;

function isoAtDayOffset(now: Date, dayOffset: number, hour: number, minute: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function seedDemo(): Promise<void> {
const database = createDatabase();

try {
  await initializeReceptionSchema(database);
  const ownerBefore = await database
    .prepare("SELECT id,email,name FROM users WHERE role='OWNER'")
    .all();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();
  const timestamp = now.toISOString();

  await database.transaction(async () => {

  for (const service of demoServices) {
    const [id, name, description, duration, price] = service;
    await database.prepare(`
      INSERT INTO salon_services
        (id,name,description,duration_minutes,price_rupees,is_active,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(id, name, description, duration, price, timestamp, timestamp);
  }

  const barberIds: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const id = demoUuid('barber', i + 1);
    barberIds.push(id);
    await database.prepare(`
      INSERT INTO reception_barbers
        (id,name,photo_url,status,is_active,created_at,updated_at)
      VALUES (?, ?, NULL, 'available', 1, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(id, barberNames[i], timestamp, timestamp);

    const email = `demo.barber${String(i + 1).padStart(2, '0')}@example.test`;
    const username = `barber${String(i + 1).padStart(2, '0')}`;
    await database.prepare(`
      INSERT INTO users
        (id,name,email,username,password_hash,role,barber_id,customer_id,is_active,token_version,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, 'BARBER', ?, NULL, 1, 0, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(randomUUID(), barberNames[i], email, username, passwordHash, id, timestamp, timestamp);
  }

  const customerIds: string[] = [];
  for (let i = 0; i < 100; i += 1) {
    const customerId = demoUuid('customer', i + 1);
    const name = `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
    const phone = `900000${String(i + 1).padStart(4, '0')}`;
    const email = `demo.customer${String(i + 1).padStart(3, '0')}@example.test`;
    const registeredAt = isoAtDayOffset(now, -(120 - i), 10, 30);
    customerIds.push(customerId);

    await database.prepare(`
      INSERT INTO customers (id,name,phone_number,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(customerId, name, phone, registeredAt, registeredAt);

    await database.prepare(`
      INSERT INTO users
        (id,name,email,username,password_hash,role,barber_id,customer_id,is_active,token_version,created_at,updated_at)
      VALUES (?, ?, ?, NULL, ?, 'CUSTOMER', NULL, ?, 1, 0, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(randomUUID(), name, email, passwordHash, customerId, registeredAt, registeredAt);
  }

  const settings = [
    ['business_open_time', '09:00'],
    ['business_close_time', '21:00'],
    ['business_working_days', JSON.stringify([1, 2, 3, 4, 5, 6])],
    ['salon_name', 'Demo Salon Queue'],
  ];
  for (const [key, value] of settings) {
    await database.prepare(`
      INSERT INTO reception_settings
        (setting_key,setting_value,created_at,updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(key, value, timestamp, timestamp);
  }

  const statuses = [
    ...Array<string>(210).fill('completed'),
    ...Array<string>(30).fill('cancelled'),
    ...Array<string>(30).fill('no_show'),
    ...Array<string>(20).fill('waiting'),
    ...Array<string>(5).fill('called'),
    ...Array<string>(5).fill('in_service'),
  ];

  const insertBooking = database.prepare(`
    INSERT INTO reception_bookings
      (id,token,token_day,customer_id,customer_name,phone_number,service_ids,
       duration_minutes,total_price_rupees,booking_source,preferred_barber_id,
       assigned_barber_id,status,created_at,updated_at,called_at,service_started_at,completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  const insertBookingService = database.prepare(`
    INSERT INTO booking_services
      (booking_id,service_id,service_name,duration_minutes,price_rupees)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  const insertServiceRecord = database.prepare(`
    INSERT INTO service_records
      (id,booking_id,barber_id,started_at,completed_at,created_at,updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);
  const serviceRows = demoServices.map((service) => ({
    id: service[0],
    name: service[1],
    duration: service[3],
    price: service[4],
  }));

  for (let i = 0; i < 300; i += 1) {
    const status = statuses[i];
    const barberIndex = i % 10;
    const barberId = barberIds[barberIndex];
    const customerIndex =
      status === 'waiting' ? i - 270
        : status === 'called' ? 25 + (i - 290)
          : status === 'in_service' ? 30 + (i - 295)
            : i % 100;
    const customerId = customerIds[customerIndex];
    const customerNameRow = await database.prepare(
      'SELECT name,phone_number FROM customers WHERE id=?',
    ).get(customerId);
    if (!customerNameRow) {
      throw new Error(`Demo customer could not be loaded: ${customerId}`);
    }
    const dayIndex = Math.floor(i / 5);
    const dayOffset = dayIndex - 59;
    const tokenSequence = (i % 5) + 1;
    const tokenDay = new Date(now);
    tokenDay.setUTCDate(tokenDay.getUTCDate() + dayOffset);
    const dayString = tokenDay.toISOString().slice(0, 10);
    const createdAt = isoAtDayOffset(now, dayOffset, 9 + (tokenSequence % 8), tokenSequence * 10);
    const firstService = serviceRows[(i * 3) % serviceRows.length];
    const secondService = i % 4 === 0
      ? serviceRows[(i * 7 + 5) % serviceRows.length]
      : null;
    const selected = secondService && secondService.id !== firstService.id
      ? [firstService, secondService]
      : [firstService];
    const duration = selected.reduce((sum, service) => sum + service.duration, 0);
    const price = selected.reduce((sum, service) => sum + service.price, 0);
    const bookingId = demoUuid('booking', i + 1);
    const activeWithAssignment = status === 'called' || status === 'in_service';
    const assignedBarberId =
      activeWithAssignment || status === 'completed'
        ? barberId
        : null;
    const calledAt = status === 'called' || status === 'in_service'
      ? isoAtDayOffset(now, dayOffset, 13, 10)
      : status === 'completed'
        ? isoAtDayOffset(now, dayOffset, 11, 30)
        : null;
    const startedAt = status === 'in_service' || status === 'completed'
      ? isoAtDayOffset(now, dayOffset, 12, 0)
      : null;
    const completedAt = status === 'completed'
      ? isoAtDayOffset(now, dayOffset, 12, Math.min(55, 0 + duration))
      : null;

    await insertBooking.run(
      bookingId,
      `D-${String(i + 1).padStart(4, '0')}`,
      dayString,
      customerId,
      customerNameRow.name,
      customerNameRow.phone_number,
      JSON.stringify(selected.map((service) => service.id)),
      duration,
      price,
      barberId,
      assignedBarberId,
      status,
      createdAt,
      createdAt,
      calledAt,
      startedAt,
      completedAt,
    );

    const bookingCreated = await database
      .prepare('SELECT id FROM reception_bookings WHERE id=?')
      .get(bookingId);
    if (!bookingCreated) {
      throw new Error(`Demo booking insert was skipped or rejected: ${bookingId}`);
    }

    for (const service of selected) {
      await insertBookingService.run(
        bookingId,
        service.id,
        service.name,
        service.duration,
        service.price,
      );
    }

    if ((status === 'completed' || status === 'in_service') && startedAt) {
      await insertServiceRecord.run(
        demoUuid('service-record', i + 1),
        bookingId,
        barberId,
        startedAt,
        completedAt,
        startedAt,
        completedAt ?? startedAt,
      );
    }

    const existingDaily = await database.prepare(
      'SELECT next_token_sequence FROM daily_queue_information WHERE queue_day=?',
    ).get(dayString);
    if (!existingDaily) {
      await database.prepare(`
        INSERT INTO daily_queue_information
          (queue_day,next_token_sequence,created_at,updated_at)
        VALUES (?, 6, ?, ?)
      `).run(dayString, timestamp, timestamp);
    } else if (Number(existingDaily.next_token_sequence) <= tokenSequence) {
      await database.prepare(`
        UPDATE daily_queue_information
        SET next_token_sequence=6,updated_at=?
        WHERE queue_day=?
      `).run(timestamp, dayString);
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const status = i < 5 ? 'on_break' : i < 8 ? 'available' : 'available';
    await database.prepare(
      'UPDATE reception_barbers SET status=?,updated_at=? WHERE id=?',
    ).run(status, timestamp, barberIds[i]);
  }
  for (let i = 0; i < 5; i += 1) {
    await database.prepare(
      'UPDATE reception_barbers SET status=?,updated_at=? WHERE id=?',
    ).run('busy', timestamp, barberIds[5 + i]);
  }

  });

  const ownerAfter = await database
    .prepare("SELECT id,email,name FROM users WHERE role='OWNER'")
    .all();
  const ownerPreserved = JSON.stringify(ownerBefore) === JSON.stringify(ownerAfter);

  const countTable = async (
    sql: string,
    parameters: Array<string | number> = [],
  ): Promise<number> => {
    const row = await database.prepare(sql).get(...parameters);
    return Number(row?.['n'] ?? 0);
  };

  const counts = {
    customers: await countTable('SELECT COUNT(*) AS n FROM customers'),
    barbers: await countTable('SELECT COUNT(*) AS n FROM reception_barbers'),
    barberAccounts: await countTable("SELECT COUNT(*) AS n FROM users WHERE role='BARBER'"),
    customerAccounts: await countTable("SELECT COUNT(*) AS n FROM users WHERE role='CUSTOMER'"),
    services: await countTable('SELECT COUNT(*) AS n FROM salon_services'),
    bookings: await countTable('SELECT COUNT(*) AS n FROM reception_bookings'),
    demoBookings: await countTable(
      'SELECT COUNT(*) AS n FROM reception_bookings WHERE id LIKE ?',
      ['________-____-4___-8___-____________'],
    ),
    bookingServices: await countTable('SELECT COUNT(*) AS n FROM booking_services'),
    serviceRecords: await countTable('SELECT COUNT(*) AS n FROM service_records'),
    settings: await countTable('SELECT COUNT(*) AS n FROM reception_settings'),
  };

  const foreignKeyErrors = await database.query(`
    SELECT 'bookings.customer_id' AS relationship, booking.id AS row_id
    FROM reception_bookings booking
    LEFT JOIN customers customer ON customer.id = booking.customer_id
    WHERE booking.customer_id IS NOT NULL AND customer.id IS NULL
    UNION ALL
    SELECT 'booking_services.service_id', line.booking_id
    FROM booking_services line
    LEFT JOIN salon_services service ON service.id = line.service_id
    WHERE service.id IS NULL
  `).then((result) => result.rows);
  const duplicateEmails = await database.query(`
    SELECT lower(email) AS email,COUNT(*) AS n FROM users
    GROUP BY lower(email) HAVING COUNT(*)>1
  `).then((result) => result.rows);
  const duplicateBookingIds = await database.query(`
    SELECT id,COUNT(*) AS n FROM reception_bookings GROUP BY id HAVING COUNT(*)>1
  `).then((result) => result.rows);

  const statusCounts = await database.prepare(`
    SELECT status,COUNT(*) AS count FROM reception_bookings GROUP BY status ORDER BY status
  `).all();

  console.log(JSON.stringify({
    success: true,
    demoPassword: DEMO_PASSWORD,
    ownerPreserved,
    ownerAccountsBefore: ownerBefore,
    ownerAccountsAfter: ownerAfter,
    counts,
    statusCounts,
    foreignKeyErrors,
    duplicateEmails,
    duplicateBookingIds,
  }, null, 2));
} finally {
  await database.close();
}
}

await seedDemo();
