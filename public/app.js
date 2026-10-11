const $ = (selector) => document.querySelector(selector);
let plants = [];
let currentFilter = "all";
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
function plantCard(plant, index) {
  const image = plant.image_url || fallbackImages[index % fallbackImages.length];
  const status = plant.availability || "Available";
  const sold = status === "Sold out";
  const message = `Hello Vedant Adenium! I am interested in this plant:\nPlant: ${plant.name}\nVariety: ${plant.variety || "Not specified"}\nPrice: ${money(plant.price)}\nPlease confirm availability and delivery charges.`;
  return `<article class="plant-card">
    <div class="plant-photo"><img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(plant.name)}" onerror="this.src='${fallbackImages[index % fallbackImages.length]}'">
    <span class="plant-badge">${escapeHtml(status.toUpperCase())}</span></div>
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
}
async function loadPlants() {
  try {
    const response = await fetch("/api/plants");
    if (!response.ok) throw new Error("API not ready");
    const result = await response.json();
    plants = result.plants || [];
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
$("#year").textContent = new Date().getFullYear();
loadConfig();
loadPlants();
