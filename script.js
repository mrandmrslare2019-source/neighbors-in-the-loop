let cards = Array.from(document.querySelectorAll(".business-card"));
const chips = Array.from(document.querySelectorAll(".filter-chip"));
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const searchToggle = document.getElementById("searchToggle");
const addBusinessButton = document.getElementById("addBusinessButton");
const businessFormModal = document.getElementById("businessFormModal");
const closeFormButton = document.getElementById("closeFormButton");
const cancelForm = document.getElementById("cancelForm");
const businessForm = document.getElementById("businessForm");
const businessGrid = document.getElementById("businessGrid");
const emptyState = document.getElementById("emptyState");
const recommendationCount = document.getElementById("recommendationCount");
const donationTotal = document.getElementById("donationTotal");
const statsBusinesses = document.getElementById("statsBusinesses");
const statsFlagged = document.getElementById("statsFlagged");
const donationButton = document.getElementById("donationButton");
const donationMiniButton = document.getElementById("donationMiniButton");
const donationModal = document.getElementById("donationModal");
const closeDonationButton = document.getElementById("closeDonationButton");
const cancelDonationButton = document.getElementById("cancelDonationButton");
const donationForm = document.getElementById("donationForm");
const donationSuccess = document.getElementById("donationSuccess");
const moderationList = document.getElementById("moderationList");
const moderationLoginForm = document.getElementById("moderationLoginForm");
const moderationEmail = document.getElementById("moderationEmail");
const moderationPassword = document.getElementById("moderationPassword");
const moderationRefreshButton = document.getElementById("moderationRefreshButton");
const moderationSignOutButton = document.getElementById("moderationSignOutButton");
const moderationMessage = document.getElementById("moderationMessage");

const detailCategory = document.getElementById("detailCategory");
const detailRating = document.getElementById("detailRating");
const detailTitle = document.getElementById("detailTitle");
const detailDistance = document.getElementById("detailDistance");
const detailDescription = document.getElementById("detailDescription");
const detailPhotos = document.getElementById("detailPhotos");
const detailTags = document.getElementById("detailTags");
const detailOwner = document.getElementById("detailOwner");
const detailAddress = document.getElementById("detailAddress");
const detailHours = document.getElementById("detailHours");
const detailNeighborhood = document.getElementById("detailNeighborhood");
const detailPhone = document.getElementById("detailPhone");
const detailWebsite = document.getElementById("detailWebsite");
const commentsList = document.getElementById("commentsList");
const commentsEmpty = document.getElementById("commentsEmpty");
const commentsCount = document.getElementById("commentsCount");
const commentForm = document.getElementById("commentForm");
const commentAuthor = document.getElementById("commentAuthor");
const commentRating = document.getElementById("commentRating");
const commentBody = document.getElementById("commentBody");
const savePlaceButton = document.getElementById("savePlaceButton");

const API_URL = "/api/businesses";
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const businessDashboard = document.getElementById("businessDashboard");
const mapPanel = document.getElementById("mapPanel");
const mapMarkers = document.getElementById("mapMarkers");
const mapCanvas = document.getElementById("mapCanvas");
const mapToggleButton = document.getElementById("mapToggleButton");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const resultsSummary = document.getElementById("resultsSummary");
const defaultBusinessData = {
  "Corner Table Kitchen": {
    category: "Food",
    rating: "4.9 ★",
    distance: "2.4 mi away",
    description: "Seasonal market kitchen with neighborhood dinners and house-made comfort food.",
    owner: "The Corner Table Team",
    address: "118 Maple Street",
    hours: "Open today · 8am-8pm",
    verified: true
  },
  "Works & Co. Goods": {
    category: "Retail",
    rating: "4.8 ★",
    distance: "1.1 mi away",
    description: "Independent home goods shop for thoughtful objects, gifts and daily living pieces.",
    owner: "Mina Torres",
    address: "24 Market Lane",
    hours: "Open today · 10am-6pm",
    verified: true
  },
  "Bloom Studio": {
    category: "Wellness",
    rating: "4.9 ★",
    distance: "0.8 mi away",
    description: "Yoga, therapy and care sessions designed for a balanced neighborhood lifestyle.",
    owner: "Avery Bloom",
    address: "7 Willow Court",
    hours: "Open today · 7am-8pm",
    verified: true
  },
  "Oak & Thread Repair": {
    category: "Service",
    rating: "4.7 ★",
    distance: "3.0 mi away",
    description: "A neighborhood clothing repair bar focused on care, reuse and everyday repair.",
    owner: "Theo Carter",
    address: "66 Cedar Avenue",
    hours: "Open today · 9am-5pm",
    verified: true
  }
};

