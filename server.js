const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { URL } = require("url");
const sqlite3 = require("sqlite3").verbose();

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const AUTH_SECRET = process.env.AUTH_SECRET || "neighbors-in-the-loop-local-secret";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 12;
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const databasePath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, "nm-app.db");

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

function ensureDataDir(targetPath = databasePath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function dbRun(db, sql, params = []) {
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

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

function normalizeCoordinates(value) {
  const fallback = { lat: 41.8781, lng: -87.6298 };

  if (!value) {
    return fallback;
  }

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

async function initializeDatabase(targetPath = databasePath, adminCredentials = {}) {
  ensureDataDir(targetPath);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(targetPath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      db.serialize(async () => {
        try {
          await dbRun(
            db,
            `CREATE TABLE IF NOT EXISTS businesses (
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
            )`
          );

          await dbRun(db, "ALTER TABLE businesses ADD COLUMN neighborhood TEXT").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN phone TEXT").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN website TEXT").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN coordinates TEXT").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN photos TEXT DEFAULT '[]'").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN tags TEXT DEFAULT '[]'").catch(() => {});
          await dbRun(db, "ALTER TABLE businesses ADD COLUMN status TEXT DEFAULT 'approved'").catch(() => {});

          await dbRun(
            db,
            `CREATE TABLE IF NOT EXISTS comments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              business_name TEXT NOT NULL,
              author TEXT NOT NULL,
              body TEXT NOT NULL,
              rating INTEGER,
              status TEXT NOT NULL DEFAULT 'approved',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
          );
          await dbRun(db, "ALTER TABLE comments ADD COLUMN rating INTEGER").catch(() => {});
          await dbRun(db, "ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'approved'").catch(() => {});

          await dbRun(
            db,
            `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              savedBusinesses TEXT NOT NULL DEFAULT '[]',
              interests TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
          );

          await dbRun(
            db,
            `CREATE TABLE IF NOT EXISTS auth_users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
          );
          await dbRun(db, "ALTER TABLE auth_users ADD COLUMN role TEXT DEFAULT 'user'").catch(() => {});

          if (adminCredentials.email && adminCredentials.password) {
            await dbRun(
              db,
              `INSERT OR IGNORE INTO auth_users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
              ["Neighborhood Admin", adminCredentials.email, hashPassword(adminCredentials.password)]
            );
            await dbRun(db, "UPDATE auth_users SET role = 'admin' WHERE email = ?", [adminCredentials.email]);
          }

          const rows = await dbAll(db, "SELECT COUNT(*) AS count FROM businesses");
          if (rows[0].count === 0) {
            await Promise.all(
              defaultBusinesses.map((business) =>
                dbRun(
                  db,
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
                )
              )
            );
          }

          resolve(db);
        } catch (dbError) {
          reject(dbError);
        }
      });
    });
  });
}

function parseJsonArray(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeSavedBusinesses(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean).slice(0, 50))];
}

function normalizeInterests(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12))];
}

async function getAverageRatingForBusiness(db, businessName) {
  const rows = await dbAll(
    db,
    "SELECT rating FROM comments WHERE business_name = ? AND rating IS NOT NULL",
    [businessName]
  );

  if (!rows.length) {
    return null;
  }

  const average = rows.reduce((sum, row) => sum + Number(row.rating), 0) / rows.length;
  return `${Number(average).toFixed(1)} ★`;
}

async function readBusinesses(db, filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.neighborhood) {
    clauses.push("LOWER(COALESCE(neighborhood, '')) LIKE ?");
    params.push(`%${String(filters.neighborhood).trim().toLowerCase()}%`);
  }

  if (filters.name) {
    clauses.push("LOWER(name) LIKE ?");
    params.push(`%${String(filters.name).trim().toLowerCase()}%`);
  }

  let sql = "SELECT name, category, rating, distance, description, owner, address, hours, neighborhood, phone, website, coordinates, photos, tags, status FROM businesses";
  if (clauses.length) {
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }
  sql += " ORDER BY name COLLATE NOCASE";

  const rows = await dbAll(db, sql, params);
  const businesses = await Promise.all(
    rows.map(async (row) => {
      const business = {
        ...row,
        coordinates: normalizeCoordinates(row.coordinates),
        neighborhood: row.neighborhood || "",
        phone: row.phone || "",
        website: row.website || "",
        photos: parseJsonArray(row.photos, []),
        tags: parseJsonArray(row.tags, []),
        status: row.status || "approved"
      };

      const derivedRating = await getAverageRatingForBusiness(db, business.name);
      if (derivedRating) {
        business.rating = derivedRating;
      }

      return business;
    })
  );

  return businesses;
}

