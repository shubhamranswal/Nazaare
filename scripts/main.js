const GALLERY = document.getElementById("gallery");
const PAGINATION = document.getElementById("pagination");
const SEARCH = document.getElementById("search-input");
const YEAR = document.getElementById("footer-year");

let PHOTOS = [];
let filteredPhotos = [];
let currentPage = 1;

const PHOTOS_PER_PAGE = 6;

// Inline, theme-friendly SVG fallback (uses currentColor so it adapts to dark/light modes)
const IMG_FALLBACK_SVG = `
  <svg viewBox="0 0 64 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <title>Image not available</title>
    <rect x="1" y="1" width="62" height="46" rx="4" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.18" />
    <g transform="translate(6,6)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="52" height="36" rx="3" opacity="0.06" />
      <path d="M4 28 L18 14 L30 26 L44 10 L56 28" opacity="0.9" />
      <circle cx="10" cy="10" r="4" fill="currentColor" opacity="0.12" />
    </g>
  </svg>
`;

// --- Empty state helpers (place after constants) ---
function clearEmptyState() {
  const msg = document.getElementById("no-result-msg");
  if (msg) msg.remove();
}

//error card
function renderEmptyState() {
  clearEmptyState();
  const card = document.createElement("div");
  card.id = "no-result-msg";
  card.className = "empty-card";
  card.innerHTML = `
  <div class="empty-wrap">
  <div id="no-result-msg" class="empty-card" role="region" aria-label="No results">
    <div class="empty-illustration" aria-hidden="true">
      <img src="assets/error.png" alt="" class="empty-img" />
    </div>
    <h3 class="empty-title">No results found</h3>
    <p class="empty-subtitle">Try a different search term or view all photos.</p>
    <div class="empty-actions">
      <button class="empty-home-btn" type="button">See all photos</button>
    </div>
  </div>
</div>
`;
  card.querySelector(".empty-home-btn").addEventListener("click", () => {
    SEARCH.value = "";
    filteredPhotos = [...PHOTOS];
    currentPage = 1;
    renderGallery();
  });
  GALLERY.appendChild(card);
}

// Load photo metadata and enrich with EXIF
fetch("data/photos.json")
  .then((res) => res.json())
  .then((data) => {
    PHOTOS = data;
    return Promise.all(PHOTOS.map(extractExif));
  })
  .then((updatedPhotos) => {
    PHOTOS = updatedPhotos;
    filteredPhotos = [...PHOTOS];
    renderGallery();
    YEAR.textContent = new Date().getFullYear();
  })
  .catch((err) => {
    console.error("Error loading photos:", err);

    // displays the error msg if the img fails to load
    GALLERY.innerHTML = `
    <section class="error-screen">
      <img src="./assets/error.svg" alt="Error Illustration" class="error-vector" />
      <h2>Oops! Something went wrong</h2>
      <p>We couldn’t load the photos right now. Please try again later.</p>
      <button id="retry-btn">Retry</button>
    </section>
  `;

    document
      .getElementById("retry-btn")
      .addEventListener("click", () => location.reload());
  });

SEARCH.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  filteredPhotos = PHOTOS.filter(
    (photo) =>
      photo.title.toLowerCase().includes(term) ||
      photo.description.toLowerCase().includes(term) ||
      (photo.tags && photo.tags.some((tag) => tag.toLowerCase().includes(term)))
  );
  currentPage = 1;
  renderGallery();
});

// Extract EXIF metadata
function extractExif(photo) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `assets/photos/${photo.filename}`;
    img.crossOrigin = "anonymous";

    img.onload = function () {
      try {
        EXIF.getData(img, function () {
          const make = EXIF.getTag(this, "Make") || "";
          const model = EXIF.getTag(this, "Model") || "";
          const date =
            EXIF.getTag(this, "DateTimeOriginal") ||
            EXIF.getTag(this, "DateTime") ||
            "";
          const orientation = EXIF.getTag(this, "Orientation") || 1;

          photo.device =
            (make + " " + model).trim() || photo.device || "Unknown Device";
          photo.dateTaken = date || photo.dateTaken || "Unknown Date";
          photo.orientation =
            orientation === 6 || orientation === 8 ? "portrait" : "landscape";

          resolve(photo);
        });
      } catch {
        resolve(photo); // fallback if EXIF fails
      }
    };

    img.onerror = () => resolve(photo); // fallback on error
  });
}

