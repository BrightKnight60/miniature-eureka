# ANALYSIS.md — Python analysis for IMC Prosperity

This document is for agents writing **Python analysis scripts** that feed the visualizer or support strategy research.

---

## Competition background

**IMC Prosperity** is a simulated trading competition. Each round, participants receive **historical price and trade data** for products. The data contains **hidden patterns** that, once identified, can be exploited by trading algorithms.

Products have names like `ASH_COATED_OSMIUM`, `INTARIAN_PEPPER_ROOT`. The market has **up to three levels of depth** per side.

---

## Available data per round

### `prices_round_N_day_D.csv`

Order book snapshots, **semicolon-delimited**.

**Headers:**  
`day;timestamp;product;bid_price_1;bid_volume_1;bid_price_2;bid_volume_2;bid_price_3;bid_volume_3;ask_price_1;ask_volume_1;ask_price_2;ask_volume_2;ask_price_3;ask_volume_3;mid_price;profit_and_loss`

- Empty fields between semicolons when a level is absent.  
- Roughly **~10,000 timestamps per day**.

### `trades_round_N_day_D.csv`

Executed trades, **semicolon-delimited**.

**Headers:**  
`timestamp;buyer;seller;symbol;currency;price;quantity`

- **`buyer` and `seller` are empty** in historical release data.  
- Roughly **~750 trades per day**.

---

## Loading data in Python

```python
import pandas as pd

prices = pd.read_csv("prices_round_1_day_0.csv", sep=";")
trades = pd.read_csv("trades_round_1_day_0.csv", sep=";")
```

---

## Indicator output format (for the visualizer)

Comma-delimited CSV. The **first column must be `timestamp`**, matching the price data timestamp scale. Each additional column is a named indicator.

```csv
timestamp,WallMid,FairValue
0,10001.5,10002.0
100,10003.0,10003.5
```

Save with:

```python
df[["timestamp", "WallMid", "FairValue"]].to_csv("indicators.csv", index=False)
```

---

## Trade label output format (for the visualizer)

Comma-delimited CSV with columns: **`timestamp`**, **`price`**, **`quantity`**, **`label`**, **`color`**, **`shape`**.

- **`timestamp` + `price` + `quantity`** together form the **join key** against trade data in the visualizer.
- **`label`:** any string (each unique label gets its own toggle in the UI).
- **`color`:** hex color string, e.g. `#00ff00`.
- **`shape`:** one of `circle`, `square`, `triangle-up`, `triangle-down`, `cross`, `diamond`.

```csv
timestamp,price,quantity,label,color,shape
200,12007.0,5,BigTaker,#00ff00,triangle-up
3300,12010.0,7,SmallMaker,#ff6600,square
```

---

## Example analysis patterns to look for

- Volume-weighted mid price vs simple mid  
- **Spread behavior:** when does it widen or tighten?  
- **Trade flow imbalance:** buying vs selling pressure over time  
- **Wall detection:** where are the largest resting orders?  
- **Correlation between products**  
- **Mean reversion** of basket premiums  
- **Informed trader detection:** who trades at wall prices with large size?

---

## Tips

- **Empty order book levels:** e.g. `prices["bid_price_2"].fillna(method="ffill")` or simply skip NaNs where inappropriate.  
- **Merge** prices and trades on `timestamp` and `symbol` (or equivalent) for context-aware labeling.  
- **Multi-day analysis:** offset timestamps by day index, or use `(day, timestamp)` tuples to avoid collisions when days are combined.
