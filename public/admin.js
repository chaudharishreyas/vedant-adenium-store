const $ = (selector) => document.querySelector(selector);
let adminPlants = [];
let imageDataUrl = "";
let currentImageUrl = "";
let editingId = null;
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}
function showMessage(message, type = "") {
  $("#form-message").textContent = message;
  $("#form-message").className = `message ${type}`;
}
function showDashboard(isLoggedIn) {
  $("#login-panel").hidden = isLoggedIn;
  $("#dashboard").hidden = !isLoggedIn;
  if (isLoggedIn) loadAdminPlants();
}
async function checkSession() {
  try {
    const result = await api("/api/admin/session");
    showDashboard(result.authenticated);
  } catch {
    showDashboard(false);
  }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#admin-password").value }) });
    $("#admin-password").value = "";
    showDashboard(true);
  } catch (error) {
    $("#login-error").textContent = error.message;
  }
});
$("#logout").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); } finally { showDashboard(false); }
});
async function loadAdminPlants() {
  $("#admin-plants").innerHTML = '<p class="muted">Loading your catalogue…</p>';
  try {
    const result = await api("/api/plants");
    adminPlants = result.plants || [];
    $("#plant-count").textContent = adminPlants.length;
    $("#admin-plants").innerHTML = adminPlants.length ? adminPlants.map((plant) => `
      <article class="admin-plant">
        <img src="${escapeHtml(plant.image_url || "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=200&q=75")}" alt="">
        <div><h3>${escapeHtml(plant.name)}</h3><p>${escapeHtml(plant.variety || "Adenium")} · ${escapeHtml(plant.availability)}</p><strong>${money(plant.price)}</strong></div>
        <div class="plant-actions"><button class="secondary" data-edit="${plant.id}">Edit</button><button class="secondary delete-button" data-delete="${plant.id}">Delete</button></div>
      </article>`).join("") : '<div class="empty-list">No plants yet. Add your first adenium using the form.</div>';
  } catch (error) {
    $("#admin-plants").innerHTML = `<div class="empty-list">${escapeHtml(error.message)}<br>Check Supabase setup and try refreshing.</div>`;
  }
}
function resetForm() {
  $("#plant-form").reset();
  $("#plant-id").value = "";
  $("#form-title").textContent = "Add a plant";
  $("#save-button").innerHTML = 'Save plant <span>→</span>';
  $("#image-file").value = "";
  $("#image-preview-wrap").hidden = true;
  $("#image-preview").src = "";
  imageDataUrl = "";
  currentImageUrl = "";
  editingId = null;
  showMessage("");
}
$("#reset-form").addEventListener("click", resetForm);
$("#refresh").addEventListener("click", loadAdminPlants);
$("#admin-plants").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const plant = adminPlants.find((item) => item.id === editButton.dataset.edit);
    if (!plant) return;
    editingId = plant.id;
    $("#plant-id").value = plant.id;
    $("#name").value = plant.name || "";
    $("#variety").value = plant.variety || "";
    $("#price").value = plant.price;
    $("#description").value = plant.description || "";
    $("#size").value = plant.size || "";
    $("#availability").value = plant.availability || "Available";
    $("#featured").checked = Boolean(plant.featured);
    currentImageUrl = plant.image_url || "";
    imageDataUrl = "";
    $("#image-file").value = "";
    $("#form-title").textContent = "Edit plant";
    $("#save-button").innerHTML = 'Update plant <span>→</span>';
    $("#image-preview-wrap").hidden = !currentImageUrl;
    if (currentImageUrl) $("#image-preview").src = currentImageUrl;
    showMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (deleteButton) {
    const plant = adminPlants.find((item) => item.id === deleteButton.dataset.delete);
    if (!plant || !confirm(`Delete "${plant.name}" from the catalogue?`)) return;
    try {
      await api(`/api/admin/plants/${plant.id}`, { method: "DELETE" });
      await loadAdminPlants();
      showMessage("Plant deleted.", "success");
    } catch (error) {
      alert(error.message);
    }
  }
});
$("#image-file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showMessage("Choose a JPG, PNG or WebP image.", "error"); event.target.value = ""; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showMessage("Image must be under 5 MB.", "error"); event.target.value = ""; return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    imageDataUrl = reader.result;
    $("#image-preview").src = imageDataUrl;
    $("#image-preview-wrap").hidden = false;
  };
  reader.readAsDataURL(file);
});
$("#remove-image").addEventListener("click", () => {
  imageDataUrl = "";
  currentImageUrl = "";
  $("#image-file").value = "";
  $("#image-preview").src = "";
  $("#image-preview-wrap").hidden = true;
});
$("#plant-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#save-button");
  button.disabled = true;
  showMessage("Saving plant…");
  try {
    let image_url = currentImageUrl;
    if (imageDataUrl) {
      const result = await api("/api/admin/upload", {
        method: "POST",
        body: JSON.stringify({
          filename: $("#image-file").files[0]?.name || "plant-image",
          contentType: $("#image-file").files[0]?.type,
          dataBase64: imageDataUrl
        })
      });
      image_url = result.image_url;
    }
    const plant = {
      name: $("#name").value,
      variety: $("#variety").value,
      price: $("#price").value,
      description: $("#description").value,
      size: $("#size").value,
      availability: $("#availability").value,
      image_url,
      featured: $("#featured").checked
    };
    await api(editingId ? `/api/admin/plants/${editingId}` : "/api/admin/plants", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(plant)
    });
    resetForm();
    showMessage("Plant saved successfully.", "success");
    await loadAdminPlants();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
checkSession();
