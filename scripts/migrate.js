const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, "..", "data", "nm-app.db");
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
    hours: "Open today · 8am-8pm"
  },
  {
    name: "Works & Co. Goods",
    category: "Retail",
    rating: "4.8 ★",
    distance: "1.1 mi away",
    description: "Independent home goods shop for thoughtful objects, gifts and daily living pieces.",
    owner: "Mina Torres",
    address: "24 Market Lane",
    hours: "Open today · 10am-6pm"
  },
  {
    name: "Bloom Studio",
    category: "Wellness",
    rating: "4.9 ★",
    distance: "0.8 mi away",
    description: "Yoga, therapy and care sessions designed for a balanced neighborhood lifestyle.",
    owner: "Avery Bloom",
    address: "7 Willow Court",
    hours: "Open today · 7am-8pm"
  },
  {
    name: "Oak & Thread Repair",
    category: "Service",
    rating: "4.7 ★",
    distance: "3.0 mi away",
    description: "A neighborhood clothing repair bar focused on care, reuse and everyday repair.",
    owner: "Theo Carter",
    address: "66 Cedar Avenue",
    hours: "Open today · 9am-5pm"
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
    hours TEXT NOT NULL
  )`);

  const count = (await all("SELECT COUNT(*) AS count FROM businesses"))[0].count;
  if (count === 0) {
    for (const business of defaultBusinesses) {
      await run(
        `INSERT INTO businesses (name, category, rating, distance, description, owner, address, hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business.name,
          business.category,
          business.rating,
          business.distance,
          business.description,
          business.owner,
          business.address,
          business.hours
        ]
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