let businessData = { ...defaultBusinessData };
let recommendationCounter = 24000;
let donationTotalValue = Number(localStorage.getItem("neighborsInTheLoopDonationTotal") || 260);
let currentView = "discover";
let savedPlaces = new Set(JSON.parse(localStorage.getItem("neighborsInTheLoopSaved") || "[]"));
let mapInstance = null;
let mapMarkersLayer = null;
let adminToken = localStorage.getItem("neighborsInTheLoopAdminToken") || "";
let currentUser = {
  name: "Local Explorer",
  email: "explorer@neighbors.local",
  savedBusinesses: [],
  interests: ["Food", "Wellness", "Community"]
};

async function loadBusinessData() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error("Unable to load businesses from API.");
    }

    const businesses = await response.json();
    if (!Array.isArray(businesses)) {
      throw new Error("Invalid API response.");
    }

    businessData = businesses.reduce((map, business) => {
      map[business.name] = business;
      return map;
    }, {});
    return businessData;
  } catch (error) {
    console.warn("Falling back to default business data.", error);
    businessData = { ...defaultBusinessData };
    return businessData;
  }
}

async function saveBusinessData(business) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(business)
    });

    if (!response.ok) {
      throw new Error("Unable to save business via API.");
    }

    const savedBusiness = await response.json();
    businessData[savedBusiness.name] = savedBusiness;
    return savedBusiness;
  } catch (error) {
    console.warn("Unable to save Neighbors in the Loop businesses", error);
    return null;
  }
}

async function updateBusinessData(business) {
  try {
    const response = await fetch(`${API_URL}/${encodeURIComponent(business.name)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(business)
    });

    if (!response.ok) {
      throw new Error("Unable to update business via API.");
    }

    const updatedBusiness = await response.json();
    businessData[updatedBusiness.name] = updatedBusiness;
    return updatedBusiness;
  } catch (error) {
    console.warn("Unable to update Neighbors in the Loop businesses", error);
    return null;
  }
}

async function deleteBusinessData(name) {
  try {
    const response = await fetch(`${API_URL}/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Unable to delete business via API.");
    }

    delete businessData[name];
    return true;
  } catch (error) {
    console.warn("Unable to delete Neighbors in the Loop businesses", error);
    return false;
  }
}

function formatRecommendationCount(value) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return `${value}`;
}

function updateDonationDisplay() {
  donationTotal.textContent = `$${donationTotalValue}`;
  localStorage.setItem("neighborsInTheLoopDonationTotal", String(donationTotalValue));
}

function openDonationModal() {
  donationModal.classList.remove("hidden");
  donationSuccess.classList.add("hidden");
  donationSuccess.textContent = "";
}

function closeDonationModal() {
  donationModal.classList.add("hidden");
  donationForm.reset();
  donationForm.donationName.value = "Local supporter";
  donationSuccess.classList.add("hidden");
  donationSuccess.textContent = "";
}

function applyFilter(category) {
  const term = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach((card) => {
    const categoryIsMatch = category === "All" || card.dataset.category === category;
    const text = card.innerText.toLowerCase();
    const searchableIsMatch = text.includes(term);
    const isVisible = categoryIsMatch && searchableIsMatch;
    card.classList.toggle("hidden", !isVisible);
    if (isVisible) {
      visibleCount += 1;
    }
  });

  emptyState.classList.toggle("hidden", visibleCount > 0);
}

