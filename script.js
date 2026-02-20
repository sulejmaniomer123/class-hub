console.log("SCRIPT LOADED");

// ===== Supabase =====
const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8"; // keep your anon key here
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== Helpers =====
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// Use a “real-looking” email domain (NOT .local)
function usernameToEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@classhub.com`;
  // or @classhub.com / @example.com
}
function isWallPage() {
  return !!document.getElementById("posts");
}

function isAccountPage() {
  return !!document.getElementById("displayName");
}

// ===== Auth UI (buttons in navbar) =====
function renderAuthArea(session, profile) {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  if (!session) {
    authArea.innerHTML = `
      <button type="button" class="navBtn" id="loginBtn">Login</button>
      <button type="button" class="navBtn primary" id="signupBtn">Sign Up</button>
    `;

    document.getElementById("loginBtn")?.addEventListener("click", showLogin);
    document.getElementById("signupBtn")?.addEventListener("click", showSignup);

    // Hide admin button when logged out
    const announceBtn = document.getElementById("announceBtn");
    if (announceBtn) announceBtn.style.display = "none";
    return;
  }

  const display = escapeHtml(profile?.display_name || profile?.username || session.user.email || "User");
  authArea.innerHTML = `
    <span class="navUser">${display}</span>
    <button type="button" class="navBtn" id="accountBtn">Account</button>
    <button type="button" class="navBtn" id="logoutBtn">Logout</button>
  `;

  document.getElementById("accountBtn")?.addEventListener("click", () => {
    window.location.href = "account.html";
  });
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  // Admin-only announce button
  const announceBtn = document.getElementById("announceBtn");
  if (announceBtn) {
    announceBtn.style.display = profile?.is_admin ? "inline-block" : "none";
  }
}

async function showLogin() {
  const u = prompt("Username:");
  if (u == null) return;
  const p = prompt("Password:");
  if (p == null) return;
  await login(u.trim(), p);
}

async function showSignup() {
  const u = prompt("Choose a username:");
  if (u == null) return;
  const p = prompt("Choose a password:");
  if (p == null) return;
  await signup(u.trim(), p);
}

async function signup(username, password) {
  if (!username || !password) return;

  const email = usernameToEmail(username);

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: username } },
  });

  console.log("SIGNUP data:", data);
  if (error) {
    console.error("SIGNUP error:", error);
    alert("Signup error: " + error.message);
    return;
  }

  alert("Account created! Now log in.");
}

async function login(username, password) {
  if (!username || !password) return;

  const email = usernameToEmail(username);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  console.log("LOGIN data:", data);
  if (error) {
    console.error("LOGIN error:", error);
    alert("Login error: " + error.message);
    return;
  }
}

async function logout() {
  await client.auth.signOut();
}

// ===== Profiles =====
async function getMyProfile(session) {
  if (!session?.user?.id) return null;

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    // If you haven't created the profiles table/trigger yet, you'll see errors here.
    console.warn("getMyProfile:", error.message);
    return null;
  }

  return data || null;
}

// ===== Wall rules =====
function enforcePostingRules(session, profile) {
  const postBtn = document.getElementById("postBtn");
  const content = document.getElementById("content");
  const hint = document.getElementById("loginHint");
  const announceBtn = document.getElementById("announceBtn");

  if (postBtn && content) {
    const loggedIn = !!session;
    postBtn.disabled = !loggedIn;
    content.disabled = !loggedIn;
    if (hint) hint.style.display = loggedIn ? "none" : "block";
  }

  if (announceBtn) {
    announceBtn.style.display = profile?.is_admin ? "inline-block" : "none";
  }
}

// ===== Posts =====
async function addPost() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Please log in to post.");

  const contentEl = document.getElementById("content");
  if (!contentEl) return;

  const content = contentEl.value.trim();
  if (!content) return;

  const profile = await getMyProfile(session);

  const payload = {
    user_id: session.user.id,
    name: profile?.display_name || profile?.username || "User",
    content,
    avatar_url: profile?.avatar_url || null,
  };

  const { error } = await client.from("posts").insert([payload]);
  if (error) return alert("Post error: " + error.message);

  contentEl.value = "";
  await loadPosts();
}

async function loadPosts() {
  const container = document.getElementById("posts");
  if (!container) return;

  const { data, error } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false }); // if you don't have created_at, add it to posts

  container.innerHTML = "";

  if (error) {
    container.innerHTML = `<div class="post"><strong>Error</strong><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  (data || []).forEach((p) => {
    container.innerHTML += `
      <div class="post" style="display:flex;gap:10px;align-items:flex-start;">
        <img src="${escapeHtml(p.avatar_url || "")}"
             style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;">
        <div>
          <strong>${escapeHtml(p.name || "User")}</strong>
          <p>${escapeHtml(p.content || "")}</p>
        </div>
      </div>
    `;
  });
}

