const clientVersion = "0.2.0";
const canvas = document.querySelector("#mesh");
const ctx = canvas.getContext("2d");
const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const logoutBtn = document.querySelector("#logoutBtn");
const createUserForm = document.querySelector("#createUserForm");
const createUserMessage = document.querySelector("#createUserMessage");
const profileForm = document.querySelector("#profileForm");
const profileMessage = document.querySelector("#profileMessage");
const userList = document.querySelector("#userList");
const companyCount = document.querySelector("#companyCount");
const activeUserCount = document.querySelector("#activeUserCount");
const currentVersion = document.querySelector("#currentVersion");
const environmentStatus = document.querySelector("#environmentStatus");
const runEnvironmentBtn = document.querySelector("#runEnvironmentBtn");
const runQuickCheckBtn = document.querySelector("#runQuickCheckBtn");
const diagnosticList = document.querySelector("#diagnosticList");
const fixList = document.querySelector("#fixList");
const environmentBadge = document.querySelector("#environmentBadge");
const versionBadge = document.querySelector("#versionBadge");
const versionMessage = document.querySelector("#versionMessage");
const releaseNotes = document.querySelector("#releaseNotes");
const upgradeBanner = document.querySelector("#upgradeBanner");
const upgradeTitle = document.querySelector("#upgradeTitle");
const upgradeText = document.querySelector("#upgradeText");
const dismissUpgradeBtn = document.querySelector("#dismissUpgradeBtn");
const welcomeTitle = document.querySelector("#welcomeTitle");
const welcomeDesc = document.querySelector("#welcomeDesc");
const adminOnlyBadge = document.querySelector("#adminOnlyBadge");

let width = 0;
let height = 0;
let points = [];
let currentUser = null;

function resetMesh() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.min(72, Math.max(34, Math.floor(width / 22)));
  points = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
  }));
}

