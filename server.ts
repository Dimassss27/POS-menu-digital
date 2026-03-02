import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "restaurant.db");
const db = new Database(DB_PATH);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_new INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'staff'
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    processed_by TEXT,
    total_amount INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    menu_item_id INTEGER,
    quantity INTEGER,
    price INTEGER,
    status TEXT DEFAULT 'pending', -- pending, served
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Initialize default categories if empty
const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  const defaultCategories = ['Makanan', 'Minuman', 'Cemilan', 'Lainnya'];
  const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
  defaultCategories.forEach(cat => insertCategory.run(cat));
}

// Migration: Add payment_method if it doesn't exist (for existing databases)
try {
  db.prepare("SELECT payment_method FROM orders LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT");
}

// Migration: Add status to order_items if it doesn't exist
try {
  db.prepare("SELECT status FROM order_items LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending'");
}

// Migration: Add processed_by to orders if it doesn't exist
try {
  db.prepare("SELECT processed_by FROM orders LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE orders ADD COLUMN processed_by TEXT");
}

// Migration: Add is_new to menu_items if it doesn't exist
try {
  db.prepare("SELECT is_new FROM menu_items LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE menu_items ADD COLUMN is_new INTEGER DEFAULT 1");
  db.exec("ALTER TABLE menu_items ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
}

// Migration: Add is_available to menu_items
try {
  db.prepare("SELECT is_available FROM menu_items LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE menu_items ADD COLUMN is_available INTEGER DEFAULT 1");
}

// Migration: Add discount_price to menu_items
try {
  db.prepare("SELECT discount_price FROM menu_items LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE menu_items ADD COLUMN discount_price INTEGER");
}

// Migration: Add customer_name and order_note to orders
try {
  db.prepare("SELECT customer_name FROM orders LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE orders ADD COLUMN customer_name TEXT");
  db.exec("ALTER TABLE orders ADD COLUMN order_note TEXT");
}

// Migration: Add role to users if it doesn't exist
try {
  db.prepare("SELECT role FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'staff'");
  db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin'").run();
}

// Seed admin user
db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");

// Initialize system settings
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)").run("shop_status", "online");

// Seed initial menu if empty
const menuItemCount = db.prepare("SELECT COUNT(*) as count FROM menu_items").get() as { count: number };
if (menuItemCount.count === 0) {
  const insert = db.prepare("INSERT OR IGNORE INTO menu_items (name, price, category, description, image_url, is_new) VALUES (?, ?, ?, ?, ?, ?)");
  
  // Makanan
  insert.run("Nasi Goreng Spesial", 35000, "Makanan", "Nasi goreng dengan telur, ayam, dan kerupuk", "https://loremflickr.com/400/300/friedrice,nasigoreng", 0);
  insert.run("Mie Ayam Jamur", 28000, "Makanan", "Mie ayam dengan topping jamur merang", "https://loremflickr.com/400/300/chickennoodle,mieayam", 0);
  insert.run("Sate Ayam (10 Tusuk)", 45000, "Makanan", "Sate ayam bumbu kacang", "https://loremflickr.com/400/300/satay,sate", 0);
  insert.run("Ayam Bakar Taliwang", 42000, "Makanan", "Ayam bakar khas Lombok dengan bumbu pedas", "https://loremflickr.com/400/300/grilledchicken,ayambakar", 0);
  insert.run("Gado-Gado Betawi", 25000, "Makanan", "Sayuran segar dengan bumbu kacang kental", "https://loremflickr.com/400/300/salad,gadogado", 0);

  // Minuman
  insert.run("Es Teh Manis", 8000, "Minuman", "Teh segar dengan gula asli", "https://loremflickr.com/400/300/icedtea", 0);
  insert.run("Es Jeruk", 12000, "Minuman", "Perasan jeruk murni", "https://loremflickr.com/400/300/orangejuice", 0);
  insert.run("Kopi Susu", 18000, "Minuman", "Kopi robusta dengan susu kental manis", "https://loremflickr.com/400/300/coffee,latte", 0);
  insert.run("Jus Alpukat", 22000, "Minuman", "Alpukat mentega dengan kental manis cokelat", "https://loremflickr.com/400/300/avocado,juice", 0);
  insert.run("Thai Tea Ice", 15000, "Minuman", "Teh Thailand autentik dengan susu", "https://loremflickr.com/400/300/thaitea", 0);

  // Snack & Dessert
  insert.run("Kentang Goreng", 20000, "Snack", "Kentang goreng renyah dengan saus sambal", "https://loremflickr.com/400/300/frenchfries", 0);
  insert.run("Pisang Goreng Keju", 18000, "Snack", "Pisang goreng kipas dengan taburan keju dan meses", "https://loremflickr.com/400/300/friedbanana", 0);
  insert.run("Dimsum Ayam (4 pcs)", 24000, "Snack", "Dimsum ayam homemade yang lembut", "https://loremflickr.com/400/300/dimsum", 0);
  insert.run("Es Krim Vanilla", 15000, "Dessert", "Dua scoop es krim vanilla lembut", "https://loremflickr.com/400/300/vanilla,icecream", 0);
}

