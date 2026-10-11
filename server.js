require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET", "ADMIN_PASSWORD", "WHATSAPP_NUMBER"];
const missing = required.filter((key) => !process.env[key] || process.env[key].includes("REPLACE_WITH"));
if (missing.length) {
  console.warn("Missing configuration values:", missing.join(", "), "- copy .env.example to .env and configure them.");
}

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "va_admin",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false });

function requireDb(req, res, next) {
  if (!supabase) return res.status(503).json({ error: "Database is not configured yet. Set Supabase environment variables." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session || req.session.isAdmin !== true) return res.status(401).json({ error: "Please log in as admin." });
  next();
}
function cleanString(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validPlant(body) {
  const name = cleanString(body.name, 120);
  const variety = cleanString(body.variety, 120);
  const description = cleanString(body.description, 2000);
  const size = cleanString(body.size, 120);
  const availability = ["Available", "Limited", "Sold out"].includes(body.availability) ? body.availability : "Available";
  const price = Number(body.price);
  if (!name) return { error: "Plant name is required." };
  if (!Number.isFinite(price) || price < 0 || price > 10000000) return { error: "Enter a valid price." };
  const image_url = cleanString(body.image_url, 2000);
  if (image_url && !/^https:\/\/.+/i.test(image_url)) return { error: "Image URL must start with https://." };
  return {
    value: {
      name, variety, description, size, availability, price,
      image_url,
      featured: body.featured === true || body.featured === "true",
      updated_at: new Date().toISOString()
    }
  };
}

function photoDisplayUrl(imageUrl) {
  if (!supabase || !imageUrl) return imageUrl;
  try {
    const image = new URL(imageUrl);
    const project = new URL(process.env.SUPABASE_URL);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "plant-photos";
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (image.origin !== project.origin || !image.pathname.startsWith(prefix)) return imageUrl;
    const filename = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!/^\d+-[a-z0-9]+\.(?:jpg|png|webp)$/i.test(filename)) return imageUrl;
    return `/api/photos/${encodeURIComponent(filename)}`;
  } catch {
    return imageUrl;
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, app: "Vedant Adenium" }));

app.get("/api/public-contact", (req, res) => {
  const number = process.env.WHATSAPP_NUMBER || "";
  res.json({ whatsappNumber: number.includes("REPLACE_WITH") ? "" : number.replace(/[^0-9]/g, "") });
});

app.get("/api/config", (req, res) => {
  res.json({
    siteName: process.env.SITE_NAME || "Vedant Adenium",
    whatsappConfigured: Boolean(process.env.WHATSAPP_NUMBER && !process.env.WHATSAPP_NUMBER.includes("REPLACE_WITH"))
  });
});

app.get("/api/plants", requireDb, async (req, res) => {
  const { data, error } = await supabase.from("plants")
    .select("id,name,variety,price,description,size,availability,image_url,featured,created_at")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Could not load plants." });
  res.json({
    plants: (data || []).map((plant) => ({
      ...plant,
      display_image_url: photoDisplayUrl(plant.image_url)
    }))
  });
});

app.get("/api/photos/:filename", requireDb, async (req, res) => {
  const { filename } = req.params;
  if (!/^\d+-[a-z0-9]+\.(?:jpg|png|webp)$/i.test(filename)) {
    return res.status(400).send("Invalid photo filename.");
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "plant-photos";
  const { data, error } = await supabase.storage.from(bucket).download(filename);
  if (error || !data) {
    console.error("Could not load plant photo from Supabase Storage:", error?.message || "No photo data returned.");
    return res.status(502).send("Could not load plant photo from storage.");
  }

  const contentTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const extension = filename.split(".").pop().toLowerCase();
  res.set({
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": contentTypes[extension]
  });
  res.send(Buffer.from(await data.arrayBuffer()));
});

app.post("/api/admin/login", loginLimiter, (req, res) => {
  const password = cleanString(req.body.password, 500);
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.includes("REPLACE_WITH")) {
    return res.status(503).json({ error: "Set a unique ADMIN_PASSWORD in the environment before using admin login." });
  }
  if (password.length < 1 || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start admin session." });
    req.session.isAdmin = true;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Could not save admin session." });
      res.json({ ok: true });
    });
  });
});
app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("va_admin");
    res.json({ ok: true });
  });
});
app.get("/api/admin/session", (req, res) => res.json({ authenticated: req.session?.isAdmin === true }));

app.post("/api/admin/plants", writeLimiter, requireAdmin, requireDb, async (req, res) => {
  const checked = validPlant(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { data, error } = await supabase.from("plants").insert(checked.value).select().single();
  if (error) return res.status(500).json({ error: "Could not save plant. Check database setup." });
  res.status(201).json({ plant: data });
});

app.put("/api/admin/plants/:id", writeLimiter, requireAdmin, requireDb, async (req, res) => {
  const checked = validPlant(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { data, error } = await supabase.from("plants").update(checked.value).eq("id", req.params.id).select().single();
  if (error || !data) return res.status(404).json({ error: "Plant not found or could not be updated." });
  res.json({ plant: data });
});

app.delete("/api/admin/plants/:id", writeLimiter, requireAdmin, requireDb, async (req, res) => {
  const { error } = await supabase.from("plants").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: "Could not delete plant." });
  res.json({ ok: true });
});

// Uploads an image to the Supabase Storage bucket. Create the bucket first.
// Files are uploaded through this endpoint only after admin session verification.
app.post("/api/admin/upload", writeLimiter, requireAdmin, requireDb, async (req, res) => {
  const { filename, contentType, dataBase64 } = req.body || {};
  if (!filename || !dataBase64 || typeof dataBase64 !== "string") return res.status(400).json({ error: "Image data is missing." });
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) return res.status(400).json({ error: "Use JPG, PNG or WebP images." });
  const base64 = dataBase64.replace(/^data:image\/(jpeg|png|webp);base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Image must be under 5 MB." });
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[contentType];
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "plant-photos";
  const { data, error } = await supabase.storage.from(bucket).upload(safeName, buffer, {
    contentType, upsert: false, cacheControl: "31536000"
  });
  if (error) return res.status(500).json({ error: "Upload failed. Check that the storage bucket exists and is public." });
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  res.json({ image_url: publicData.publicUrl });
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*path", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => err && next(err));
});

app.listen(PORT, () => console.log(`Vedant Adenium running on port ${PORT}`));