function drawMesh() {
  ctx.clearRect(0, 0, width, height);

  points.forEach((point, index) => {
    point.x += point.vx;
    point.y += point.vy;

    if (point.x < -20) point.x = width + 20;
    if (point.x > width + 20) point.x = -20;
    if (point.y < -20) point.y = height + 20;
    if (point.y > height + 20) point.y = -20;

    ctx.fillStyle = index % 5 === 0 ? "rgba(0,169,232,0.34)" : "rgba(16,199,122,0.34)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
    ctx.fill();

    for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
      const next = points[nextIndex];
      const distance = Math.hypot(point.x - next.x, point.y - next.y);
      if (distance < 142) {
        ctx.strokeStyle = `rgba(16,104,92,${(1 - distance / 142) * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }
    }
  });

  requestAnimationFrame(drawMesh);
}

function authHeaders() {
  const token = sessionStorage.getItem("lyhd-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) {
    throw new Error(result.message || "请求失败。");
  }
  return result;
}

function setMessage(node, message, isError = false) {
  node.textContent = message;
  node.classList.toggle("is-error", isError);
}

function fillProfileForm(user) {
  profileForm.companyName.value = user.companyName || "";
  profileForm.username.value = user.username || "";
  profileForm.contactName.value = user.contactName || "";
  profileForm.phone.value = user.phone || "";
  profileForm.email.value = user.email || "";
  profileForm.password.value = "";
}

function setLoggedIn(isLoggedIn, user = null) {
  loginView.classList.toggle("is-hidden", isLoggedIn);
  dashboardView.classList.toggle("is-hidden", !isLoggedIn);
  document.body.classList.toggle("is-authenticated", isLoggedIn);

  if (!isLoggedIn) return;

  currentUser = user;
  welcomeTitle.textContent = `欢迎回来，${user.name || user.username}`;
  welcomeDesc.textContent = `${user.companyName} · ${user.role === "platform_admin" ? "平台管理员" : "企业客户"}`;
  adminOnlyBadge.textContent = user.role === "platform_admin" ? "管理员可用" : "仅平台管理员可创建";
  createUserForm.classList.toggle("is-disabled", user.role !== "platform_admin");
  fillProfileForm(user);
}

function renderUsers(users) {
  const companyNames = new Set(users.map((user) => user.companyName).filter(Boolean));
  companyCount.textContent = String(companyNames.size);
  activeUserCount.textContent = String(users.filter((user) => user.canLogin).length);

  userList.innerHTML = users
    .map(
      (user) => `
        <article>
          <div>
            <strong>${user.companyName}</strong>
            <span>${user.username} · ${user.contactName || "未填写联系人"} · ${user.role}</span>
          </div>
          <em class="${user.canLogin ? "status-on" : "status-off"}">${user.canLogin ? "可登录" : "已停用"}</em>
        </article>
      `
    )
    .join("");
}

async function loadUsers() {
  if (!currentUser || currentUser.role !== "platform_admin") {
    userList.innerHTML = "<article><strong>当前账号不是平台管理员</strong><span>客户账号只能查看和确认自己的企业资料。</span></article>";
    companyCount.textContent = "-";
    activeUserCount.textContent = "-";
    return;
  }

  try {
    const result = await api("/api/users");
    renderUsers(result.users);
  } catch (error) {
    userList.innerHTML = `<article><strong>账号列表加载失败</strong><span>${error.message}</span></article>`;
  }
}

async function checkVersion() {
  try {
    const result = await api(`/api/version?clientVersion=${encodeURIComponent(clientVersion)}`, {
      headers: {},
    });
    currentVersion.textContent = result.currentVersion || clientVersion;
    versionBadge.textContent = result.needsUpgrade ? "需要升级" : "已是最新";
    versionMessage.textContent = result.upgradeMessage;
    releaseNotes.innerHTML = (result.notes || [])
      .map((note) => `<div><strong>更新内容</strong><span>${note}</span></div>`)
      .join("");

    if (result.needsUpgrade && sessionStorage.getItem("lyhd-hide-upgrade") !== "1") {
      upgradeTitle.textContent = `发现新版本 ${result.latestVersion}`;
      upgradeText.textContent = result.upgradeMessage;
      upgradeBanner.classList.remove("is-hidden");
    }
  } catch (error) {
    versionBadge.textContent = "检查失败";
    versionMessage.textContent = error.message;
  }
}

async function collectEnvironment() {
  const apiReachable = await fetch("/api/version")
    .then((response) => response.ok)
    .catch(() => false);

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    localStorage: testStorage(localStorage, "lyhd-local-test"),
    sessionStorage: testStorage(sessionStorage, "lyhd-session-test"),
    fetch: typeof fetch === "function",
    apiReachable,
    online: navigator.onLine,
  };
}

function testStorage(storage, key) {
  try {
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function renderDiagnostics(result, checks) {
  const rows = [
    ["操作系统/浏览器", `${checks.platform} · ${checks.userAgent}`],
    ["屏幕尺寸", `${checks.width} x ${checks.height} · DPR ${checks.pixelRatio}`],
    ["本地存储", checks.localStorage ? "可用" : "不可用"],
    ["会话存储", checks.sessionStorage ? "可用" : "不可用"],
    ["后端接口", checks.apiReachable ? "可连接" : "不可连接"],
    ["网络状态", checks.online ? "在线" : "离线"],
  ];

  diagnosticList.innerHTML = rows
    .map(([title, value]) => `<div><strong>${title}</strong><span>${value}</span></div>`)
    .join("");

  fixList.innerHTML = result.fixes
    .map((fix) => `<div><strong>修复建议</strong><span>${fix}</span></div>`)
    .join("");

  environmentBadge.textContent = result.status === "healthy" ? "正常" : "需处理";
  environmentStatus.textContent = result.status === "healthy" ? "正常" : "需处理";
}

async function runEnvironmentCheck() {
  environmentBadge.textContent = "检测中";
  environmentStatus.textContent = "检测中";

  try {
    const checks = await collectEnvironment();
    const result = await api("/api/environment/report", {
      method: "POST",
      body: JSON.stringify({ checks }),
    });
    renderDiagnostics(result, checks);
  } catch (error) {
    environmentBadge.textContent = "失败";
    environmentStatus.textContent = "失败";
    fixList.innerHTML = `<div><strong>检测失败</strong><span>${error.message}</span></div>`;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const data = new FormData(loginForm);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "").trim();
  const submitButton = loginForm.querySelector("button[type='submit']");

  try {
    loginError.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "登录中...";

    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    sessionStorage.setItem("lyhd-auth", "1");
    sessionStorage.setItem("lyhd-token", result.token);
    sessionStorage.setItem("lyhd-user", JSON.stringify(result.user));
    setLoggedIn(true, result.user);
    await Promise.all([loadUsers(), checkVersion(), runEnvironmentCheck()]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    loginError.textContent = error.message || "登录失败，请稍后重试。";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "登录系统";
  }
}

async function handleCreateUser(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(createUserForm).entries());

  try {
    setMessage(createUserMessage, "正在创建账号...");
    const result = await api("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setMessage(createUserMessage, `${result.user.companyName} 的账号已创建。`);
    createUserForm.reset();
    await loadUsers();
  } catch (error) {
    setMessage(createUserMessage, error.message, true);
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(profileForm).entries());

  try {
    setMessage(profileMessage, "正在保存资料...");
    const result = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    sessionStorage.setItem("lyhd-user", JSON.stringify(result.user));
    setLoggedIn(true, result.user);
    setMessage(profileMessage, "资料已保存，并生成确认记录。");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
}

function handleLogout() {
  sessionStorage.removeItem("lyhd-auth");
  sessionStorage.removeItem("lyhd-token");
  sessionStorage.removeItem("lyhd-user");
  currentUser = null;
  setLoggedIn(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("lyhd-user") || "null");
  } catch (error) {
    return null;
  }
}

async function restoreSession() {
  const user = getStoredUser();
  if (sessionStorage.getItem("lyhd-auth") !== "1" || !user) {
    setLoggedIn(false);
    return;
  }

  try {
    const result = await api("/api/me");
    setLoggedIn(true, result.user);
    await Promise.all([loadUsers(), checkVersion(), runEnvironmentCheck()]);
  } catch (error) {
    handleLogout();
  }
}

window.addEventListener("resize", resetMesh);
loginForm.addEventListener("submit", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
createUserForm.addEventListener("submit", handleCreateUser);
profileForm.addEventListener("submit", handleProfileSave);
runEnvironmentBtn.addEventListener("click", runEnvironmentCheck);
runQuickCheckBtn.addEventListener("click", runEnvironmentCheck);
dismissUpgradeBtn.addEventListener("click", () => {
  sessionStorage.setItem("lyhd-hide-upgrade", "1");
  upgradeBanner.classList.add("is-hidden");
});

resetMesh();
drawMesh();
restoreSession();
