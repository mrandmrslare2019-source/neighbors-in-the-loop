const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");

const { createServer } = require("../server.js");

function createTestServer(options = {}) {
  const uniqueDbPath = path.join(__dirname, "tmp", `test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  fs.mkdirSync(path.dirname(uniqueDbPath), { recursive: true });
  return createServer({ dbPath: uniqueDbPath, ...options });
}

function sendRequest(server, pathName, method = "GET", payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const request = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path: pathName,
        method,
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data),
              ...extraHeaders
            }
          : extraHeaders
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body
          });
        });
      }
    );

    request.on("error", reject);

    if (data) {
      request.write(data);
    }

    request.end();
  });
}

async function loginAsAdmin(server, email = "admin@example.com", password = "admin-password") {
  const response = await sendRequest(server, "/api/auth/login", "POST", {
    email,
    password
  });
  const body = JSON.parse(response.body);
  return body.token;
}

test("GET /api/businesses returns an array", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await sendRequest(server, "/api/businesses");
    assert.equal(response.statusCode, 200);
    const businesses = JSON.parse(response.body);
    assert.ok(Array.isArray(businesses));
    assert.ok(businesses.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/businesses supports neighborhood filter", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await sendRequest(server, "/api/businesses?neighborhood=Maple");
    assert.equal(response.statusCode, 200);
    const businesses = JSON.parse(response.body);
    assert.ok(Array.isArray(businesses));
    assert.ok(businesses.some((business) => business.neighborhood && business.neighborhood.toLowerCase().includes("maple")));
    assert.ok(businesses.every((business) => !business.neighborhood || business.neighborhood.toLowerCase().includes("maple")));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/businesses creates a new business", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const payload = {
      name: "North Loop Café",
      category: "Food",
      rating: "4.7 ★",
      distance: "1.9 mi away",
      description: "Neighborhood coffee and bakery focused on slow mornings.",
      owner: "Lee Chen",
      address: "12 North Loop",
      hours: "Open today · 7am-6pm",
      neighborhood: "North Loop",
      coordinates: { lat: 41.8731, lng: -87.6392 }
    };

    const response = await sendRequest(server, "/api/businesses", "POST", payload, {
      Authorization: "Bearer invalidtoken"
    });
    assert.equal(response.statusCode, 201);

    const responseBody = JSON.parse(response.body);
    assert.equal(responseBody.name, "North Loop Café");
    assert.equal(responseBody.neighborhood, "North Loop");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("PUT and DELETE update and remove a business when authenticated as admin", async () => {
  const server = createTestServer({
    adminCredentials: { email: "admin@example.com", password: "admin-password" }
  });
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const adminToken = await loginAsAdmin(server);
    const created = await sendRequest(
      server,
      "/api/businesses",
      "POST",
      {
        name: "Market Street Studio",
        category: "Retail",
        rating: "4.8 ★",
        distance: "1.2 mi away",
        description: "Curated products for home and craft.",
        owner: "Sam Ortiz",
        address: "44 Market Street",
        hours: "Open today · 11am-7pm",
        neighborhood: "Market Street",
        coordinates: { lat: 41.8812, lng: -87.6329 }
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.equal(created.statusCode, 201);

    const updated = await sendRequest(
      server,
      "/api/businesses/Market%20Street%20Studio",
      "PUT",
      {
        name: "Market Street Studio",
        category: "Retail",
        rating: "5.0 ★",
        distance: "1.2 mi away",
        description: "Updated inventory and craft workshops.",
        owner: "Sam Ortiz",
        address: "44 Market Street",
        hours: "Open today · 11am-7pm",
        neighborhood: "Market Street",
        coordinates: { lat: 41.8812, lng: -87.6329 }
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.equal(updated.statusCode, 200);
    const updatedBody = JSON.parse(updated.body);
    assert.equal(updatedBody.rating, "5.0 ★");

    const removed = await sendRequest(server, "/api/businesses/Market%20Street%20Studio", "DELETE", undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.equal(removed.statusCode, 200);
    const list = JSON.parse((await sendRequest(server, "/api/businesses")).body);
    assert.ok(!list.some((business) => business.name === "Market Street Studio"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST and GET comments for a business", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await sendRequest(server, "/api/comments", "POST", {
      businessName: "Corner Table Kitchen",
      author: "Jordan Lee",
      rating: 5,
      body: "The seasonal menu is worth checking out."
    });

    assert.equal(response.statusCode, 201);
    const comment = JSON.parse(response.body);
    assert.equal(comment.author, "Jordan Lee");

    const comments = await sendRequest(
      server,
      "/api/comments?business=Corner%20Table%20Kitchen"
    );
    assert.equal(comments.statusCode, 200);
    assert.ok(JSON.parse(comments.body).some((item) => item.body === comment.body));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/businesses stores coordinates and profile details", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const payload = {
      name: "Lakeside Labs",
      category: "Professional",
      rating: "4.8 ★",
      distance: "1.6 mi away",
      description: "Design and strategy studio for growing neighborhood brands.",
      owner: "Maya Lopez",
      address: "18 Harbor Lane",
      hours: "Open today · 9am-6pm",
      neighborhood: "Harbor District",
      phone: "(555) 401-8800",
      website: "https://lakesidelabs.example",
      coordinates: {
        lat: 41.8781,
        lng: -87.6298
      },
      photos: ["https://example.com/cover.jpg"],
      tags: ["creative", "design"]
    };

    const response = await sendRequest(server, "/api/businesses", "POST", payload, { Authorization: "Bearer invalidtoken" });
    assert.equal(response.statusCode, 201);

    const saved = JSON.parse(response.body);
    assert.equal(saved.name, "Lakeside Labs");
    assert.equal(saved.neighborhood, "Harbor District");
    assert.equal(saved.coordinates.lat, 41.8781);
    assert.equal(saved.coordinates.lng, -87.6298);
    assert.equal(saved.phone, "(555) 401-8800");
    assert.equal(saved.website, "https://lakesidelabs.example");
    assert.deepEqual(saved.photos, ["https://example.com/cover.jpg"]);
    assert.deepEqual(saved.tags, ["creative", "design"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/users stores a profile and liked businesses", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await sendRequest(server, "/api/users", "POST", {
      name: "Ari Chen",
      email: "ari@example.com",
      savedBusinesses: ["Corner Table Kitchen", "Bloom Studio"],
      interests: ["Food", "Wellness"]
    });

    assert.equal(response.statusCode, 201);
    const profile = JSON.parse(response.body);
    assert.equal(profile.name, "Ari Chen");
    assert.deepEqual(profile.savedBusinesses, ["Corner Table Kitchen", "Bloom Studio"]);
    assert.deepEqual(profile.interests, ["Food", "Wellness"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/analytics returns moderation and directory counts", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    await sendRequest(server, "/api/comments", "POST", {
      businessName: "Corner Table Kitchen",
      author: "Morgan Frank",
      rating: 2,
      body: "The room was loud, but the food was still good.",
      status: "flagged"
    });

    const response = await sendRequest(server, "/api/analytics");
    assert.equal(response.statusCode, 200);

    const analytics = JSON.parse(response.body);
    assert.ok(analytics.totalBusinesses >= 1);
    assert.ok(analytics.totalComments >= 1);
    assert.ok(analytics.flaggedComments >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/auth/register and /api/auth/login issue a working profile token", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const register = await sendRequest(server, "/api/auth/register", "POST", {
      name: "Taylor Smith",
      email: "taylor@example.com",
      password: "password123"
    });
    assert.equal(register.statusCode, 201);

    const login = await sendRequest(server, "/api/auth/login", "POST", {
      email: "taylor@example.com",
      password: "password123"
    });
    assert.equal(login.statusCode, 200);

    const auth = JSON.parse(login.body);
    assert.ok(auth.token);
    assert.equal(auth.token.split(".").length, 2);
    assert.equal(auth.user.email, "taylor@example.com");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/admin/moderation returns flagged review details", async () => {
  const server = createTestServer({
    adminCredentials: { email: "admin@example.com", password: "admin-password" }
  });
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const adminToken = await loginAsAdmin(server);
    await sendRequest(server, "/api/comments", "POST", {
      businessName: "Bloom Studio",
      author: "Casey Lane",
      rating: 1,
      body: "This review should be reviewed by moderators.",
      status: "flagged"
    });

    const response = await sendRequest(server, "/api/admin/moderation", "GET", undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.equal(response.statusCode, 200);

    const moderation = JSON.parse(response.body);
    assert.ok(Array.isArray(moderation.items));
    assert.ok(moderation.items.some((item) => item.businessName === "Bloom Studio"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Averages rating from comments and returns it in business results", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    await sendRequest(server, "/api/comments", "POST", {
      businessName: "Corner Table Kitchen",
      author: "Reviewer 1",
      rating: 5,
      body: "Great food and service."
    });

    await sendRequest(server, "/api/comments", "POST", {
      businessName: "Corner Table Kitchen",
      author: "Reviewer 2",
      rating: 3,
      body: "Good food, a little noisy."
    });

    const response = await sendRequest(server, "/api/businesses");
    assert.equal(response.statusCode, 200);
    const businesses = JSON.parse(response.body);
    const match = businesses.find((business) => business.name === "Corner Table Kitchen");
    assert.ok(match);
    assert.equal(match.rating, "4.0 ★");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Requesting user profile without auth is rejected", async () => {
  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await sendRequest(server, "/api/users", "GET");
    assert.equal(response.statusCode, 401);
    const payload = JSON.parse(response.body);
    assert.match(payload.error, /Authentication required/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