async function syncUserProfile() {
  currentUser.savedBusinesses = [...savedPlaces];

  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentUser)
    });
  } catch (error) {
    console.warn("User profile sync skipped.", error);
  }
}

async function flagReview(commentId, nextStatus = "flagged") {
  try {
    const headers = { "Content-Type": "application/json" };
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      throw new Error("Unable to update review state");
    }

    const activeBusiness = commentForm.dataset.businessName;
    if (activeBusiness) {
      await loadComments(activeBusiness);
      await loadAnalytics();
    }
  } catch (error) {
    console.warn("Review moderation update failed.", error);
  }
}

async function loadComments(businessName) {
  try {
    const response = await fetch(`/api/comments?business=${encodeURIComponent(businessName)}`);
    if (!response.ok) {
      throw new Error("Unable to load comments.");
    }

    const comments = await response.json();
    commentsList.querySelectorAll(".comment-item").forEach((item) => item.remove());
    commentsCount.textContent = comments.length;
    commentsEmpty.classList.toggle("hidden", comments.length > 0);

    comments.forEach((comment) => {
      const item = document.createElement("article");
      item.className = "comment-item";
      item.innerHTML = `<div class="comment-item-head"><strong></strong><span class="comment-rating"></span><time></time></div><p></p><div class="comment-actions"></div>`;
      item.querySelector("strong").textContent = comment.author;
      item.querySelector(".comment-rating").textContent = comment.rating ? `${comment.rating} ★` : "";
      item.querySelector("time").textContent = new Date(comment.createdAt).toLocaleDateString();
      item.querySelector("p").textContent = comment.body;
      const actions = item.querySelector(".comment-actions");
      const state = (comment.status || "approved").toLowerCase();
      if (state === "flagged") {
        const flag = document.createElement("span");
        flag.className = "comment-flagged";
        flag.textContent = "Flagged";
        item.querySelector(".comment-item-head").appendChild(flag);
        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.className = "comment-action approve";
        approveButton.textContent = "Approve";
        approveButton.addEventListener("click", () => flagReview(comment.id, "approved"));
        actions.appendChild(approveButton);
      } else {
        const flagButton = document.createElement("button");
        flagButton.type = "button";
        flagButton.className = "comment-action";
        flagButton.textContent = "Flag review";
        flagButton.addEventListener("click", () => flagReview(comment.id, "flagged"));
        actions.appendChild(flagButton);
      }
      commentsList.appendChild(item);
    });
  } catch (error) {
    commentsList.querySelectorAll(".comment-item").forEach((item) => item.remove());
    commentsCount.textContent = "0";
    commentsEmpty.textContent = "Comments are unavailable right now.";
    commentsEmpty.classList.remove("hidden");
  }
}

async function loadAnalytics() {
  try {
    const response = await fetch("/api/analytics");
    if (!response.ok) {
      throw new Error("Unable to load analytics");
    }

    const analytics = await response.json();
    statsBusinesses.textContent = analytics.totalBusinesses ?? "0";
    statsFlagged.textContent = analytics.flaggedComments ?? "0";
  } catch (error) {
    statsBusinesses.textContent = Object.keys(businessData).length || "0";
    statsFlagged.textContent = "0";
  }

  await loadModeration();
}