// ===== Announcements (no created_at assumption) =====
async function loadAnnouncement() {
  const titleEl = document.getElementById("annTitle");
  const bodyEl = document.getElementById("annBody");
  if (!titleEl || !bodyEl) return;

  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("announcements:", error.message);
    titleEl.textContent = "Announcement";
    bodyEl.textContent = "No announcements yet.";
    return;
  }

  const latest = (data && data[0]) || null;
  titleEl.textContent = latest?.title || "Announcement";
  bodyEl.textContent = latest?.body || "No announcements yet.";
}

// ===== Admin announce =====
async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Admin must be logged in.");

  // Safety: re-check profile is_admin
  const profile = await getMyProfile(session);
  if (!profile?.is_admin) return alert("Not an admin account.");

  const title = prompt("Announcement title:", "Announcement");
  if (title === null) return;
  const body = prompt("Announcement message:");
  if (body === null) return;

  const res = await fetch("/.netlify/functions/announce", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) return alert("Failed: " + (await res.text()));
  alert("Announcement posted!");
  await loadAnnouncement();
}

// ===== Account page =====
async function loadAccountPage() {
  const avatarImg = document.getElementById("avatarPreview");
  const displayInput = document.getElementById("displayName");
  if (!avatarImg || !displayInput) return;

  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) {
    alert("You must log in.");
    window.location.href = "wall.html";
    return;
  }

  const profile = await getMyProfile(session);
  if (profile) {
    displayInput.value = profile.display_name || profile.username || "";
    if (profile.avatar_url) avatarImg.src = profile.avatar_url;
  }

  // Hook save button if it exists
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfile);
}

async function saveProfile() {
  const displayNameEl = document.getElementById("displayName");
  const fileEl = document.getElementById("avatarFile");
  if (!displayNameEl || !fileEl) return;

  const displayName = displayNameEl.value.trim();
  const file = fileEl.files?.[0];

  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Not logged in.");

  let avatarUrl = null;

  if (file) {
    const filePath = `${session.user.id}-${Date.now()}`;

    const { error: uploadError } = await client
      .storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) return alert("Upload error: " + uploadError.message);

    const { data: publicUrl } = client.storage.from("avatars").getPublicUrl(filePath);
    avatarUrl = publicUrl?.publicUrl || null;
  }

  const updates = { display_name: displayName };
  if (avatarUrl) updates.avatar_url = avatarUrl;

  const { error } = await client.from("profiles").update(updates).eq("id", session.user.id);
  if (error) return alert("Update error: " + error.message);

  alert("Profile updated!");
}

// ===== Init =====
async function init() {
  console.log("INIT RUNNING");

  const { data: sess } = await client.auth.getSession();
  let session = sess.session;
  let profile = await getMyProfile(session);

  renderAuthArea(session, profile);

  if (isWallPage()) {
    enforcePostingRules(session, profile);
    await loadAnnouncement();
    await loadPosts();
  }

  if (isAccountPage()) {
    await loadAccountPage();
  }

  client.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    profile = await getMyProfile(session);

    renderAuthArea(session, profile);

    if (isWallPage()) {
      enforcePostingRules(session, profile);
      await loadPosts();
      await loadAnnouncement();
    }
  });
}

window.addEventListener("DOMContentLoaded", init);