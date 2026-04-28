import express from "express";
import mysql from "mysql2";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const {
  DB_HOST = "localhost",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "shopify-app-history",
  PORT = 3000,
} = process.env;

const connection = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err.message);
    return;
  }
  console.log(`Connected successfully with : ${connection.config.database}`);
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

// POST — insert a discount rule
app.post("/api/discount-rules", (req, res) => {
  const { rule_id, minQuntity, maxQuntity, discountType, discountvalue } =
    req.body;

  const insertQuery = `
    INSERT INTO product_discount (rule_id, minQuntity, maxQuntity, discountType, discountvalue)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(
    insertQuery,
    [rule_id, minQuntity, maxQuntity, discountType, discountvalue],
    (err, results) => {
      if (err) {
        console.error("Error inserting data:", err.message);
        return res.status(500).json({ error: "Database insertion failed" });
      }
      res.status(200).json({
        message: "Discount rule inserted successfully",
        insertId: results.insertId,
      });
    }
  );
});

// GET — all rules
app.get("/api/discount-rules", (req, res) => {
  connection.query(
    "SELECT * FROM product_discount ORDER BY id DESC",
    (err, results) => {
      if (err) {
        console.error("Error fetching data:", err.message);
        return res.status(500).json({ error: "Failed to fetch discount rules" });
      }
      res.status(200).json(results);
    }
  );
});

// DELETE — remove a rule by rule_id
app.delete("/api/discount-rules/:id", (req, res) => {
  const ruleId = req.params.id;
  connection.query(
    "DELETE FROM product_discount WHERE rule_id = ?",
    [ruleId],
    (err, results) => {
      if (err) {
        console.error("Error deleting rule:", err.message);
        return res.status(500).json({ error: "Failed to delete rule" });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.status(200).json({ message: "Rule deleted successfully" });
    }
  );
});