// Sync categories from menu_items to categories table
try {
  const existingMenuCategories = db.prepare("SELECT DISTINCT category FROM menu_items").all() as { category: string }[];
  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  existingMenuCategories.forEach(row => {
    if (row.category) insertCategory.run(row.category);
  });
  // Ensure 'Lainnya' is always there
  insertCategory.run('Lainnya');
} catch (e) {
  console.error("Error syncing categories:", e);
}

async function startServer() {
  console.log("[SERVER] startServer() called");
  const app = express();
  const httpServer = createServer(app);
  try {
    const wss = new WebSocketServer({ server: httpServer });
    const PORT = 3000;

    app.use((req, res, next) => {
      console.log(`[INCOMING] ${req.method} ${req.url}`);
      next();
    });

    // Debug route at the very top
    app.get("/ping", (req, res) => {
      console.log("[SERVER] /ping hit");
      res.json({ status: "pong", env: process.env.NODE_ENV });
    });

    app.use(express.json());

  // Ensure uploads directory exists
  const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
  if (!fs.existsSync(UPLOADS_PATH)) {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  }

  // Serve uploads statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_PATH);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only images are allowed'));
      }
    }
  });

  // Upload endpoint
  app.post("/api/admin/upload", (req, res) => {
    const { requester } = req.query;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      return res.status(403).json({ success: false, message: "Hanya akun admin yang dapat mengunggah gambar" });
    }

    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: "Tidak ada file yang diunggah" });
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, imageUrl });
    });
  });

  // WebSocket broadcast to all connected clients (cashiers)
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.put("/api/cashier/order-items/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE order_items SET status = ? WHERE id = ?").run(status, id);
      
      // Check if all items in the order are served
      const item = db.prepare("SELECT order_id FROM order_items WHERE id = ?").get(id) as { order_id: number };
      const unservedItems = db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND status != 'served'").get(item.order_id) as { count: number };
      
      if (unservedItems.count === 0) {
        db.prepare("UPDATE orders SET status = 'served' WHERE id = ?").run(item.order_id);
      } else {
        db.prepare("UPDATE orders SET status = 'pending' WHERE id = ?").run(item.order_id);
      }

      broadcast({ type: "ORDER_UPDATED" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Gagal memperbarui status item" });
    }
  });

  app.delete("/api/cashier/order-items/:id", (req, res) => {
    const { id } = req.params;
    try {
      const item = db.prepare("SELECT order_id, quantity, price FROM order_items WHERE id = ?").get(id) as { order_id: number, quantity: number, price: number };
      if (!item) return res.status(404).json({ success: false, message: "Item tidak ditemukan" });

      db.prepare("DELETE FROM order_items WHERE id = ?").run(id);
      
      // Update order total amount
      db.prepare("UPDATE orders SET total_amount = total_amount - ? WHERE id = ?").run(item.quantity * item.price, item.order_id);
      
      // If no items left, delete the order
      const remainingItems = db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ?").get(item.order_id) as { count: number };
      if (remainingItems.count === 0) {
        db.prepare("DELETE FROM orders WHERE id = ?").run(item.order_id);
      }

      broadcast({ type: "ORDER_UPDATED" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Gagal menghapus item" });
    }
  });

  app.get("/api/menu", (req, res) => {
    const items = db.prepare("SELECT * FROM menu_items ORDER BY category, name").all();
    res.json(items);
  });

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for: ${username}`);
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
      if (user) {
        console.log(`Login success: ${username}`);
        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
      } else {
        console.log(`Login failed: ${username} (Invalid credentials)`);
        res.status(401).json({ success: false, message: "Username atau password salah" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
    }
  });

  app.post("/api/admin/menu", (req, res) => {
    const { requester } = req.query;
    console.log(`[CREATE MENU] Requester: ${requester}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[CREATE MENU] Denied: User '${requester}' not found`);
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengelola menu" });
    }
    const { name, price, category, description, image_url, is_available, discount_price } = req.body;
    try {
      const result = db.prepare("INSERT INTO menu_items (name, price, category, description, image_url, is_new, is_available, discount_price) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
        .run(name, price, category, description, image_url, is_available ?? 1, discount_price || null);
      console.log(`[CREATE MENU] Success: ID ${result.lastInsertRowid}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
      console.error("[CREATE MENU] Error:", e);
      res.status(400).json({ success: false, message: "Gagal menambah menu. Mungkin nama menu sudah ada." });
    }
  });

  app.put("/api/admin/menu/:id", (req, res) => {
    const { requester } = req.query;
    console.log(`[UPDATE MENU] ID: ${req.params.id}, Requester: ${requester}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[UPDATE MENU] Denied: User '${requester}' not found`);
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengelola menu" });
    }
    const { id } = req.params;
    const { name, price, category, description, image_url, is_available, discount_price } = req.body;
    try {
      const result = db.prepare("UPDATE menu_items SET name = ?, price = ?, category = ?, description = ?, image_url = ?, is_available = ?, discount_price = ? WHERE id = ?")
        .run(name, price, category, description, image_url, is_available ?? 1, discount_price || null, id);
      console.log(`[UPDATE MENU] Success: Rows affected ${result.changes}`);
      res.json({ success: true });
    } catch (e) {
      console.error("[UPDATE MENU] Error:", e);
      res.status(400).json({ success: false, message: "Gagal memperbarui menu." });
    }
  });

  app.delete("/api/admin/menu/:id", (req, res) => {
    const { requester } = req.query;
    console.log(`[DELETE MENU] ID: ${req.params.id}, Requester: ${requester}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[DELETE MENU] Denied: User '${requester}' not found`);
      return res.status(403).json({ success: false, message: "Hanya akun admin yang dapat mengelola menu" });
    }
    const { id } = req.params;
    try {
      const result = db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
      console.log(`[DELETE MENU] Rows deleted: ${result.changes}`);
      broadcast({ type: "MENU_UPDATED" });
      res.json({ success: true });
    } catch (e) {
      console.error("[DELETE MENU] Error:", e);
      res.status(500).json({ success: false, message: "Gagal menghapus menu." });
    }
  });

  app.get("/api/shop-status", (req, res) => {
    const status = db.prepare("SELECT value FROM system_settings WHERE key = 'shop_status'").get() as { value: string };
    res.json({ status: status.value });
  });

  app.get("/api/app-url", (req, res) => {
    // In this environment, we can use the origin from the request or a known env var
    // But since we want the public one, we'll try to get it from headers or default to a placeholder
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    res.json({ url: `${protocol}://${host}` });
  });

  app.post("/api/admin/shop-status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE system_settings SET value = ? WHERE key = 'shop_status'").run(status);
    broadcast({ type: "SHOP_STATUS_UPDATED", status });
    res.json({ success: true });
  });

  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role FROM users").all();
    res.json(users);
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
    res.json(categories);
  });

  app.post("/api/admin/categories", (req, res) => {
    const { requester } = req.query;
    console.log(`[CREATE CATEGORY] Requester: ${requester}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[CREATE CATEGORY] Denied: User '${requester}' not found`);
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengelola kategori" });
    }
    const { name } = req.body;
    try {
      db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      console.log(`[CREATE CATEGORY] Success: ${name}`);
      broadcast({ type: "CATEGORIES_UPDATED" });
      res.json({ success: true });
    } catch (e) {
      console.error("[CREATE CATEGORY] Error:", e);
      res.status(400).json({ success: false, message: "Kategori sudah ada atau tidak valid" });
    }
  });

  app.put("/api/admin/categories/:id", (req, res) => {
    const { requester } = req.query;
    console.log(`[UPDATE CATEGORY] ID: ${req.params.id}, Requester: ${requester}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[UPDATE CATEGORY] Denied: User '${requester}' not found`);
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengelola kategori" });
    }
    const { id } = req.params;
    const { name } = req.body;
    try {
      const oldCategory = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as { name: string } | undefined;
      if (oldCategory) {
        db.transaction(() => {
          db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
          db.prepare("UPDATE menu_items SET category = ? WHERE category = ?").run(name, oldCategory.name);
        })();
        console.log(`[UPDATE CATEGORY] Success: ${oldCategory.name} -> ${name}`);
        broadcast({ type: "CATEGORIES_UPDATED" });
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
      }
    } catch (e) {
      console.error("[UPDATE CATEGORY] Error:", e);
      res.status(400).json({ success: false, message: "Gagal memperbarui kategori" });
    }
  });

  app.delete("/api/admin/categories/:id", (req, res) => {
    const { requester } = req.query;
    console.log(`[DELETE CATEGORY] ID: ${req.params.id}, Requester: ${requester}`);
    
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(requester);
    if (!user) {
      console.log(`[DELETE CATEGORY] Denied: User '${requester}' not found in database`);
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengelola kategori" });
    }
    console.log(`[DELETE CATEGORY] Authorized: User '${user.username}' found`);
    
    const { id } = req.params;
    try {
      const categoryId = parseInt(id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ success: false, message: "ID kategori tidak valid" });
      }

      const category = db.prepare("SELECT name FROM categories WHERE id = ?").get(categoryId) as { name: string } | undefined;
      
      if (!category) {
        console.log(`[DELETE CATEGORY] Not Found: ID ${categoryId}`);
        return res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
      }

      console.log(`[DELETE CATEGORY] Found: ${category.name} (ID: ${categoryId})`);

      if (category.name === 'Lainnya') {
        return res.status(400).json({ success: false, message: "Kategori 'Lainnya' tidak dapat dihapus." });
      }
      
      db.transaction(() => {
        // Ensure 'Lainnya' exists
        db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run('Lainnya');
        // Move items to 'Lainnya'
        db.prepare("UPDATE menu_items SET category = 'Lainnya' WHERE category = ?").run(category.name);
        // Delete the category
        const result = db.prepare("DELETE FROM categories WHERE id = ?").run(categoryId);
        console.log(`[DELETE CATEGORY] Rows deleted: ${result.changes}`);
      })();
      
      broadcast({ type: "CATEGORIES_UPDATED" });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[DELETE CATEGORY] Error:", e);
      res.status(500).json({ success: false, message: "Gagal menghapus kategori: " + e.message });
    }
  });

  app.post("/api/admin/users", (req, res) => {
    const { username, password, role } = req.body;
    const requester = req.query.requester as string;

    console.log(`[CREATE USER] Attempt by requester: ${requester} to create: ${username} with role: ${role}`);

    const requesterUser = db.prepare("SELECT role FROM users WHERE username = ?").get(requester) as { role: string } | undefined;

    if (!requesterUser || requesterUser.role !== 'admin') {
      console.log(`[CREATE USER] Denied: Requester '${requester}' is not an admin`);
      return res.status(403).json({ success: false, message: "Hanya akun dengan level 'admin' yang dapat menambah user baru" });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username dan password wajib diisi" });
    }
    try {
      db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role || 'staff');
      console.log(`[CREATE USER] Success: ${username}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[CREATE USER] Error:", e);
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ success: false, message: "Username sudah digunakan" });
      } else {
        res.status(500).json({ success: false, message: "Gagal membuat user" });
      }
    }
  });

  app.put("/api/admin/users/:id/role", (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const requester = req.query.requester as string;

    console.log(`[UPDATE USER ROLE] ID: ${id}, New Role: ${role}, Requester: ${requester}`);

    const requesterUser = db.prepare("SELECT role FROM users WHERE username = ?").get(requester) as { role: string } | undefined;

    if (!requesterUser || requesterUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Hanya admin yang dapat mengubah level user" });
    }

    try {
      const userToUpdate = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as { username: string } | undefined;
      if (userToUpdate?.username === 'admin' && role !== 'admin') {
        return res.status(400).json({ success: false, message: "Akun 'admin' utama tidak dapat diubah levelnya" });
      }

      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, message: "Gagal mengubah level user" });
    }
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    const { id } = req.params;
    const requester = req.query.requester as string;

    console.log(`[DELETE USER] ID: ${id}, Requester: ${requester}`);

    const requesterUser = db.prepare("SELECT role FROM users WHERE username = ?").get(requester) as { role: string } | undefined;

    if (!requesterUser || requesterUser.role !== 'admin') {
      console.log(`[DELETE USER] Denied: Requester '${requester}' is not an admin`);
      return res.status(403).json({ success: false, message: "Hanya akun dengan level 'admin' yang dapat menghapus user" });
    }

    try {
      const userToDelete = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as { username: string } | undefined;
      
      if (!userToDelete) {
        console.log(`[DELETE USER] Not Found: ID ${id}`);
        return res.status(404).json({ success: false, message: "User tidak ditemukan" });
      }

      if (userToDelete.username === 'admin') {
        return res.status(400).json({ success: false, message: "Akun 'admin' utama tidak dapat dihapus" });
      }

      console.log(`[DELETE USER] Target username: ${userToDelete.username}`);

      if (userToDelete.username.toLowerCase() === 'admin') {
        console.log(`[DELETE USER] Denied: Cannot delete main 'admin' account`);
        return res.status(400).json({ success: false, message: "Akun 'admin' utama tidak dapat dihapus demi keamanan sistem" });
      }

      const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      if (result.changes > 0) {
        console.log(`[DELETE USER] Success: Deleted ${userToDelete.username}`);
        res.json({ success: true });
      } else {
        console.log(`[DELETE USER] Failed: No changes for ID ${id}`);
        res.status(404).json({ success: false, message: "Gagal menghapus: User tidak ditemukan" });
      }
    } catch (error) {
      console.error("[DELETE USER] Error:", error);
      res.status(500).json({ success: false, message: "Terjadi kesalahan saat menghapus user" });
    }
  });

  app.put("/api/cashier/order-items/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE order_items SET status = ? WHERE id = ?").run(status, id);
      
      // Check if all items in the order are served
      const item = db.prepare("SELECT order_id FROM order_items WHERE id = ?").get(id) as { order_id: number };
      const unservedItems = db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND status != 'served'").get(item.order_id) as { count: number };
      
      if (unservedItems.count === 0) {
        db.prepare("UPDATE orders SET status = 'served' WHERE id = ?").run(item.order_id);
      } else {
        db.prepare("UPDATE orders SET status = 'pending' WHERE id = ?").run(item.order_id);
      }

      broadcast({ type: "ORDER_UPDATED" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Gagal memperbarui status item" });
    }
  });

  // Delete duplicate route

  app.patch("/api/cashier/order-items/:id/quantity", (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'increase' or 'decrease'
    
    try {
      const item = db.prepare("SELECT order_id, quantity, price FROM order_items WHERE id = ?").get(id) as { order_id: number, quantity: number, price: number };
      if (!item) return res.status(404).json({ success: false, message: "Item tidak ditemukan" });

      let newQuantity = item.quantity;
      if (action === 'increase') {
        newQuantity += 1;
      } else if (action === 'decrease') {
        if (item.quantity <= 1) {
          return res.status(400).json({ success: false, message: "Jumlah minimal adalah 1. Gunakan hapus jika ingin membuang item." });
        }
        newQuantity -= 1;
      } else {
        return res.status(400).json({ success: false, message: "Aksi tidak valid" });
      }

      const diff = (newQuantity - item.quantity) * item.price;

      db.transaction(() => {
        db.prepare("UPDATE order_items SET quantity = ? WHERE id = ?").run(newQuantity, id);
        db.prepare("UPDATE orders SET total_amount = total_amount + ? WHERE id = ?").run(diff, item.order_id);
      })();

      broadcast({ type: "ORDER_UPDATED", orderId: item.order_id });
      res.json({ success: true, newQuantity });
    } catch (error) {
      console.error("Error updating quantity:", error);
      res.status(500).json({ success: false, message: "Gagal memperbarui jumlah item" });
    }
  });

  app.post("/api/orders", (req, res) => {
    const { customerName, orderNote, items } = req.body;
    
    const transaction = db.transaction(() => {
      let additionalTotal = 0;
      items.forEach((item: any) => {
        additionalTotal += item.price * item.quantity;
      });

      // For pantry/office use, we usually create a new order every time
      // unless we want to group by customerName. 
      // User said "pesanan atas nama", so let's check if there's an open order for this name.
      const existingOrder = db.prepare("SELECT id, total_amount FROM orders WHERE customer_name = ? AND status != 'paid' LIMIT 1").get(customerName) as { id: number, total_amount: number } | undefined;

      let orderId: number | bigint;

      if (existingOrder) {
        orderId = existingOrder.id;
        db.prepare("UPDATE orders SET total_amount = total_amount + ?, status = 'pending', order_note = ?, created_at = datetime('now', 'localtime') WHERE id = ?").run(additionalTotal, orderNote || null, orderId);
      } else {
        const orderResult = db.prepare("INSERT INTO orders (customer_name, order_note, total_amount, table_number, created_at) VALUES (?, ?, ?, 'Pantry', datetime('now', 'localtime'))").run(customerName, orderNote || null, additionalTotal);
        orderId = orderResult.lastInsertRowid;
      }

      const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)");
      items.forEach((item: any) => {
        insertItem.run(orderId, item.id, item.quantity, item.price);
      });

      return orderId;
    });

    try {
      const orderId = transaction();
      const updatedOrder = db.prepare(`
        SELECT o.*, 
               (SELECT JSON_GROUP_ARRAY(
                 JSON_OBJECT('name', mi.name, 'quantity', total_qty, 'price', mi.price, 'status', oi.status)
               ) FROM (
                 SELECT menu_item_id, status, SUM(quantity) as total_qty 
                 FROM order_items 
                 WHERE order_id = o.id 
                 GROUP BY menu_item_id, status
               ) oi JOIN menu_items mi ON oi.menu_item_id = mi.id) as items
        FROM orders o
        WHERE o.id = ?
      `).get(orderId) as any;

      if (updatedOrder) {
        updatedOrder.items = JSON.parse(updatedOrder.items);
      }

      broadcast({ type: "NEW_ORDER", order: updatedOrder });
      res.json({ success: true, orderId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to place order" });
    }
  });

  app.get("/api/cashier/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, 
             (SELECT JSON_GROUP_ARRAY(
               JSON_OBJECT('id', oi.id, 'name', mi.name, 'quantity', oi.quantity, 'price', oi.price, 'status', oi.status)
             ) FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = o.id) as items
      FROM orders o
      WHERE o.status NOT IN ('paid', 'unpaid')
      ORDER BY o.created_at DESC
    `).all();
    
    // Parse JSON strings from SQLite
    const parsedOrders = orders.map((o: any) => ({
      ...o,
      items: JSON.parse(o.items)
    }));
    
    res.json(parsedOrders);
  });

  app.get("/api/cashier/orders/unpaid", (req, res) => {
    const { startDate, endDate, month, year } = req.query;
    let query = `
      SELECT o.*, 
             (SELECT JSON_GROUP_ARRAY(
               JSON_OBJECT('id', oi.id, 'name', mi.name, 'quantity', oi.quantity, 'price', oi.price, 'status', oi.status)
             ) FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = o.id) as items
      FROM orders o
      WHERE o.status = 'unpaid'
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += " AND date(o.created_at, '+7 hours') BETWEEN date(?) AND date(?)";
      params.push(startDate, endDate);
    } else if (startDate) {
      query += " AND date(o.created_at, '+7 hours') >= date(?)";
      params.push(startDate);
    } else if (endDate) {
      query += " AND date(o.created_at, '+7 hours') <= date(?)";
      params.push(endDate);
    } else {
      if (month && month !== 'all') {
        query += " AND strftime('%m', o.created_at, '+7 hours') = ?";
        params.push(month.toString().padStart(2, '0'));
      }
      if (year && year !== 'all') {
        query += " AND strftime('%Y', o.created_at, '+7 hours') = ?";
        params.push(year.toString());
      }
    }

    query += " ORDER BY o.created_at DESC";

    const orders = db.prepare(query).all(...params);
    
    // Parse JSON strings from SQLite
    const parsedOrders = orders.map((o: any) => ({
      ...o,
      items: JSON.parse(o.items)
    }));
    
    res.json(parsedOrders);
  });

  app.get("/api/cashier/orders/history", (req, res) => {
    const { startDate, endDate, month, year, status } = req.query;
    let query = `
      SELECT o.*, 
             (SELECT JSON_GROUP_ARRAY(
               JSON_OBJECT('id', oi.id, 'name', mi.name, 'quantity', oi.quantity, 'price', oi.price, 'status', oi.status)
             ) FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = o.id) as items
      FROM orders o
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += " AND o.status = ?";
      params.push(status);
    } else {
      query += " AND o.status IN ('paid', 'unpaid')";
    }

    if (startDate && endDate) {
      query += " AND date(o.created_at, '+7 hours') BETWEEN date(?) AND date(?)";
      params.push(startDate, endDate);
    } else if (startDate) {
      query += " AND date(o.created_at, '+7 hours') >= date(?)";
      params.push(startDate);
    } else if (endDate) {
      query += " AND date(o.created_at, '+7 hours') <= date(?)";
      params.push(endDate);
    } else {
      if (month && month !== 'all') {
        query += " AND strftime('%m', o.created_at, '+7 hours') = ?";
        params.push(month.toString().padStart(2, '0'));
      }
      if (year && year !== 'all') {
        query += " AND strftime('%Y', o.created_at, '+7 hours') = ?";
        params.push(year.toString());
      }
    }

    query += " ORDER BY o.created_at DESC";

    const orders = db.prepare(query).all(...params);
    
    const parsedOrders = orders.map((o: any) => ({
      ...o,
      items: JSON.parse(o.items)
    }));
    
    res.json(parsedOrders);
  });

  app.patch("/api/cashier/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, paymentMethod, processedBy } = req.body;
    
    db.transaction(() => {
      if (paymentMethod) {
        db.prepare("UPDATE orders SET status = ?, payment_method = ?, processed_by = ? WHERE id = ?").run(status, paymentMethod, processedBy, id);
      } else {
        db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
      }

      // If marked as served, update all pending items to served
      if (status === 'served') {
        db.prepare("UPDATE order_items SET status = 'served' WHERE order_id = ? AND status = 'pending'").run(id);
      }
    })();
    
    broadcast({ type: "ORDER_UPDATED", orderId: id, status, paymentMethod });
    res.json({ success: true });
  });

  app.get("/api/cashier/report", (req, res) => {
    const { startDate, endDate, month, year, status } = req.query;
    
    let whereClause = "WHERE o.status IN ('paid', 'unpaid')";
    const params: any[] = [];

    if (status) {
      whereClause = "WHERE o.status = ?";
      params.push(status);
    }

    if (startDate && endDate) {
      whereClause += " AND date(o.created_at, '+7 hours') BETWEEN date(?) AND date(?)";
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause += " AND date(o.created_at, '+7 hours') >= date(?)";
      params.push(startDate);
    } else if (endDate) {
      whereClause += " AND date(o.created_at, '+7 hours') <= date(?)";
      params.push(endDate);
    } else if (month && month !== 'all') {
      whereClause += " AND strftime('%m', o.created_at, '+7 hours') = ?";
      params.push(month.toString().padStart(2, '0'));
      if (year && year !== 'all') {
        whereClause += " AND strftime('%Y', o.created_at, '+7 hours') = ?";
        params.push(year.toString());
      }
    } else if (year && year !== 'all') {
      whereClause += " AND strftime('%Y', o.created_at, '+7 hours') = ?";
      params.push(year.toString());
    } else {
      // Default to today if no filters
      whereClause += " AND date(o.created_at, '+7 hours') = date('now', '+7 hours')";
    }

    const reportData = db.prepare(`
      SELECT o.id, o.table_number, o.total_amount, o.payment_method, o.processed_by, o.created_at, o.status,
             GROUP_CONCAT(mi.name || ' (x' || oi.quantity || ')') as items_detail
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(...params);

    let csvContent = "Order ID,Table,Items,Total Amount,Status,Payment Method,Cashier,Time\n";
    let grandTotal = 0;
    let unpaidTotal = 0;

    reportData.forEach((row: any) => {
      const statusLabel = row.status === 'unpaid' ? 'BELUM BAYAR (CASHBON)' : 'LUNAS';
      csvContent += `${row.id},${row.table_number},"${row.items_detail}",${row.total_amount},${statusLabel},${row.payment_method || 'N/A'},${row.processed_by || 'System'},${row.created_at}\n`;
      if (row.status === 'paid') {
        grandTotal += row.total_amount;
      } else {
        unpaidTotal += row.total_amount;
      }
    });

    csvContent += `\nTOTAL LUNAS,,, ${grandTotal},,,,\n`;
    csvContent += `TOTAL CASHBON,,, ${unpaidTotal},,,,\n`;
    csvContent += `GRAND TOTAL (LUNAS + CASHBON),,, ${grandTotal + unpaidTotal},,,,\n`;

    let filename = "Report_Orders.csv";
    if (startDate && endDate) filename = `Report_${startDate}_to_${endDate}.csv`;
    else if (startDate) filename = `Report_From_${startDate}.csv`;
    else if (endDate) filename = `Report_To_${endDate}.csv`;
    else if (month !== 'all') filename = `Report_${year}_${month}.csv`;
    else filename = `Report_${year}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvContent);
  });

  // Debug route (moved to top)

  // API routes logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API REQUEST] ${req.method} ${req.url}`);
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Starting in DEVELOPMENT mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    (global as any).vite = vite;
    app.use(vite.middlewares);
  }

  // Serve static files from dist if it exists (useful for both dev and prod)
  const distPath = path.join(__dirname, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  // GLOBAL SPA Fallback (Catch-all)
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl || req.url;
    
    // Skip API, Uploads, and files with extensions (assets)
    if (url.startsWith('/api') || url.startsWith('/uploads') || path.extname(url)) {
      return next();
    }
    
    console.log(`[SERVER] Global Fallback for: ${url}`);
    try {
      let rootIndex = path.resolve(__dirname, "index.html");
      const distIndex = path.resolve(__dirname, "dist", "index.html");
      
      if (process.env.NODE_ENV === "production" && fs.existsSync(distIndex)) {
        rootIndex = distIndex;
      }

      if (process.env.NODE_ENV !== "production" && (global as any).vite) {
        console.log("[SERVER] Serving Vite-transformed index.html");
        let template = fs.readFileSync(rootIndex, "utf-8");
        template = await (global as any).vite.transformIndexHtml(url, template);
        return res.status(200).set({ "Content-Type": "text/html" }).end(template);
      }
      
      console.log("[SERVER] Serving root index.html directly");
      return res.sendFile(rootIndex);
    } catch (e) {
      console.error("[SERVER] Global Fallback Error:", e);
      next(e);
    }
  });
  return { app, httpServer };
} catch (error) {
    console.error("[SERVER] FATAL ERROR DURING STARTUP:", error);
    throw error;
  }
}

// Export for Vercel
export const serverPromise = startServer();

// Only listen if NOT running as a Vercel function
if (!process.env.VERCEL) {
  serverPromise.then(({ httpServer }) => {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    console.log(`[SERVER] Attempting to listen on port ${PORT}...`);
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`[SERVER] SUCCESS: Listening on http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error("[SERVER] Failed to start listener:", err);
  });
}

export default async (req: any, res: any) => {
  const { app } = await serverPromise;
  return app(req, res);
};