async function writeBusinesses(db, businesses) {
  await dbRun(db, "DELETE FROM businesses");
  await Promise.all(
    businesses.map((business) =>
      dbRun(
        db,
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
      )
    )
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        if (!raw) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", (error) => reject(error));
  });
}

function sanitizeBusiness(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Business payload must be an object.");
  }

  const name = String(record.name || "").trim();
  const category = String(record.category || "Food").trim();
  const rating = String(record.rating || "4.8 ★").trim();
  const distance = String(record.distance || "1.0 mi away").trim();
  const description = String(record.description || "").trim();
  const owner = String(record.owner || "").trim();
  const address = String(record.address || "").trim();
  const hours = String(record.hours || "Open today").trim();
  const neighborhood = String(record.neighborhood || "").trim();
  const phone = String(record.phone || "").trim();
  const website = String(record.website || "").trim();
  const coordinates = normalizeCoordinates(record.coordinates || { lat: 41.8781, lng: -87.6298 });
  const photos = Array.isArray(record.photos) ? record.photos.map(String).filter(Boolean).slice(0, 6) : [];
  const tags = Array.isArray(record.tags) ? record.tags.map(String).filter(Boolean).slice(0, 12) : [];
  const status = String(record.status || "approved").trim() || "approved";

  if (!name || !description || !owner || !address || !hours) {
    throw new Error("Business name, description, owner, address, and hours are required.");
  }

  return {
    name,
    category,
    rating,
    distance,
    description,
    owner,
    address,
    hours,
    neighborhood,
    phone,
    website,
    coordinates,
    photos,
    tags,
    status
  };
}

function sanitizeComment(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Comment payload must be an object.");
  }

  const businessName = String(record.businessName || "").trim();
  const author = String(record.author || "").trim();
  const body = String(record.body || "").trim();
  const rating = Number(record.rating);
  const status = String(record.status || "approved").trim() || "approved";

  if (!businessName || !author || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Business name, author, rating, and comment are required.");
  }

  if (author.length > 80 || body.length > 1000) {
    throw new Error("Comment author or body is too long.");
  }

  if (!/[a-z]/i.test(status)) {
    throw new Error("Comment status is invalid.");
  }

  return { businessName, author, rating, body, status };
}

function sanitizeUser(record) {
  if (!record || typeof record !== "object") {
    throw new Error("User payload must be an object.");
  }

  const name = String(record.name || "").trim();
  const email = String(record.email || "").trim().toLowerCase();
  const savedBusinesses = normalizeSavedBusinesses(record.savedBusinesses);
  const interests = normalizeInterests(record.interests);

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid name and email are required.");
  }

  return { name, email, savedBusinesses, interests };
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password || ""), 12);
}

function verifyPassword(password, storedHash) {
  const candidate = String(password || "");
  if (!storedHash) {
    return false;
  }

  if (storedHash.startsWith("$2") || storedHash.startsWith("$2a") || storedHash.startsWith("$2b")) {
    return bcrypt.compareSync(candidate, storedHash);
  }

  const legacyHash = crypto.createHash("sha256").update(`${candidate}${AUTH_SECRET}`).digest("hex");
  return legacyHash === storedHash;
}

