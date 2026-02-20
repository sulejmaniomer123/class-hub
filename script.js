console.log("SCRIPT LOADED");

// ===== Supabase =====
const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== Helpers =====
function usernameToEmail(username) {
  // IMPORTANT: Supabase rejects @something.local
  return `${String(username).trim().toLowerCase()}@classhub.app`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// ===== Auth UI =====
function renderAuthArea(session, profile) {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  if (!session) {
    authArea.innerHTML = `
      <button type="button" onclick="showLogin()">Login</button>
      <button type="button" onclick="showSignup()">Sign Up</button>
    `;
  } else {
    const display = escapeHtml(profile?.display_name || profile?.username || "User");
    authArea.innerHTML = `
      <span style="margin-right:10px; font-weight:800;">${display}</span>
      <a class="nav-link" href="account.html" style="margin-right:8px;">Account</a>
      <button type="button" onclick="logout()">Logout</button>
    `;
  }

  // Admin button show/hide
  const announceBtn = document.getElementById("announceBtn");
  if (announceBtn) {
    announceBtn.style.display = (session && profile?.is_admin) ? "inline-block" : "none";
  }
}

async function showLogin() {
  const u = prompt("Username:");
  if (u == null) return;
  const p = prompt("Password:");
  if (p == null) return;
  await login(u, p);
}

async function showSignup() {
  const u = prompt("Choose a username:");
  if (u == null) return;
  const p = prompt("Choose a password:");
  if (p == null) return;
  await signup(u, p);
}

async function signup(username, password) {
  username = String(username).trim();
  password = String(password);

  if (!username || !password) return alert("Username and password required.");

  const email = usernameToEmail(username);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
    },
  });

  if (error) return alert("Signup error: " + error.message);

  // Depending on Supabase settings, user may need email confirmation.
  // You can disable confirmations in Supabase Auth settings for this school project.
  console.log("SIGNUP data:", data);
  alert("Account created! Now press Login.");
}

async function login(username, password) {
  username = String(username).trim();
  password = String(password);

  const email = usernameToEmail(username);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return alert("Login error: " + error.message);
}

async function logout() {
  await client.auth.signOut();
}

// ===== Profile =====
async function getMyProfile(session) {
  if (!session?.user?.id) return null;

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    // If profiles table/rls blocks, just continue gracefully
    console.log("getMyProfile error:", error.message);
    return null;
  }

  return data || null;
}

// ===== Wall rules =====
function enforcePostingRules(session, profile) {
  const postBtn = document.getElementById("postBtn");
  const content = document.getElementById("content");
  const hint = document.getElementById("loginHint");

  if (postBtn && content) {
    const loggedIn = !!session;
    postBtn.disabled = !loggedIn;
    content.disabled = !loggedIn;
    if (hint) hint.style.display = loggedIn ? "none" : "block";
  }

  const announceBtn = document.getElementById("announceBtn");
  if (announceBtn) {
    announceBtn.style.display = (session && profile?.is_admin) ? "inline-block" : "none";
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
    .order("created_at", { ascending: false });

  container.innerHTML = "";

  if (error) {
    container.innerHTML = `
      <div class="post">
        <strong>Error</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
    return;
  }

  (data || []).forEach((p) => {
    const avatar = p.avatar_url ? escapeHtml(p.avatar_url) : "";
    container.innerHTML += `
      <div class="post" style="display:flex;gap:10px;align-items:flex-start;">
        <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;">
        <div>
          <strong>${escapeHtml(p.name || "User")}</strong>
          <p>${escapeHtml(p.content || "")}</p>
        </div>
      </div>
    `;
  });
}

// ===== Announcements (reads latest row from "announcements") =====
async function loadAnnouncement() {
  const t = document.getElementById("annTitle");
  const b = document.getElementById("annBody");
  if (!t || !b) return;

  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    b.textContent = "No announcements yet.";
    console.log("announcements error:", error.message);
    return;
  }

  const row = (data || [])[0];
  if (!row) {
    b.textContent = "No announcements yet.";
    return;
  }

  t.textContent = row.title || "Announcement";
  b.textContent = row.body || "";
}

// ===== Admin announce (Netlify function) =====
async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Admin must be logged in.");

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
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) return alert("Failed: " + (await res.text()));

  alert("Announcement posted!");
  await loadAnnouncement();
}

// ===== Init =====
async function init() {
  console.log("INIT RUNNING");

  const { data: sess } = await client.auth.getSession();
  let session = sess.session;
  let profile = await getMyProfile(session);

  renderAuthArea(session, profile);
  enforcePostingRules(session, profile);

  await loadAnnouncement();
  await loadPosts();

  client.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    profile = await getMyProfile(session);

    renderAuthArea(session, profile);
    enforcePostingRules(session, profile);

    await loadAnnouncement();
    await loadPosts();
  });
}

document.addEventListener("DOMContentLoaded", init);