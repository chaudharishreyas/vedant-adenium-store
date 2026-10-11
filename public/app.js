const $ = (selector) => document.querySelector(selector);
let plants = [];
let currentFilter = "all";
let heroImages = [];
let heroImageIndex = 0;
let heroSlideTimer = null;
const fallbackImages = [
  "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80"
];
function waLink(message) {
  const number = window.siteConfig?.whatsappNumber || "";
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  return number ? url : "#";
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
const themeToggle = $("#theme-toggle");
function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  themeToggle.title = `Switch to ${isDark ? "light" : "dark"} theme`;
  themeToggle.querySelector("span").textContent = isDark ? "☀" : "☾";
}
setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try {
    localStorage.setItem("va-theme", theme);
  } catch (error) {
    console.warn("Could not save the theme preference.", error);
  }
});
function plantCard(plant, index) {
  const image = plant.display_image_url || plant.image_url || fallbackImages[index % fallbackImages.length];
  const status = plant.availability || "Available";
  const sold = status === "Sold out";
  const message = `Hello Vedant Adenium! I would like to enquire about this plant:\nPlant: ${plant.name}\nVariety: ${plant.variety || "Not specified"}\nPrice: ${money(plant.price)}\nAvailability: ${status}\nPlease share more details.`;
  const safeImage = escapeHtml(image);
  return `<article class="plant-card">
    <div class="plant-photo">
      <button class="plant-photo-view" type="button" data-full-image="${safeImage}" data-image-alt="${escapeHtml(plant.name)}" aria-label="View full-size photo of ${escapeHtml(plant.name)}">
        <img loading="lazy" src="${safeImage}" alt="" onerror="this.src='${fallbackImages[index % fallbackImages.length]}'">
      </button>
      <span class="plant-badge">${escapeHtml(status.toUpperCase())}</span>
    </div>
    <div class="plant-info"><div class="plant-top"><h3>${escapeHtml(plant.name)}</h3><span class="plant-price">${money(plant.price)}</span></div>
    ${plant.variety ? `<p class="plant-variety">${escapeHtml(plant.variety)}</p>` : ""}
    <p class="plant-description">${escapeHtml(plant.description || "A special desert rose, selected with care.")}</p>
    ${plant.size ? `<div class="plant-meta">Plant size: ${escapeHtml(plant.size)}</div>` : ""}
    <a class="order-button" ${sold ? 'aria-disabled="true"' : `href="${waLink(message)}" target="_blank" rel="noopener noreferrer"`}>${sold ? "Currently unavailable" : "Order on WhatsApp"} <span>↗</span></a></div>
  </article>`;
}
function renderPlants() {
  const filtered = currentFilter === "all" ? plants : plants.filter(p => p.availability === currentFilter);
  $("#plant-grid").innerHTML = filtered.length
    ? filtered.map(plantCard).join("")
    : `<div class="empty-state">No plants to show here just yet. <br>Check back soon or message us on WhatsApp.</div>`;
}
function renderHeroImage() {
  const image = heroImages[heroImageIndex];
  if (!image) return;
  const photo = $("#hero-photo");
  photo.classList.remove("hero-slide-enter");
  photo.onload = () => {
    photo.classList.remove("hero-slide-enter");
    void photo.offsetWidth;
    photo.classList.add("hero-slide-enter");
  };
  photo.src = image.url;
  photo.alt = image.name;
}
function moveHeroSlide(direction) {
  if (heroImages.length < 2) return;
  heroImageIndex = (heroImageIndex + direction + heroImages.length) % heroImages.length;
  renderHeroImage();
}
function startHeroSlideshow() {
  if (heroSlideTimer || heroImages.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  heroSlideTimer = window.setInterval(() => moveHeroSlide(1), 2000);
}
function stopHeroSlideshow() {
  window.clearInterval(heroSlideTimer);
  heroSlideTimer = null;
}
function loadHeroSlideshow() {
  const seenImages = new Set();
  heroImages = plants.reduce((images, plant) => {
    const url = plant.display_image_url || plant.image_url;
    if (url && !seenImages.has(url)) {
      seenImages.add(url);
      images.push({ url, name: plant.name ? `${plant.name} plant` : "Adenium plant" });
    }
    return images;
  }, []);
  renderHeroImage();
  startHeroSlideshow();
}
async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    window.siteConfig = { whatsappNumber: "" };
    // The WhatsApp number is intentionally configured in this public config endpoint.
    // It is safe to expose a business contact number, never secret credentials.
    const contactResponse = await fetch("/api/public-contact");
    if (contactResponse.ok) {
      const contact = await contactResponse.json();
      window.siteConfig.whatsappNumber = contact.whatsappNumber || "";
    }
  } catch (error) {
    window.siteConfig = { whatsappNumber: "" };
  }
  const general = waLink("Hello Vedant Adenium! Please help me choose an adenium plant.");
  $("#general-whatsapp").href = general;
  $("#closing-whatsapp").href = general;
  if (plants.length) renderPlants();
}
async function loadPlants() {
  try {
    const response = await fetch("/api/plants");
    if (!response.ok) throw new Error("API not ready");
    const result = await response.json();
    plants = result.plants || [];
    loadHeroSlideshow();
    if (!plants.length) {
      $("#plant-grid").innerHTML = `<div class="empty-state">Our first plants are being added. Please check back soon, or message us on WhatsApp.</div>`;
      return;
    }
    renderPlants();
  } catch (error) {
    $("#plant-grid").innerHTML = `<div class="empty-state">The plant collection is temporarily unavailable. Please try again shortly.</div>`;
  }
}
$("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
  renderPlants();
});
$(".hero-art").addEventListener("mouseenter", stopHeroSlideshow);
$(".hero-art").addEventListener("mouseleave", startHeroSlideshow);
$(".hero-art").addEventListener("focusin", stopHeroSlideshow);
$(".hero-art").addEventListener("focusout", (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) startHeroSlideshow();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopHeroSlideshow();
  else startHeroSlideshow();
});
const photoLightbox = $("#photo-lightbox");
const photoLightboxImage = $("#photo-lightbox-image");
$("#plant-grid").addEventListener("click", (event) => {
  const photoButton = event.target.closest(".plant-photo-view");
  if (!photoButton) return;
  photoLightboxImage.src = photoButton.dataset.fullImage;
  photoLightboxImage.alt = photoButton.dataset.imageAlt;
  photoLightbox.showModal();
});
$(".photo-lightbox-close").addEventListener("click", () => photoLightbox.close());
photoLightbox.addEventListener("click", (event) => {
  if (event.target === photoLightbox) photoLightbox.close();
});
$("#year").textContent = new Date().getFullYear();
loadConfig();
loadPlants();
