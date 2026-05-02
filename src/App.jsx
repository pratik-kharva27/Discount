import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

const normalizeRule = (rule) => ({
  rule_id: rule.rule_id,
  minQuntity: Number(rule.minQuntity),
  maxQuntity:
    rule.maxQuntity === null ||
    rule.maxQuntity === undefined ||
    rule.maxQuntity === ""
      ? Infinity
      : Number(rule.maxQuntity),
  discountType: rule.discountType,
  discountvalue: Number(rule.discountvalue),
});

const formatCurrency = (value) =>
  `₹${Number(value).toFixed(2)}`;

const formatMaxQuantity = (max) => (max === Infinity ? "+" : max);

function App() {
  const [discountRules, setDiscountRules] = useState([]);
  const [minQuntity, setminQuntity] = useState("");
  const [maxQuntity, setmaxQuntity] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountvalue, setdiscountvalue] = useState("");
  const [formError, setFormError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("qds-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const idCounter = useRef(0);

  const [cartItems, setCartItems] = useState([
    { id: 1, name: "Sample Product 1", price: 25.0, quantity: 1 },
    { id: 2, name: "Sample Product 2", price: 50.0, quantity: 1 },
    { id: 3, name: "Sample Product 3", price: 75.0, quantity: 1 },
  ]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("qds-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  const { originalTotal, discountedTotal, messages, totalDiscount } =
    useMemo(() => {
      let originalTotal = 0;
      let discountedTotal = 0;
      const messages = [];
      let totalDiscount = 0;

      cartItems.forEach((item) => {
        const itemOriginalTotal = item.price * item.quantity;
        originalTotal += itemOriginalTotal;

        let itemDiscountedTotal = itemOriginalTotal;

        for (const rule of discountRules) {
          if (
            item.quantity >= rule.minQuntity &&
            item.quantity <= rule.maxQuntity
          ) {
            let itemDiscount = 0;
            let itemMessage = "";
            const rangeLabel = `${rule.minQuntity}-${formatMaxQuantity(
              rule.maxQuntity
            )}`;

            if (rule.discountType === "percentage") {
              itemDiscount = itemOriginalTotal * (rule.discountvalue / 100);
              itemMessage = `${item.name}: ${rule.discountvalue}% off for buying ${rangeLabel} units`;
            } else {
              itemDiscount = Math.min(rule.discountvalue, itemOriginalTotal);
              itemMessage = `${item.name}: ${formatCurrency(
                rule.discountvalue
              )} off for buying ${rangeLabel} units`;
            }

            itemDiscountedTotal = itemOriginalTotal - itemDiscount;
            totalDiscount += itemDiscount;
            messages.push(itemMessage);
            break;
          }
        }

        discountedTotal += itemDiscountedTotal;
      });

      return {
        originalTotal: originalTotal.toFixed(2),
        discountedTotal: discountedTotal.toFixed(2),
        messages,
        totalDiscount: totalDiscount.toFixed(2),
      };
    }, [cartItems, discountRules]);

  const validateRule = () => {
    const min = parseInt(minQuntity, 10);
    const value = parseFloat(discountvalue);
    const max = maxQuntity === "" ? Infinity : parseInt(maxQuntity, 10);

    if (!Number.isFinite(min) || min < 1) {
      return "Minimum quantity must be at least 1.";
    }
    if (maxQuntity !== "" && (!Number.isFinite(max) || max < min)) {
      return "Maximum quantity must be greater than or equal to the minimum.";
    }
    if (!Number.isFinite(value) || value <= 0) {
      return "Discount value must be greater than 0.";
    }
    if (discountType === "percentage" && value > 100) {
      return "Percentage discount cannot exceed 100%.";
    }
    return "";
  };

  const handleAddRule = async () => {
    const error = validateRule();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError("");

    const maxNumeric = maxQuntity === "" ? null : parseInt(maxQuntity, 10);

    const newRule = {
      rule_id: `rule_${Date.now()}_${idCounter.current++}`,
      minQuntity: parseInt(minQuntity, 10),
      maxQuntity: maxNumeric,
      discountType,
      discountvalue: parseFloat(discountvalue),
    };

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/discount-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      if (!response.ok) throw new Error("Failed to insert rule");
      await response.json();

      setDiscountRules((prev) => [...prev, normalizeRule(newRule)]);
      setminQuntity("");
      setmaxQuntity("");
      setdiscountvalue("");
      setApiError("");
    } catch (err) {
      console.error("Error:", err);
      setApiError(
        "Could not save the rule. Make sure the server is running on " +
          API_BASE
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/discount-rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      await res.json();
      setDiscountRules((prev) => prev.filter((rule) => rule.rule_id !== id));
      setApiError("");
    } catch (err) {
      console.error("Error deleting rule:", err);
      setApiError("Could not delete the rule. Check the server connection.");
    }
  };

  const updateQuantity = (id, change) => {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + change) }
          : item
      )
    );
  };

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/discount-rules`);
      if (!res.ok) throw new Error("Failed to fetch rules");
      const data = await res.json();
      setDiscountRules(Array.isArray(data) ? data.map(normalizeRule) : []);
      setApiError("");
    } catch (err) {
      console.error("Error fetching discount rules:", err);
      setApiError(
        "Could not load saved rules. The app works, but new rules won't persist until the server is reachable."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const formatRuleText = (rule) => {
    const maxDisplay = formatMaxQuantity(rule.maxQuntity);
    if (rule.discountType === "percentage") {
      return `Buy ${rule.minQuntity}-${maxDisplay} → ${rule.discountvalue}% off`;
    }
    return `Buy ${rule.minQuntity}-${maxDisplay} → ${formatCurrency(
      rule.discountvalue
    )} off`;
  };

  const savingsPercent =
    Number(originalTotal) > 0
      ? Math.round((Number(totalDiscount) / Number(originalTotal)) * 100)
      : 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            %
          </span>
          <div>
            <h1>Quantity Discount System</h1>
            <p className="tagline">
              Reward customers for buying more — tiered pricing made simple.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          <span className="theme-icon" aria-hidden="true">
            {theme === "light" ? "☾" : "☀"}
          </span>
          <span className="theme-label">
            {theme === "light" ? "Dark" : "Light"} mode
          </span>
        </button>
      </header>

      {apiError && (
        <div className="banner banner-error" role="alert">
          {apiError}
        </div>
      )}

      <div className="app-container">
        <div className="app-section">
          <div className="card">
            <div className="card-header">
              <h2>Discount Rule Builder</h2>
              <span className="badge">Step 1</span>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="min-qty">Minimum Quantity</label>
                <input
                  id="min-qty"
                  type="number"
                  value={minQuntity}
                  onChange={(e) => setminQuntity(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  min="1"
                  placeholder="e.g., 5"
                />
              </div>

              <div className="form-group">
                <label htmlFor="max-qty">Maximum Quantity</label>
                <input
                  id="max-qty"
                  type="number"
                  value={maxQuntity}
                  onChange={(e) => setmaxQuntity(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  min="1"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="form-group">
                <label htmlFor="disc-type">Discount Type</label>
                <select
                  id="disc-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="disc-value">
                  {discountType === "percentage"
                    ? "Discount Percentage"
                    : "Discount Amount"}
                </label>
                <input
                  id="disc-value"
                  type="number"
                  value={discountvalue}
                  onChange={(e) => setdiscountvalue(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  min="0"
                  step={discountType === "percentage" ? "1" : "0.01"}
                  placeholder={
                    discountType === "percentage"
                      ? "e.g., 10 for 10%"
                      : "e.g., 5.00 for ₹5 off"
                  }
                />
                <div className="input-hint">
                  {discountType === "percentage"
                    ? "Enter a number between 0 and 100"
                    : "Fixed amount to subtract per item"}
                </div>
              </div>
            </div>

            {formError && (
              <div className="banner banner-error" role="alert">
                {formError}
              </div>
            )}

            <button
              className="primary-button"
              onClick={handleAddRule}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding…" : "Add Discount Rule"}
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Active Discount Rules</h2>
              <span className="badge badge-muted">
                {discountRules.length}{" "}
                {discountRules.length === 1 ? "rule" : "rules"}
              </span>
            </div>

            {isLoading ? (
              <div className="empty-state">Loading rules…</div>
            ) : discountRules.length === 0 ? (
              <div className="empty-state">
                <p>No discount rules yet.</p>
                <p className="empty-hint">
                  Add your first rule above to see it appear here.
                </p>
              </div>
            ) : (
              <div className="rules-list">
                {discountRules.map((rule) => (
                  <div key={rule.rule_id} className="rule-item">
                    <div className="rule-details">
                      <strong>{formatRuleText(rule)}</strong>
                      <div className="rule-type">
                        <span
                          className={`chip chip-${
                            rule.discountType === "percentage"
                              ? "info"
                              : "success"
                          }`}
                        >
                          {rule.discountType === "percentage"
                            ? "Percentage"
                            : "Fixed"}
                        </span>
                      </div>
                    </div>
                    <button
                      className="danger-button"
                      onClick={() => handleDeleteRule(rule.rule_id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="app-section">
          <div className="card">
            <div className="card-header">
              <h2>Checkout Simulation</h2>
              <span className="badge">Step 2</span>
            </div>

            {cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">
                    {formatCurrency(item.price)} each
                  </div>
                </div>

                <div className="quantity-controls">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    aria-label={`Decrease ${item.name} quantity`}
                  >
                    −
                  </button>
                  <span className="quantity">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    aria-label={`Increase ${item.name} quantity`}
                  >
                    +
                  </button>
                </div>

                <div className="item-total">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}

            <div className="cart-total">
              <div className="price-breakdown">
                <div className="price-row">
                  <span>Original Total</span>
                  <span className="original-price">
                    {formatCurrency(originalTotal)}
                  </span>
                </div>

                {messages.length > 0 && (
                  <>
                    <div className="discounts-applied">
                      <h4>Discounts Applied</h4>
                      {messages.map((message, index) => (
                        <div key={index} className="discount-message">
                          {message}
                        </div>
                      ))}
                    </div>

                    <div className="price-row">
                      <span>Total Discount</span>
                      <span className="total-discount">
                        −{formatCurrency(totalDiscount)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="final-total">
                <span>Final Total</span>
                <strong>{formatCurrency(discountedTotal)}</strong>
              </div>

              {Number(totalDiscount) > 0 && (
                <div
                  className="savings-bar"
                  aria-label={`You saved ${savingsPercent} percent`}
                >
                  <div
                    className="savings-fill"
                    style={{ width: `${Math.min(savingsPercent, 100)}%` }}
                  />
                  <span className="savings-label">
                    You saved {savingsPercent}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>How It Works</h2>
            </div>
            <ol className="info-list">
              <li>Create tiered rules based on quantity thresholds.</li>
              <li>Pick percentage (%) or fixed amount (₹) discounts.</li>
              <li>Rules are applied per product — each item qualifies independently.</li>
              <li>Only the first matching rule wins, so order your tiers carefully.</li>
              <li>Totals update live as quantities change.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;


