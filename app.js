

const API_BASE = "https://your-render-backend-url.onrender.com";

const LS_USER_KEY = "fall_reg_user";



function getUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_USER_KEY) || "null");
  } catch {
    return null;
  }
}
function setUser(user) {
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
}
function clearUser() {
  localStorage.removeItem(LS_USER_KEY);
}
function getCurrentEmail() {
  const u = getUser();
  return (u?.email || "").trim();
}
function getCurrentRole() {
  const u = getUser();
  return (u?.role || "student");
}


function requireAuth() {
  const page = document.body.dataset.page;
  if (page === "login") return;
  const u = getUser();
  if (!u) window.location.replace("login.html");
}

function renderUserMenu() {
  const container = document.querySelector(".nav-links");
  if (!container) return;

  const old = container.querySelector(".user-chip");
  if (old) old.remove();

  const u = getUser();
  const chip = document.createElement("span");
  chip.className = "user-chip";
  chip.style.display = "inline-flex";
  chip.style.alignItems = "center";
  chip.style.gap = "10px";
  chip.style.marginLeft = "8px";

  if (u) {
    const name = (u.name || u.email || "").split("@")[0] || "Student";
    chip.innerHTML = `
      <span class="badge" title="${u.email}">Hi, ${name}</span>
      <button id="logoutBtn" class="btn secondary" type="button" title="Sign out">Logout</button>
    `;
    container.appendChild(chip);
    chip.querySelector("#logoutBtn").addEventListener("click", () => {
      clearUser();
      window.location.replace("login.html");
    });
  } else {
    chip.innerHTML = `<a class="btn ghost" href="login.html">Sign In</a>`;
    container.appendChild(chip);
  }
}



function maybeBindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const errEl = document.getElementById("loginErr");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.setAttribute("novalidate", "novalidate");

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pwdRe = /^(?=.*[0-9])(?=.*[^\w\s]).{8,}$/;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    let msg = "";
    if (!emailRe.test(email)) {
      msg = "Enter a valid email like you@school.edu.";
    } else if (!pwdRe.test(password)) {
      msg =
        "Password: min 8 chars, include at least one number and one special character.";
    }

    if (msg) {
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = "block";
      }
      return;
    }

    if (errEl) errEl.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in...";
    }

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errEl) {
          errEl.textContent = data.error || "Invalid email or password.";
          errEl.style.display = "block";
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Sign In";
        }
        return;
      }

      
      setUser({
        email: data.email,
        name: data.name,
        role: data.role || "student",
      });
      window.location.href = "index.html";
    } catch {
      if (errEl) {
        errEl.textContent = "Unexpected error. Please try again.";
        errEl.style.display = "block";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}



const $ = (id) => document.getElementById(id);

let SCHEDULE_IDS = new Set();
let SCHEDULE_SECTIONS = [];
let SCHEDULE_TERM = null; 
let ALL_SECTIONS = [];
let SECTION_BY_ID = new Map();

function syncBadge() {
  const el = document.querySelector("#cartBadge");
  if (el) el.textContent = SCHEDULE_IDS.size;
}

function to12h(t) {
  const [HH, MM] = t.split(":").map(Number);
  const ampm = HH >= 12 ? "PM" : "AM";
  let h = HH % 12;
  if (h === 0) h = 12;
  return h + ":" + String(MM).padStart(2, "0") + " " + ampm;
}

function meetingsToString(meetings) {
  return (meetings || [])
    .map((m) => `${m.day_label} ${to12h(m.start)}-${to12h(m.end)}`)
    .join(", ");
}

function showBrowseError(msg) {
  let box = document.getElementById("browseAlert");
  if (!box) {
    box = document.createElement("div");
    box.id = "browseAlert";
    box.className = "alert";
    box.style.display = "none";
    const main =
      document.querySelector("main .container") ||
      document.querySelector("main") ||
      document.body;
    main.insertBefore(box, main.firstChild);
  }
  box.textContent = msg;
  box.style.display = "block";
  clearTimeout(box._t);
  box._t = setTimeout(() => {
    box.style.display = "none";
  }, 4000);
}

function showScheduleMessage(msg) {
  const box = $("conflicts");
  if (!box) return;
  box.textContent = msg || "";
}

async function refreshScheduleFromServer() {
  const email = getCurrentEmail();
  if (!email) {
    SCHEDULE_IDS = new Set();
    SCHEDULE_SECTIONS = [];
    SCHEDULE_TERM = null;
    syncBadge();
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/schedule?email=${encodeURIComponent(email)}`
    );
    if (!res.ok) {
      SCHEDULE_IDS = new Set();
      SCHEDULE_SECTIONS = [];
      SCHEDULE_TERM = null;
      syncBadge();
      return;
    }
    const data = await res.json();
    SCHEDULE_SECTIONS = data;
    SCHEDULE_IDS = new Set(data.map((s) => s.section_id));
    SCHEDULE_TERM = data.length
      ? (data[0].term || "").toUpperCase()
      : null;
    syncBadge();
  } catch {
    SCHEDULE_IDS = new Set();
    SCHEDULE_SECTIONS = [];
    SCHEDULE_TERM = null;
    syncBadge();
  }
}



async function initBrowse() {
  await loadCourses();
  await refreshScheduleFromServer();

  buildFilterOptions();

  ["q", "subject", "credits", "day", "term"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", renderGrid);
  });

  const clearBtn = $("clearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      ["q", "subject", "credits", "day", "term"].forEach((id) => {
        const el = $(id);
        if (el) el.value = "";
      });
      renderGrid();
    });
  }

  renderGrid();
}

async function loadCourses() {
  try {
    const res = await fetch(`${API_BASE}/api/courses`);
    if (!res.ok) {
      showBrowseError("Could not load courses from server.");
      return;
    }
    ALL_SECTIONS = await res.json();
    SECTION_BY_ID = new Map();
    ALL_SECTIONS.forEach((sec) => {
      SECTION_BY_ID.set(sec.section_id, sec);
    });
  } catch (err) {
    console.error(err);
    showBrowseError("Network error loading courses.");
  }
}

function buildFilterOptions() {
  const subjects = new Set();
  const terms = new Set();

  ALL_SECTIONS.forEach((sec) => {
    if (sec.course?.subject) subjects.add(sec.course.subject);
    if (sec.term) terms.add(sec.term);
  });

  const subjectSel = $("subject");
  if (subjectSel) {
    subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      subjectSel.appendChild(opt);
    });
  }

  const termSel = $("term");
  if (termSel) {
    terms.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      const aSection = ALL_SECTIONS.find((sec) => sec.term === code);
      opt.textContent = aSection ? aSection.term_label : code;
      termSel.appendChild(opt);
    });
  }
}

function renderGrid() {
  const grid = $("grid");
  if (!grid) return;
  grid.innerHTML = "";

  const q = ($("q")?.value || "").trim().toLowerCase();
  const subject = $("subject")?.value || "";
  const credits = $("credits")?.value || "";
  const day = $("day")?.value || "";
  const term = ($("term")?.value || "").toUpperCase();

  const filtered = ALL_SECTIONS.filter((sec) => {
    const course = sec.course || {};
    if (
      q &&
      !course.title?.toLowerCase().includes(q) &&
      !course.code?.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (subject && course.subject !== subject) return false;
    if (credits && String(course.credits) !== credits) return false;
    if (term && (sec.term || "").toUpperCase() !== term) return false;
    if (day) {
      const dInt = parseInt(day, 10);
      if (!sec.meetings?.some((m) => m.day === dInt)) return false;
    }
    return true;
  });

  filtered.forEach((sec) => {
    const course = sec.course || {};
    const whenStr = meetingsToString(sec.meetings || []);
    const prereqText =
      course.prereqs && course.prereqs.length
        ? `Prerequisite(s): ${course.prereqs.join(", ")}`
        : "";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row" style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">${course.code || ""} — ${course.title || ""}</h3>
        <span class="badge">${course.subject || ""}</span>
      </div>
      <p class="meta">${course.credits || ""} cr • Instructor: ${
      course.instructor || ""
    }</p>
      <p class="meta">${whenStr}</p>
      <p class="meta">Term: ${sec.term_label || sec.term || ""}</p>
      <p class="meta">${prereqText}</p>
      <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap"></div>
    `;

    const actions = card.querySelector(".actions");
    const chosen = SCHEDULE_IDS.has(sec.section_id);

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = chosen
      ? `Added • ${sec.term_label || sec.term} • CRN ${sec.crn}`
      : `Add • ${sec.term_label || sec.term} • CRN ${sec.crn}`;
    btn.style.opacity = chosen ? 0.75 : 1;

    btn.addEventListener("click", async () => {
      try {
        if (SCHEDULE_IDS.has(sec.section_id)) {
          await removeSection(sec.section_id);
        } else {
          await addSection(sec.section_id);
        }
        await refreshScheduleFromServer();
        syncBadge();
        renderGrid();
      } catch (err) {
        console.error(err);
        showBrowseError("Problem updating schedule.");
      }
    });

    actions.appendChild(btn);
    grid.appendChild(card);
  });
}


