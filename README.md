# Machine 3: Binary 64-bit Floating-Point Machine

**CSARCH2 Simulation Project**
**3rd Term, AY 2025–2026**

---

#### Section: S04

#### Members
- Austria, Ma. Alexandria
- Campos, Don Oswin
- Encallado, Edlynn Rei
- Gildore, Andrei Miguel
- Patricio, Anne Beatriz

---

## Project Description

> Machine 3 is a web-based calculator for IEEE 754 double-precision (64-bit) floating-point numbers. It converts decimal numbers to their binary64 representation, demonstrates four rounding methods (chopping, round up, round down, round-to-nearest ties-to-even), and performs addition and multiplication using the Guard-Round-Sticky (GRS) method, with the full working shown at each step.

---

## Tech Stack

- **HTML, CSS, JavaScript**: no frameworks or build tools, runs entirely in the browser

**Core Modules**

| Module | Responsibility |
|---|---|
| `DecToDoubleConverter.js` | Decimal → IEEE 754 double-precision conversion |
| `RoundingMethods.js` | Chopping, round up, round down, round-to-nearest ties-to-even |
| `IEEE754Arithmetic.js` | Addition and multiplication using Guard/Round/Sticky bits |

**Deployment**
- TBD

---

## Project Structure

```text
├── index.html
├── arithmetic.html
├── dectodouble.html
├── rounding.html
├── README.md
├── CSARCH2 Simulation Project1 - 3rd Term AY 2025-2026.pdf
│
├── css/
│   ├── style.css
│   └── tools.css
│
└── js/
    ├── DecToDoubleConverter.js
    ├── IEEE754Arithmetic.js
    ├── RoundingMethods.js
    ├── nav.js
    └── script.js
```

---

## Pages

| Page | Description |
|---|---|
| `index.html` | Landing page |
| `dectodouble.html` | Decimal → IEEE 754 double-precision converter |
| `rounding.html` | Chopping / round up / round down / round-to-nearest ties-to-even |
| `arithmetic.html` | Addition & multiplication with GRS rounding trace |

---

## Screenshots

**Convert Decimal to Binary:**
<p align="center">
  <img src="cvt1.1.jpg" width="45%" />
  <img src="cvt1.2.jpg" width="45%" />
</p>

---

## Deployment

> TBD

---

## Video Walkthrough

**YouTube Link:**
> TBD

---

## License

This project is for academic purposes only.
