// Demo values cycling through the mock card
const demos = [
  {
    name: "π (pi)",
    sign: "0",
    exp: "10000000000",
    man: "1001001000011111101101010100010001000010110100011000",
    hex: "400921FB54442D18",
  },
  {
    name: "-0.1",
    sign: "1",
    exp: "01111111011",
    man: "1001100110011001100110011001100110011001100110011010",
    hex: "BFB999999999999A",
  },
  {
    name: "+Infinity",
    sign: "0",
    exp: "11111111111",
    man: "0000000000000000000000000000000000000000000000000000",
    hex: "7FF0000000000000",
  },
];

function truncateBits(bits, keep = 18) {
  if (bits.length <= keep) return bits;
  return bits.slice(0, keep) + "…";
}

let demoIndex = 0;

function playDemo() {
  const d = demos[demoIndex % demos.length];

  document.getElementById("valSign").textContent = d.sign;
  document.getElementById("valName").textContent = d.name;
  document.getElementById("valExp").textContent = d.exp;
  document.getElementById("valMan").textContent = truncateBits(d.man, 20);

  document.getElementById("fcHex").textContent = d.hex.slice(0, 8) + "…";
  document.getElementById("fcExp").textContent = parseInt(d.exp, 2);

  const strip = document.getElementById("bitStrip");
  strip.innerHTML = "";
  const fullBits = (d.sign + d.exp + d.man).slice(0, 48);
  fullBits.split("").forEach((b) => {
    const s = document.createElement("span");
    s.textContent = b;
    s.style.opacity = (0.25 + Math.random() * 0.5).toFixed(2);
    strip.appendChild(s);
  });

  demoIndex++;
}

playDemo();
setInterval(playDemo, 3800);

// Card interactions
document.querySelectorAll(".card").forEach((c) => {
  c.addEventListener("click", () => {
    console.log("Navigate to:", c.id);
  });
  c.addEventListener("keypress", (e) => {
    if (e.key === "Enter") c.click();
  });
});

// Hero CTA
document.getElementById("scrollArithBtn")?.addEventListener("click", () => {
  document.querySelector(".panel").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => {
    document.getElementById("arith")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 500);
});