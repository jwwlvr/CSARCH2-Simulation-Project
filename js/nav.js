/**
 * Shared site chrome: builds the top nav from a single source of truth
 */
const NAV_LINKS = [
  { key: "home", href: "index.html", label: "Home" },
  { key: "converter", href: "dectodouble.html", label: "Converter" },
  { key: "rounding", href: "rounding.html", label: "Rounding" },
  { key: "arithmetic", href: "arithmetic.html", label: "Arithmetic" },
];

const TEAM = [
  "Austria, Ma. Alexandria",
  "Campos, Don Oswin",
  "Encallado, Edlynn Rei",
  "Gildore, Andrei Miguel",
  "Patricio, Anne Beatriz",
];

function renderSiteNav(mount) {
  const active = mount.dataset.active || "";
  const links = NAV_LINKS
    .map((l) => `<a href="${l.href}"${l.key === active ? ' class="is-active"' : ""}>${l.label}</a>`)
    .join("");

  mount.innerHTML = `
    <div class="brand">
      <a href="index.html" class="brand-link">
        <div class="logo-dot"><i></i><i></i></div>
        <div class="brand-name">Machine 3 <span>IEEE 754 · double precision</span></div>
      </a>
    </div>
    <div class="nav-links">${links}</div>
    <div class="team-menu" id="teamMenu">
      <button class="nav-cta" id="teamBtn" aria-expanded="false" aria-haspopup="true">Team</button>
      <div class="team-dropdown" id="teamDropdown">
        <div class="team-dropdown-title">Section S04</div>
        <ul>${TEAM.map((n) => `<li>${n}</li>`).join("")}</ul>
      </div>
    </div>
  `;

  initTeamDropdown(mount.querySelector(".team-menu"));
}

function initTeamDropdown(teamMenu) {
  const teamBtn = teamMenu?.querySelector("#teamBtn");
  if (!teamBtn || !teamMenu) return;

  teamBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = teamMenu.classList.toggle("open");
    teamBtn.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (e) => {
    if (!teamMenu.contains(e.target)) {
      teamMenu.classList.remove("open");
      teamBtn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      teamMenu.classList.remove("open");
      teamBtn.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("site-nav");
  if (mount) renderSiteNav(mount);
});