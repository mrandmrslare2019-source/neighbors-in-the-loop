const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const databasePath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, "..", "data", "nm-app.db");
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new sqlite3.Database(databasePath);

const defaultBusinesses = [
  {
    name: "Corner Table Kitchen",
    category: "Food",
    rating: "4.9 ★",
    distance: "2.4 mi away",
    description: "Seasonal market kitchen with neighborhood dinners and house-made comfort food.",
    owner: "The Corner Table Team",
    address: "118 Maple Street",
    hours: "Open today · 8am-8pm",
    neighborhood: "Maple District",
    phone: "(555) 274-1188",
    website: "https://cornertable.example",
    coordinates: { lat: 41.8786, lng: -87.6299 },
    photos: ["https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80"],
    tags: ["cozy", "brunch", "local favorite"],
    status: "approved"
  },
  {
    name: "Works & Co. Goods",
    category: "Retail",
    rating: "4.8 ★",
    distance: "1.1 mi away",
    description: "Independent home goods shop for thoughtful objects, gifts and daily living pieces.",
    owner: "Mina Torres",
    address: "24 Market Lane",
    hours: "Open today · 10am-6pm",
    neighborhood: "Market Square",
    phone: "(555) 354-2424",
    website: "https://worksandco.example",
    coordinates: { lat: 41.8823, lng: -87.6473 },
    photos: ["https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80"],
    tags: ["home", "gifts", "curated"],
    status: "approved"
  },
  {
    name: "Bloom Studio",
    category: "Wellness",
    rating: "4.9 ★",
    distance: "0.8 mi away",
    description: "Yoga, therapy and care sessions designed for a balanced neighborhood lifestyle.",
    owner: "Avery Bloom",
    address: "7 Willow Court",
    hours: "Open today · 7am-8pm",
    neighborhood: "Willow Row",
    phone: "(555) 202-7007",
    website: "https://bloomstudio.example",
    coordinates: { lat: 41.8926, lng: -87.6244 },
    photos: ["https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80"],
    tags: ["wellness", "yoga", "mindfulness"],
    status: "approved"
  },
  {
    name: "Oak & Thread Repair",
    category: "Service",
    rating: "4.7 ★",
    distance: "3.0 mi away",
    description: "A neighborhood clothing repair bar focused on care, reuse and everyday repair.",
    owner: "Theo Carter",
    address: "66 Cedar Avenue",
    hours: "Open today · 9am-5pm",
    neighborhood: "Cedar Heights",
    phone: "(555) 901-6600",
    website: "https://oakandthread.example",
    coordinates: { lat: 41.8682, lng: -87.6941 },
    photos: ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"],
    tags: ["repair", "sustainable", "crafts"],
    status: "approved"
  }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function normalizeCoordinates(value) {
  const fallback = { lat: 41.8781, lng: -87.6298 };
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return normalizeCoordinates(JSON.parse(value));
    } catch (error) {
      return fallback;
    }
  }
  if (Array.isArray(value) && value.length === 2) {
    const [lat, lng] = value.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return fallback;
  }
  if (typeof value === "object") {
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return fallback;
}

async function migrate() {
  await run(`CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    rating TEXT NOT NULL,
    distance TEXT NOT NULL,
    description TEXT NOT NULL,
    owner TEXT NOT NULL,
    address TEXT NOT NULL,
    hours TEXT NOT NULL,
    neighborhood TEXT,
    phone TEXT,
    website TEXT,
    coordinates TEXT NOT NULL DEFAULT '{"lat":41.8781,"lng":-87.6298}',
    photos TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'approved'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    rating INTEGER,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    savedBusinesses TEXT NOT NULL DEFAULT '[]',
    interests TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  await run(`CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  const count = (await all("SELECT COUNT(*) AS count FROM businesses"))[0].count;
  if (count === 0) {
    for (const business of defaultBusinesses) {
      await run(
        `INSERT INTO businesses (name, category, rating, distance, description, owner, address, hours, neighborhood, phone, website, coordinates, photos, tags, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business.name,
          business.category,
          business.rating,
          business.distance,
          business.description,
          business.owner,
          business.address,
          business.hours,
          business.neighborhood || "",
          business.phone || "",
          business.website || "",
          JSON.stringify(normalizeCoordinates(business.coordinates)),
          JSON.stringify(Array.isArray(business.photos) ? business.photos : []),
          JSON.stringify(Array.isArray(business.tags) ? business.tags : []),
          business.status || "approved"
        ]
      );
    }
  }

  if (adminEmail && adminPassword) {
    const existingAdmin = await all("SELECT id FROM auth_users WHERE email = ?", [adminEmail]);
    if (!existingAdmin.length) {
      await run(
        `INSERT INTO auth_users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
        ["Neighborhood Admin", adminEmail, require("crypto").createHash("sha256").update(`${adminPassword}${process.env.AUTH_SECRET || "neighbors-in-the-loop-local-secret"}`).digest("hex")]
      );
    }
  }

  console.log(`Database ready at ${databasePath}`);
}

migrate()
  .then(() => db.close())
  .catch((error) => {
    console.error(error);
    db.close();
    process.exit(1);
  });