async function loadModeration() {
  try {
    const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
    const response = await fetch("/api/admin/moderation", { headers });
    if (response.status === 401) {
      moderationList.innerHTML = '<p class="comments-empty">Sign in as an administrator to view this queue.</p>';
      moderationSignOutButton.hidden = !adminToken;
      return;
    }
    if (!response.ok) {
      throw new Error("Unable to load moderation queue");
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    moderationList.innerHTML = "";

    if (!items.length) {
      moderationList.innerHTML = '<p class="comments-empty">No flagged reviews right now.</p>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "moderation-item";
      card.innerHTML = `
        <div>
          <div class="moderation-meta">
            <span class="moderation-business">${item.businessName || "Local business"}</span>
            <span class="moderation-status">Flagged</span>
          </div>
          <h3>${item.author || "Anonymous"}</h3>
          <p>${item.body || "Review pending moderation."}</p>
        </div>
        <button type="button" class="moderation-approve">Approve</button>
      `;

      const approveButton = card.querySelector(".moderation-approve");
      approveButton.addEventListener("click", async () => {
        await flagReview(item.id, "approved");
      });

      moderationList.appendChild(card);
    });
  } catch (error) {
    moderationList.innerHTML = '<p class="comments-empty">Moderation queue is temporarily unavailable.</p>';
  }
}

async function signInAdmin(event) {
  event.preventDefault();
  moderationMessage.classList.add("hidden");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: moderationEmail.value, password: moderationPassword.value })
    });
    const result = await response.json();
    if (!response.ok || result.user?.role !== "admin") {
      throw new Error("Administrator credentials were not accepted.");
    }

    adminToken = result.token;
    localStorage.setItem("neighborsInTheLoopAdminToken", adminToken);
    moderationPassword.value = "";
    moderationSignOutButton.hidden = false;
    await loadModeration();
  } catch (error) {
    moderationMessage.textContent = error.message;
    moderationMessage.classList.remove("hidden");
  }
}

function signOutAdmin() {
  adminToken = "";
  localStorage.removeItem("neighborsInTheLoopAdminToken");
  moderationSignOutButton.hidden = true;
  loadModeration();
}

async function updateDetails(card) {
  const title = card.querySelector("h3").textContent.trim();
  const business = businessData[title] || defaultBusinessData["Corner Table Kitchen"];

  detailCategory.textContent = business.category;
  detailCategory.className = `detail-category ${business.category.toLowerCase()}`;
  detailRating.textContent = business.rating;
  detailTitle.textContent = title;
  const verifiedBadge = document.getElementById("detailVerified");
  if (verifiedBadge) {
    verifiedBadge.classList.toggle("hidden", !business.verified);
    verifiedBadge.textContent = business.verified ? "Verified local" : "Community listing";
  }
  detailDistance.textContent = business.distance;
  detailDescription.textContent = business.description;
  detailPhotos.innerHTML = "";
  const photos = Array.isArray(business.photos) && business.photos.length > 0 ? business.photos : [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80"
  ];
  photos.forEach((photo) => {
    const image = document.createElement("img");
    image.src = photo;
    image.alt = title;
    image.loading = "lazy";
    detailPhotos.appendChild(image);
  });

  detailTags.innerHTML = "";
  const tags = Array.isArray(business.tags) && business.tags.length > 0 ? business.tags : [business.category];
  tags.forEach((tag) => {
    const badge = document.createElement("span");
    badge.className = "detail-tag";
    badge.textContent = tag;
    detailTags.appendChild(badge);
  });

  detailOwner.textContent = business.owner;
  detailAddress.textContent = business.address;
  detailHours.textContent = business.hours;
  detailNeighborhood.textContent = business.neighborhood || "Neighborhood spot";
  detailPhone.textContent = business.phone || "Call for details";
  detailWebsite.textContent = business.website || "Visit listing";
  commentForm.dataset.businessName = title;
  savePlaceButton.textContent = savedPlaces.has(title) ? "Saved place" : "Save place";
  savePlaceButton.classList.toggle("saved", savedPlaces.has(title));
  await loadComments(title);
}

function openBusinessForm() {
  businessFormModal.classList.remove("hidden");
}

function closeBusinessForm() {
  businessFormModal.classList.add("hidden");
  businessForm.reset();
}