//rendered gallery
function renderGallery() {
  GALLERY.innerHTML = "";
  clearEmptyState();

  if (filteredPhotos.length === 0) {
    PAGINATION.style.display = "none";
    renderEmptyState();
    return;
  } else {
    PAGINATION.style.display = "";
  }

  const start = (currentPage - 1) * PHOTOS_PER_PAGE;
  const pagePhotos = filteredPhotos.slice(start, start + PHOTOS_PER_PAGE);

  pagePhotos.forEach((photo, i) => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.innerHTML = `
      <img src="assets/photos/${photo.filename}" alt="${
      photo.title
    }" loading="lazy" />
      <div class="info">
        <h2>${photo.title}</h2>
        <p>${photo.description}</p>
        <p class="meta">
          📍 ${photo.location || "Unknown"} • 📅 ${
      formatDateTime(photo.dateTaken) || "Unknown"
    } • 📷 ${photo.device || "Unknown"}
        </p>
        <div class="tags">${
          photo.tags
            ?.map((tag) => `<span class="tag">${tag}</span>`)
            .join("") || `<span class="tag">None</span>`
        }</div>
        <div class="actions"><a href="assets/photos/${
          photo.filename
        }" download class="download-btn">⬇️ Download</a></div>
      </div>
    `;
    // Attach an error handler to the image so broken images are gracefully replaced
    // with an accessible, theme-friendly inline SVG fallback.
    const imgEl = div.querySelector("img");
    if (imgEl) {
      imgEl.addEventListener("error", function handleImgError() {
        // Avoid re-processing the same element
        if (this.dataset.fallbackHandled) return;
        this.dataset.fallbackHandled = "1";

        const fig = document.createElement("figure");
        fig.className = "img-fallback";
        // Use inline SVG so it inherits `currentColor` and adapts to dark/light mode
        fig.innerHTML =
          IMG_FALLBACK_SVG +
          `<figcaption class="img-fallback-caption">${
            photo.title || "Image not available"
          }</figcaption>`;
        this.replaceWith(fig);
      });
    }
    div.addEventListener("click", () => openLightbox(start + i));
    GALLERY.appendChild(div);
  });

  renderPagination();
}

function renderPagination() {
  PAGINATION.innerHTML = "";
  const totalPages = Math.ceil(filteredPhotos.length / PHOTOS_PER_PAGE);

  if (totalPages <= 1) {
    PAGINATION.style.display = totalPages === 0 ? "none" : "flex";
    return;
  }
  PAGINATION.style.display = "flex";

  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = currentPage === 1;
  prev.addEventListener("click", () => {
    currentPage--;
    renderGallery();
  });
  PAGINATION.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    // Accessibility: describe the button and mark the current page
    btn.setAttribute("aria-label", `Go to page ${i}`);
    if (i === currentPage) {
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
    }
    btn.addEventListener("click", () => {
      currentPage = i;
      renderGallery();
    });
    PAGINATION.appendChild(btn);
  }

  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => {
    currentPage++;
    renderGallery();
  });
  PAGINATION.appendChild(next);
}
// Lightbox
const LIGHTBOX = document.getElementById("lightbox");
const LIGHTBOX_IMG = document.getElementById("lightbox-img");
const LIGHTBOX_CAPTION = document.getElementById("lightbox-caption");
const LIGHTBOX_CLOSE = document.getElementById("lightbox-close");
const LIGHTBOX_NEXT = document.getElementById("lightbox-next");
const LIGHTBOX_PREV = document.getElementById("lightbox-prev");

let currentLightboxIndex = 0;

function openLightbox(index) {
  currentLightboxIndex = index;
  const photo = filteredPhotos[index];
  LIGHTBOX_IMG.src = `assets/photos/${photo.filename}`;
  LIGHTBOX_CAPTION.innerHTML = `
    <h2>${photo.title}</h2>
    <p>${photo.description}</p>
    <p>📍 ${photo.location || "Unknown"} • 📅 ${
    formatDateTime(photo.dateTaken) || "Unknown"
  } • 📷 ${photo.device || "Unknown"}</p>
    <p class="tags" style="margin-top: 0; justify-content: center;">Tags: ${
      photo.tags?.join(", ") || "None"
    }</p>
    <a href="assets/photos/${
      photo.filename
    }" download class="download-btn">⬇️ Download Photo</a>
  `;
  LIGHTBOX.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  LIGHTBOX.style.display = "none";
  document.body.style.overflow = "";
}

function showNext() {
  if (currentLightboxIndex < filteredPhotos.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  }
}

function showPrev() {
  if (currentLightboxIndex > 0) {
    openLightbox(currentLightboxIndex - 1);
  }
}

// Events
LIGHTBOX_CLOSE.addEventListener("click", closeLightbox);
LIGHTBOX_NEXT.addEventListener("click", showNext);
LIGHTBOX_PREV.addEventListener("click", showPrev);
LIGHTBOX.addEventListener("click", (e) => {
  if (e.target === LIGHTBOX) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (LIGHTBOX.style.display === "flex") {
    if (e.key === "ArrowRight") showNext();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "Escape") closeLightbox();
  }
});

function formatDateTime(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "Unknown";

  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) return dateStr;

  const [year, month, day] = datePart.split(":");
  const [hour, minute] = timePart.split(":");

  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}`);

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

const THEME_BTN = document.getElementById("theme-toggle-btn");
const BODY = document.body;

// Load saved mode from localStorage
if (localStorage.getItem("theme") === "dark") {
  BODY.classList.add("dark-mode");
} else {
  BODY.classList.remove("dark-mode");
}

THEME_BTN.addEventListener("click", () => {
  BODY.classList.toggle("dark-mode");
  const isDark = BODY.classList.contains("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  THEME_BTN.textContent = isDark ? "🌙" : "☀️";
});

// Set initial icon
THEME_BTN.textContent = document.body.classList.contains("dark-mode")
  ? "🌙"
  : "☀️";