async function addSection(sectionId) {
  const sec = SECTION_BY_ID.get(sectionId);
  const email = getCurrentEmail();
  if (!sec || !email) {
    showBrowseError("Could not add section (missing data or not logged in).");
    return;
  }

  const newTerm = (sec.term || "").toUpperCase();
  const course = sec.course || {};

  
  if (SCHEDULE_TERM && newTerm && SCHEDULE_TERM !== newTerm) {
    showBrowseError(
      `Your current schedule is for ${SCHEDULE_TERM}. Clear it to add ${newTerm} courses.`
    );
    return;
  }

  
  const prereqs = course.prereqs || [];
  if (prereqs.length && SCHEDULE_SECTIONS.length && newTerm) {
    const sameTermCourses = SCHEDULE_SECTIONS.filter(
      (s) => (s.term || "").toUpperCase() === newTerm
    )
      .map((s) => s.course?.code)
      .filter(Boolean);

    const conflictCode = prereqs.find((code) =>
      sameTermCourses.includes(code)
    );
    if (conflictCode) {
      showBrowseError(
        `${course.code} requires ${conflictCode}. You cannot take them in the same term.`
      );
      return;
    }
  }

  const res = await fetch(`${API_BASE}/api/schedule/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_id: sectionId, email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showBrowseError(data.error || "Could not add section.");
  }
}

async function removeSection(sectionId) {
  const email = getCurrentEmail();
  if (!email) {
    showBrowseError("You must be logged in.");
    return;
  }
  const res = await fetch(`${API_BASE}/api/schedule/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_id: sectionId, email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showBrowseError(data.error || "Could not remove section.");
  }
}



async function initSchedule() {
  const clr = $("clearCart");
  if (clr) {
    clr.addEventListener("click", () => {
      showClearConfirm();
    });
  }

  
  const headerRow = document.querySelector(
    "main .card > div[style*='justify-content:space-between']"
  );
  let confirmBtn = $("confirmSchedule");
  if (!confirmBtn && headerRow) {
    const rightSide = headerRow.querySelector("div") || headerRow;
    confirmBtn = document.createElement("button");
    confirmBtn.id = "confirmSchedule";
    confirmBtn.type = "button";
    confirmBtn.className = "btn";
    confirmBtn.style.marginRight = "8px";
    confirmBtn.textContent = "Confirm Registration";
    rightSide.insertBefore(confirmBtn, rightSide.firstChild);
  }
  if (confirmBtn) {
    confirmBtn.addEventListener("click", confirmSchedule);
  }

  await renderSchedule();
}