function createBusinessCardFromData(name, data) {
  const newCard = document.createElement("article");
  const category = data.category;
  const coverPhoto = Array.isArray(data.photos) && data.photos.length > 0 ? data.photos[0] : "";

  newCard.className = "business-card";
  newCard.dataset.category = category;
  newCard.dataset.name = name;
  const verifiedMarkup = data.verified ? '<span class="business-verified">Verified</span>' : '';
  newCard.innerHTML = `
    <div class="business-card-top">
      <span class="business-category ${category.toLowerCase()}">${category}</span>
      <span class="business-rating">${data.rating}</span>
    </div>
    ${coverPhoto ? `<img class="business-card-image" src="${coverPhoto}" alt="${name}" loading="lazy" />` : ""}
    <div class="business-title-row">
      <h3>${name}</h3>
      ${verifiedMarkup}
    </div>
    <p class="business-detail">${data.description}</p>
    <div class="business-meta">
      <span>${data.distance}</span>
      <span>${data.hours}</span>
    </div>
    <div class="detail-tags card-tags">${(Array.isArray(data.tags) ? data.tags : []).slice(0, 2).map((tag) => `<span class="detail-tag">${tag}</span>`).join("") || `<span class="detail-tag">${category}</span>`}</div>
    <div class="business-actions">
      <button class="business-button">Recommend</button>
      <button class="card-action" data-action="edit" type="button">Edit</button>
      <button class="card-action delete" data-action="delete" type="button">Delete</button>
    </div>
  `;

  const recommendationButton = newCard.querySelector(".business-button");
  recommendationButton.addEventListener("click", (event) => {
    event.stopPropagation();
    recommendationCounter += 1;
    recommendationCount.textContent = formatRecommendationCount(recommendationCounter);
    recommendationButton.textContent = "Recommended";
    recommendationButton.disabled = true;
  });

  const editButton = newCard.querySelector('[data-action="edit"]');
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    fillBusinessFormForEdit(name);
  });

  const deleteButton = newCard.querySelector('[data-action="delete"]');
  deleteButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    const deleted = await deleteBusinessData(name);
    if (deleted) {
      await initializeBusinesses();
    }
  });

  newCard.addEventListener("click", () => {
    updateDetails(newCard);
  });

  businessGrid.appendChild(newCard);
  cards.push(newCard);
}

function getFilteredBusinesses() {
  const activeCategory = chips.find((chip) => chip.classList.contains("active"))?.dataset.category || "All";
  const term = searchInput.value.trim().toLowerCase();
  const sortKey = sortSelect.value;

  return Object.entries(businessData)
    .map(([name, data]) => ({ name, data }))
    .filter(({ name, data }) => {
      const isSavedMatch = currentView !== "saved" || savedPlaces.has(name);
      const matchesCategory = activeCategory === "All" || data.category === activeCategory;
      const matchesSearch = `${name} ${data.category} ${data.address}`.toLowerCase().includes(term);
      return isSavedMatch && matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const left = a.data[sortKey] || a.name;
      const right = b.data[sortKey] || b.name;
      return String(left).localeCompare(String(right));
    });
}