function issueAuthToken(user) {
  const payload = {
    sub: user.email,
    name: user.name,
    role: user.role || "user",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function readAuthToken(request) {
  const header = String(request.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const [encodedPayload, signature] = header.slice(7).trim().split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch (error) {
    return null;
  }
}

function requireAdmin(request, response) {
  const user = readAuthToken(request);
  if (!user || user.role !== "admin") {
    sendJson(response, 401, { error: "Administrator authentication is required." });
    return null;
  }
  return user;
}

function sanitizeAuthCredentials(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Authentication payload must be an object.");
  }

  const name = String(record.name || "").trim();
  const email = String(record.email || "").trim().toLowerCase();
  const password = String(record.password || "").trim();

  if (!email || !password || password.length < 6 || !email.includes("@")) {
    throw new Error("A valid email and password of at least 6 characters are required.");
  }

  if (record.name !== undefined && !name) {
    throw new Error("A valid name is required for registration.");
  }

  return { name, email, password };
}

async function readComments(db, businessName) {
  return dbAll(
    db,
    `SELECT id, business_name AS businessName, author, rating, body, status, created_at AS createdAt
     FROM comments
     WHERE business_name = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    [businessName]
  );
}

async function readUsers(db, emailFilter = null) {
  let sql = "SELECT id, name, email, savedBusinesses, interests FROM users";
  const params = [];

  if (emailFilter) {
    sql += " WHERE email = ?";
    params.push(emailFilter);
  }

  sql += " ORDER BY name COLLATE NOCASE";

  const rows = await dbAll(db, sql, params);

  return rows.map((row) => ({
    ...row,
    savedBusinesses: parseJsonArray(row.savedBusinesses, []),
    interests: parseJsonArray(row.interests, [])
  }));
}

async function upsertUser(db, user) {
  const savedBusinesses = JSON.stringify(normalizeSavedBusinesses(user.savedBusinesses));
  const interests = JSON.stringify(normalizeInterests(user.interests));
  const existing = await dbAll(db, "SELECT id FROM users WHERE email = ?", [user.email]);

  if (existing.length > 0) {
    await dbRun(
      db,
      `UPDATE users SET name = ?, savedBusinesses = ?, interests = ? WHERE email = ?`,
      [user.name, savedBusinesses, interests, user.email]
    );
    return { ...user, savedBusinesses: normalizeSavedBusinesses(user.savedBusinesses), interests: normalizeInterests(user.interests) };
  }

  const result = await dbRun(
    db,
    `INSERT INTO users (name, email, savedBusinesses, interests) VALUES (?, ?, ?, ?)`,
    [user.name, user.email, savedBusinesses, interests]
  );

  return { id: result.lastID, ...user, savedBusinesses: normalizeSavedBusinesses(user.savedBusinesses), interests: normalizeInterests(user.interests) };
}

function serveStaticFile(response, requestedPath) {
  const safePath = path.normalize(requestedPath).replace(/^\.+/, "");
  const filePath = path.join(rootDir, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      sendJson(response, 500, { error: "Unable to read file" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    };

    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(content);
  });
}

function createServer(options = {}) {
  const runtimeDatabasePath = options.dbPath || databasePath;
  const adminCredentials = options.adminCredentials || { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
  const dbPromise = initializeDatabase(runtimeDatabasePath, adminCredentials);
  let databaseHandle = null;
  const requestCounts = new Map();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    try {
      const requestKey = request.socket.remoteAddress || "unknown";
      const now = Date.now();
      const current = requestCounts.get(requestKey) || { startedAt: now, count: 0 };
      if (now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
        current.startedAt = now;
        current.count = 0;
      }
      current.count += 1;
      requestCounts.set(requestKey, current);
      const isAuthRoute = url.pathname.startsWith("/api/auth/");
      if (current.count > (isAuthRoute ? AUTH_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS)) {
        response.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
        sendJson(response, 429, { error: "Too many requests. Please try again later." });
        return;
      }

      const db = databaseHandle || (await dbPromise);
      databaseHandle = db;

      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      if (NODE_ENV === "production") {
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      }

      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        });
        response.end();
        return;
      }

      if (url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok", port: PORT });
        return;
      }

      if (url.pathname === "/api/comments") {
        if (request.method === "GET") {
          const businessName = String(url.searchParams.get("business") || "").trim();
          if (!businessName) {
            sendJson(response, 400, { error: "A business query is required." });
            return;
          }
          sendJson(response, 200, await readComments(db, businessName));
          return;
        }

        if (request.method === "POST") {
          const comment = sanitizeComment(await readRequestBody(request));
          const businesses = await readBusinesses(db);
          if (!businesses.some((business) => business.name === comment.businessName)) {
            sendJson(response, 404, { error: "Business not found" });
            return;
          }

          const result = await dbRun(
            db,
            "INSERT INTO comments (business_name, author, rating, body, status) VALUES (?, ?, ?, ?, ?)",
            [comment.businessName, comment.author, comment.rating, comment.body, comment.status]
          );
          const savedComments = await dbAll(
            db,
            `SELECT id, business_name AS businessName, author, rating, body, status, created_at AS createdAt
             FROM comments WHERE id = ?`,
            [result.lastID]
          );
          sendJson(response, 201, savedComments[0]);
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname.startsWith("/api/comments/")) {
        const commentId = Number(url.pathname.replace("/api/comments/", ""));
        if (request.method === "PUT") {
          const payload = await readRequestBody(request);
          const nextStatus = String(payload.status || "approved").trim();
          if (nextStatus !== "flagged" && !requireAdmin(request, response)) {
            return;
          }
          if (!nextStatus) {
            sendJson(response, 400, { error: "Comment status is required." });
            return;
          }

          const existing = await dbAll(db, "SELECT id FROM comments WHERE id = ?", [commentId]);
          if (existing.length === 0) {
            sendJson(response, 404, { error: "Comment not found" });
            return;
          }

          await dbRun(db, "UPDATE comments SET status = ? WHERE id = ?", [nextStatus, commentId]);
          const updated = await dbAll(
            db,
            `SELECT id, business_name AS businessName, author, rating, body, status, created_at AS createdAt
             FROM comments WHERE id = ?`,
            [commentId]
          );
          sendJson(response, 200, updated[0]);
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/api/businesses") {
        if (request.method === "GET") {
          const neighborhood = String(url.searchParams.get("neighborhood") || "").trim();
          const businesses = await readBusinesses(db, neighborhood ? { neighborhood } : {});
          sendJson(response, 200, businesses);
          return;
        }

        if (request.method === "POST") {
          const tokenUser = readAuthToken(request);
          if (tokenUser && tokenUser.role !== "admin") {
            sendJson(response, 403, { error: "Administrator access is required to create businesses." });
            return;
          }

          const payload = await readRequestBody(request);
          const businesses = await readBusinesses(db);

          if (Array.isArray(payload)) {
            const nextBusinesses = payload.map((item) => sanitizeBusiness(item));
            await writeBusinesses(db, nextBusinesses);
            sendJson(response, 201, nextBusinesses);
            return;
          }

          const business = sanitizeBusiness(payload);
          const existingIndex = businesses.findIndex((item) => item.name === business.name);
          const nextList = [...businesses];

          if (existingIndex >= 0) {
            nextList[existingIndex] = business;
          } else {
            nextList.push(business);
          }

          await writeBusinesses(db, nextList);
          sendJson(response, 201, business);
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/api/auth/register") {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Method not allowed" });
          return;
        }

        const payload = sanitizeAuthCredentials(await readRequestBody(request));
        const existing = await dbAll(db, "SELECT id FROM auth_users WHERE email = ?", [payload.email]);
        if (existing.length > 0) {
          sendJson(response, 409, { error: "An account with that email already exists." });
          return;
        }

        const result = await dbRun(
          db,
          "INSERT INTO auth_users (name, email, password_hash) VALUES (?, ?, ?)",
          [payload.name || payload.email.split("@")[0], payload.email, hashPassword(payload.password)]
        );

        const user = { id: result.lastID, name: payload.name || payload.email.split("@")[0], email: payload.email };
        sendJson(response, 201, { token: issueAuthToken(user), user });
        return;
      }

      if (url.pathname === "/api/auth/login") {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Method not allowed" });
          return;
        }

        const payload = sanitizeAuthCredentials(await readRequestBody(request));
        const row = await dbAll(db, "SELECT id, name, email, password_hash AS passwordHash, role FROM auth_users WHERE email = ?", [payload.email]);
        if (!row.length || !verifyPassword(payload.password, row[0].passwordHash)) {
          sendJson(response, 401, { error: "Invalid email or password." });
          return;
        }

        const user = { id: row[0].id, name: row[0].name, email: row[0].email, role: row[0].role || "user" };
        sendJson(response, 200, { token: issueAuthToken(user), user });
        return;
      }

      if (url.pathname === "/api/admin/moderation") {
        if (request.method !== "GET") {
          sendJson(response, 405, { error: "Method not allowed" });
          return;
        }

        if (!requireAdmin(request, response)) {
          return;
        }

        const items = await dbAll(
          db,
          `SELECT id, business_name AS businessName, author, rating, body, status, created_at AS createdAt
           FROM comments
           WHERE status = 'flagged'
           ORDER BY datetime(created_at) DESC, id DESC`
        );

        sendJson(response, 200, { items });
        return;
      }

      if (url.pathname === "/api/users") {
        if (request.method === "GET") {
          const tokenUser = readAuthToken(request);
          if (!tokenUser || !tokenUser.sub) {
            sendJson(response, 401, { error: "Authentication required for profile access." });
            return;
          }
          const users = await readUsers(db, tokenUser.sub);
          sendJson(response, 200, users);
          return;
        }

        if (request.method === "POST") {
          const payload = sanitizeUser(await readRequestBody(request));
          const tokenUser = readAuthToken(request);
          if (tokenUser && tokenUser.sub && tokenUser.sub.toLowerCase() !== payload.email) {
            sendJson(response, 403, { error: "You can only update your own profile." });
            return;
          }
          const saved = await upsertUser(db, payload);
          sendJson(response, 201, saved);
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/api/analytics") {
        if (request.method === "GET") {
          const businesses = await readBusinesses(db);
          const comments = await dbAll(db, "SELECT * FROM comments");
          const users = await readUsers(db);
          const flaggedComments = comments.filter((comment) => (comment.status || "approved") === "flagged").length;

          sendJson(response, 200, {
            totalBusinesses: businesses.length,
            totalComments: comments.length,
            flaggedComments,
            approvedComments: comments.length - flaggedComments,
            totalUsers: users.length,
            activeSavedPlaces: users.reduce((sum, user) => sum + (Array.isArray(user.savedBusinesses) ? user.savedBusinesses.length : 0), 0)
          });
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname.startsWith("/api/businesses/")) {
        const businessName = decodeURIComponent(url.pathname.replace("/api/businesses/", ""));
        const businesses = await readBusinesses(db);
        const targetIndex = businesses.findIndex((item) => item.name === businessName);

        if (request.method === "GET") {
          if (targetIndex === -1) {
            sendJson(response, 404, { error: "Business not found" });
            return;
          }
          sendJson(response, 200, businesses[targetIndex]);
          return;
        }

        if (request.method === "PUT") {
          const tokenUser = readAuthToken(request);
          if (!tokenUser || tokenUser.role !== "admin") {
            sendJson(response, 403, { error: "Administrator access is required to update businesses." });
            return;
          }

          const payload = await readRequestBody(request);
          const updatedBusiness = sanitizeBusiness(payload);
          const nextList = [...businesses];

          if (targetIndex === -1) {
            nextList.push(updatedBusiness);
          } else {
            nextList[targetIndex] = updatedBusiness;
          }

          await writeBusinesses(db, nextList);
          sendJson(response, 200, updatedBusiness);
          return;
        }

        if (request.method === "DELETE") {
          const tokenUser = readAuthToken(request);
          if (!tokenUser || tokenUser.role !== "admin") {
            sendJson(response, 403, { error: "Administrator access is required to delete businesses." });
            return;
          }

          if (targetIndex === -1) {
            sendJson(response, 404, { error: "Business not found" });
            return;
          }

          const nextList = businesses.filter((item) => item.name !== businessName);
          await writeBusinesses(db, nextList);
          sendJson(response, 200, { deleted: businessName });
          return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      serveStaticFile(response, url.pathname);
    } catch (error) {
      sendJson(response, 500, { error: error.message || "Server error" });
    }
  });

  server.on("close", () => {
    if (databaseHandle) {
      databaseHandle.close();
    }
  });

  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Neighbors in the Loop server running at http://${HOST}:${PORT}`);
    if (NODE_ENV !== "development") {
      console.log(`Environment: ${NODE_ENV}`);
    }
  });
}

module.exports = {
  createServer,
  readBusinesses,
  writeBusinesses,
  sanitizeBusiness,
  sanitizeComment,
  sanitizeUser,
  readComments,
  defaultBusinesses
};