async function renderSchedule() {
  const tbody = $("scheduleBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  await refreshScheduleFromServer();

  const sections = SCHEDULE_SECTIONS.slice();

  if (!sections.length) {
    showScheduleMessage("Your schedule is currently empty.");
  } else {
    showScheduleMessage("");
  }

  sections.forEach((sec) => {
    const course = sec.course || {};
    const when = meetingsToString(sec.meetings || []);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${course.code || ""} — ${course.title || ""}</td>
      <td>CRN ${sec.crn}</td>
      <td>${when}${sec.term_label ? " • " + sec.term_label : ""}</td>
      <td>${course.instructor || ""}</td>
      <td>
        <span class="meta">${sec.status || "PENDING"}</span>
        • <span class="remove" data-id="${sec.section_id}" style="cursor:pointer;color:#b91c1c">Remove</span>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll(".remove").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = Number(el.dataset.id);
      await removeSection(id);
      await renderSchedule();
    });
  });
}


function showClearConfirm() {
  let box = $("clearConfirm");
  if (!box) {
    box = document.createElement("div");
    box.id = "clearConfirm";
    box.className = "alert";
    const card =
      document.querySelector("main .card") || document.querySelector("main");
    if (card) {
      card.insertBefore(box, card.firstChild.nextSibling);
    } else {
      document.body.insertBefore(box, document.body.firstChild);
    }
  }

  box.innerHTML = `
    <span>Are you sure you want to clear your schedule?</span>
    <button id="confirmClearYes" type="button" class="btn secondary" style="margin-left:8px;">Yes, clear</button>
    <button id="confirmClearNo" type="button" class="btn secondary" style="margin-left:4px;">Cancel</button>
  `;
  box.style.display = "block";

  $("confirmClearYes").onclick = async () => {
    await clearSchedule();
    box.style.display = "none";
  };
  $("confirmClearNo").onclick = () => {
    box.style.display = "none";
  };
}

async function clearSchedule() {
  try {
    await refreshScheduleFromServer();
    const sections = SCHEDULE_SECTIONS.slice();
    for (const sec of sections) {
      await removeSection(sec.section_id);
    }
    await renderSchedule();
  } catch {
    showScheduleMessage("Problem clearing schedule.");
  }
}

async function confirmSchedule() {
  const email = getCurrentEmail();
  if (!email) {
    showScheduleMessage("You must be logged in.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/schedule/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showScheduleMessage(data.error || "Could not confirm schedule.");
      return;
    }
    showScheduleMessage(data.message || "Schedule confirmed.");
    await renderSchedule();
  } catch {
    showScheduleMessage("Network error confirming schedule.");
  }
}



async function initAdmin() {
  const tbody = $("adminBody");
  const msgEl = $("adminMsg");
  if (!tbody || !msgEl) return;

  const email = getCurrentEmail();
  if (!email) {
    msgEl.textContent = "You must be logged in.";
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/enrollments?email=${encodeURIComponent(email)}`
    );
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      msgEl.textContent = (data && data.error) || "Admin access only.";
      return;
    }

    if (!Array.isArray(data) || !data.length) {
      msgEl.textContent = "No enrollments yet.";
      return;
    }

    msgEl.textContent = "";
    tbody.innerHTML = "";

    data.forEach((en) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${en.student_name} (${en.student_email})</td>
        <td>${en.course_code} — ${en.course_title}</td>
        <td>${en.term_label || en.term}</td>
        <td>CRN ${en.crn}</td>
        <td>${en.status}</td>
      `;
      tbody.appendChild(row);
    });
  } catch {
    msgEl.textContent = "Network error loading admin data.";
  }
}



document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  renderUserMenu();

  const page = document.body.dataset.page;

  if (page === "login") {
    maybeBindLoginForm();
    return;
  }

  
  await refreshScheduleFromServer();
  syncBadge();

  if (page === "browse") {
    await initBrowse();
  } else if (page === "schedule") {
    await initSchedule();
  } else if (page === "admin") {
    await initAdmin();
  }
});