function ensureMapReady() {
  if (!mapCanvas) {
    return null;
  }

  if (!window.L) {
    return null;
  }

  if (!mapInstance) {
    mapInstance = L.map(mapCanvas, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([41.8781, -87.6298], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(mapInstance);

    mapMarkersLayer = L.layerGroup().addTo(mapInstance);
  }

  return mapInstance;
}

function renderMapMarkers() {
  if (!mapMarkers && !mapCanvas) {
    return;
  }

  if (!ensureMapReady()) {
    if (mapMarkers) {
      const filteredBusinesses = getFilteredBusinesses();
      mapMarkers.innerHTML = "";
      filteredBusinesses.forEach(({ name, data }) => {
        const marker = document.createElement("button");
        const coordinates = data.coordinates || { lat: 41.8781, lng: -87.6298 };
        const x = Math.min(92, Math.max(8, ((coordinates.lng + 180) / 360) * 100));
        const y = Math.min(88, Math.max(12, ((90 - coordinates.lat) / 180) * 100));

        marker.type = "button";
        marker.className = `map-marker ${data.category.toLowerCase()}`;
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        marker.textContent = data.category.slice(0, 2).toUpperCase();
        marker.title = name;
        marker.addEventListener("click", () => {
          const businessCard = Array.from(document.querySelectorAll(".business-card")).find((card) => card.dataset.name === name);
          if (businessCard) {
            updateDetails(businessCard);
          }
        });
        mapMarkers.appendChild(marker);
      });
    }
    return;
  }

  if (mapMarkersLayer) {
    mapMarkersLayer.clearLayers();
  }

  const filteredBusinesses = getFilteredBusinesses();
  if (!filteredBusinesses.length) {
    return;
  }

  const points = filteredBusinesses.map(({ name, data }) => {
    const coordinates = data.coordinates || { lat: 41.8781, lng: -87.6298 };
    return { name, coordinates, category: data.category };
  });

  const averageLat = points.reduce((sum, item) => sum + item.coordinates.lat, 0) / points.length;
  const averageLng = points.reduce((sum, item) => sum + item.coordinates.lng, 0) / points.length;
  mapInstance.setView([averageLat, averageLng], 12);

  points.forEach(({ name, coordinates, category }) => {
    const marker = L.marker([coordinates.lat, coordinates.lng]).addTo(mapMarkersLayer);
    marker.bindPopup(`<strong>${name}</strong><br>${category}`);
    marker.on("click", () => {
      const businessCard = Array.from(document.querySelectorAll(".business-card")).find((card) => card.dataset.name === name);
      if (businessCard) {
        updateDetails(businessCard);
      }
    });
  });
}

function renderBusinessCards() {
  businessGrid.querySelectorAll(".business-card").forEach((card) => card.remove());
  cards = [];

  const sortedBusinesses = getFilteredBusinesses();
  const activeCategory = chips.find((chip) => chip.classList.contains("active"))?.dataset.category || "All";
  const searchTerm = searchInput.value.trim();
  const savedCount = savedPlaces.size;

  if (currentView === "saved") {
    resultsSummary.textContent = savedCount > 0
      ? `${sortedBusinesses.length} saved place${sortedBusinesses.length === 1 ? "" : "s"}${activeCategory !== "All" ? ` in ${activeCategory}` : ""}${searchTerm ? ` for “${searchTerm}”` : ""}`
      : "No saved places yet";
  } else {
    resultsSummary.textContent = `${sortedBusinesses.length} place${sortedBusinesses.length === 1 ? "" : "s"} found${activeCategory !== "All" ? ` in ${activeCategory}` : ""}${searchTerm ? ` for “${searchTerm}”` : ""}`;
  }

  sortedBusinesses.forEach(({ name, data }) => {
    createBusinessCardFromData(name, data);
  });

  emptyState.classList.toggle("hidden", sortedBusinesses.length > 0);
  if (sortedBusinesses.length > 0) {
    const firstVisible = cards[0];
    if (firstVisible) {
      updateDetails(firstVisible);
    }
  }

  renderMapMarkers();
}

async function initializeBusinesses() {
  await loadBusinessData();
  renderBusinessCards();
  recommendationCount.textContent = formatRecommendationCount(recommendationCounter);
}

chips.forEach((chip) => {
  chip.addEventListener("click", (event) => {
    event.preventDefault();
    chips.forEach((item) => item.classList.toggle("active", item === chip));
    renderBusinessCards();
  });
});

function setView(view) {
  currentView = view;
  const isMapView = view === "map";
  const isSavedView = view === "saved";
  businessDashboard.classList.toggle("hidden", isMapView);
  mapPanel.classList.toggle("hidden", !isMapView);
  mapToggleButton.textContent = isMapView ? "Back to list" : "View map";

  if (isSavedView) {
    searchInput.placeholder = "Search saved places";
  } else {
    searchInput.placeholder = "Search by name, city, or category";
  }

  if (isMapView) {
    renderMapMarkers();
  } else {
    renderBusinessCards();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const view = link.dataset.view;
    navLinks.forEach((item) => item.classList.toggle("active", item === link));
    setView(view === "map" ? "map" : view === "saved" ? "saved" : "discover");
  });
});

mapToggleButton.addEventListener("click", () => {
  const isMapVisible = !mapPanel.classList.contains("hidden");
  const nextView = isMapVisible ? "discover" : "map";
  navLinks.forEach((item) => item.classList.toggle("active", item.dataset.view === nextView));
  setView(nextView);
});

searchInput.addEventListener("input", () => {
  renderBusinessCards();
});

sortSelect.addEventListener("change", () => {
  renderBusinessCards();
});

savePlaceButton.addEventListener("click", async () => {
  const businessName = commentForm.dataset.businessName;
  if (!businessName) {
    return;
  }

  if (savedPlaces.has(businessName)) {
    savedPlaces.delete(businessName);
  } else {
    savedPlaces.add(businessName);
  }

  localStorage.setItem("neighborsInTheLoopSaved", JSON.stringify([...savedPlaces]));
  currentUser.savedBusinesses = [...savedPlaces];
  savePlaceButton.textContent = savedPlaces.has(businessName) ? "Saved place" : "Save place";
  savePlaceButton.classList.toggle("saved", savedPlaces.has(businessName));
  await syncUserProfile();
  renderBusinessCards();
});

clearFiltersButton.addEventListener("click", () => {
  chips.forEach((item) => item.classList.toggle("active", item.dataset.category === "All"));
  searchInput.value = "";
  sortSelect.value = "name";
  renderBusinessCards();
});

searchToggle.addEventListener("click", () => {
  searchInput.focus();
});

moderationLoginForm.addEventListener("submit", signInAdmin);
moderationRefreshButton.addEventListener("click", loadModeration);
moderationSignOutButton.addEventListener("click", signOutAdmin);

function fillBusinessFormForEdit(name) {
  const business = businessData[name];
  if (!business) {
    return;
  }

  businessForm.dataset.editingName = name;
  businessForm.businessName.value = name;
  businessForm.businessCategory.value = business.category;
  businessForm.businessOwner.value = business.owner;
  businessForm.businessAddress.value = business.address;
  businessForm.businessDistance.value = business.distance;
  businessForm.businessHours.value = business.hours;
  businessForm.businessNeighborhood.value = business.neighborhood || "";
  businessForm.businessPhone.value = business.phone || "";
  businessForm.businessWebsite.value = business.website || "";
  businessForm.businessPhotos.value = Array.isArray(business.photos) ? business.photos.join(", ") : "";
  businessForm.businessTags.value = Array.isArray(business.tags) ? business.tags.join(", ") : "";
  businessForm.businessLatitude.value = business.coordinates?.lat ?? 41.8781;
  businessForm.businessLongitude.value = business.coordinates?.lng ?? -87.6298;
  businessForm.businessDescription.value = business.description;
  const submitButton = businessForm.querySelector("button[type='submit']");
  submitButton.textContent = "Save changes";
  openBusinessForm();
}

addBusinessButton.addEventListener("click", () => {
  delete businessForm.dataset.editingName;
  businessForm.reset();
  const submitButton = businessForm.querySelector("button[type='submit']");
  submitButton.textContent = "Create listing";
  openBusinessForm();
});

closeFormButton.addEventListener("click", () => {
  businessForm.reset();
  delete businessForm.dataset.editingName;
  const submitButton = businessForm.querySelector("button[type='submit']");
  submitButton.textContent = "Create listing";
  closeBusinessForm();
});
cancelForm.addEventListener("click", () => {
  businessForm.reset();
  delete businessForm.dataset.editingName;
  const submitButton = businessForm.querySelector("button[type='submit']");
  submitButton.textContent = "Create listing";
  closeBusinessForm();
});

businessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(businessForm);
  const name = String(formData.get("businessName") || "").trim();
  const category = String(formData.get("businessCategory") || "Food");
  const address = String(formData.get("businessAddress") || "").trim();
  const distance = String(formData.get("businessDistance") || "").trim();
  const owner = String(formData.get("businessOwner") || "").trim();
  const hours = String(formData.get("businessHours") || "").trim();
  const description = String(formData.get("businessDescription") || "").trim();
  const neighborhood = String(formData.get("businessNeighborhood") || "").trim();
  const phone = String(formData.get("businessPhone") || "").trim();
  const website = String(formData.get("businessWebsite") || "").trim();
  const lat = Number(formData.get("businessLatitude") || 41.8781);
  const lng = Number(formData.get("businessLongitude") || -87.6298);

  if (!name || !address || !distance || !owner || !hours || !description) {
    return;
  }

  const nextEntry = {
    name,
    category,
    rating: businessData[name]?.rating || "4.8 ★",
    distance,
    description,
    owner,
    address,
    hours,
    neighborhood,
    phone,
    website,
    coordinates: {
      lat: Number.isFinite(lat) ? lat : 41.8781,
      lng: Number.isFinite(lng) ? lng : -87.6298
    }
  };

  const photoField = String(formData.get("businessPhotos") || "").trim();
  const tagField = String(formData.get("businessTags") || "").trim();
  nextEntry.photos = photoField ? photoField.split(",").map((item) => item.trim()).filter(Boolean) : [];
  nextEntry.tags = tagField ? tagField.split(",").map((item) => item.trim()).filter(Boolean) : [];

  if (businessForm.dataset.editingName && businessForm.dataset.editingName !== name) {
    delete businessData[businessForm.dataset.editingName];
  }

  if (businessForm.dataset.editingName) {
    await updateBusinessData(nextEntry);
  } else {
    await saveBusinessData(nextEntry);
  }

  delete businessForm.dataset.editingName;
  businessForm.reset();
  const submitButton = businessForm.querySelector("button[type='submit']");
  submitButton.textContent = "Create listing";
  await initializeBusinesses();
  await loadAnalytics();
  closeBusinessForm();
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const businessName = commentForm.dataset.businessName;
  const author = commentAuthor.value.trim();
  const rating = commentRating.value;
  const body = commentBody.value.trim();

  if (!businessName || !author || !rating || !body) {
    return;
  }

  const response = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName, author, rating: Number(rating), body, status: "approved" })
  });

  if (!response.ok) {
    return;
  }

  commentForm.reset();
  await loadComments(businessName);
  await loadAnalytics();
});

async function bootstrapUserProfile() {
  currentUser.savedBusinesses = [...savedPlaces];

  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentUser)
    });
  } catch (error) {
    console.warn("Profile bootstrap skipped.", error);
  }
}

donationButton.addEventListener("click", openDonationModal);
donationMiniButton?.addEventListener("click", openDonationModal);
closeDonationButton.addEventListener("click", closeDonationModal);
cancelDonationButton.addEventListener("click", closeDonationModal);

donationForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(donationForm);
  const amount = Number(formData.get("donationAmount") || 25);
  const name = String(formData.get("donationName") || "Local supporter").trim() || "Local supporter";
  const message = String(formData.get("donationMessage") || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  donationTotalValue += amount;
  updateDonationDisplay();

  donationSuccess.textContent = `${name} just gave $${amount}${message ? ` — “${message}”` : ""}. Thank you for supporting neighborhood upkeep.`;
  donationSuccess.classList.remove("hidden");
  donationForm.reset();
  donationForm.donationName.value = "Local supporter";
});

async function initializeApp() {
  await initializeBusinesses();
  await loadAnalytics();
  await bootstrapUserProfile();
  updateDonationDisplay();
}

initializeApp();
