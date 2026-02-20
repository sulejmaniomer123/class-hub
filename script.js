// ===== Supabase =====
const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== Helpers =====
function usernameToEmail(username) {
  return `${username.toLowerCase()}@classhub.local`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

// ===== AUTH UI =====
function renderAuthArea(session, profile) {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  if (!session) {
    authArea.innerHTML = `
      <button onclick="showLogin()">Login</button>
      <button onclick="showSignup()">Sign Up</button>
    `;
    return;
  }

  authArea.innerHTML = `
    <span style="margin-right:10px;font-weight:600;">
      ${escapeHtml(profile?.display_name || profile?.username || "User")}
    </span>
    <button onclick="logout()">Logout</button>
  `;
}

function showLogin() {
  const u = prompt("Username:");
  if (!u) return;
  const p = prompt("Password:");
  if (!p) return;
  login(u.trim(), p);
}

function showSignup() {
  const u = prompt("Choose username:");
  if (!u) return;
  const p = prompt("Choose password:");
  if (!p) return;
  signup(u.trim(), p);
}

async function signup(username, password) {
  const email = usernameToEmail(username);

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: username } }
  });

  console.log("SIGNUP data:", data);
  console.log("SIGNUP error:", error);

  if (error) return alert("Signup error: " + error.message);
  alert("Account created! Now log in.");
}

async function login(username, password) {
  const email = usernameToEmail(username);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);
}

async function logout() {
  await client.auth.signOut();
  window.location.reload();
}

// ===== PROFILE =====
async function getMyProfile(session) {
  if (!session?.user?.id) return null;

  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return data || null;
}

// ===== POST PERMISSIONS =====
function enforcePostingRules(session, profile) {
  const postBtn = document.getElementById("postBtn");
  const content = document.getElementById("content");
  const hint = document.getElementById("loginHint");
  const announceBtn = document.getElementById("announceBtn");

  if (!postBtn || !content) return;

  const loggedIn = !!session;

  postBtn.disabled = !loggedIn;
  content.disabled = !loggedIn;
  if (hint) hint.style.display = loggedIn ? "none" : "block";

  if (announceBtn) {
    announceBtn.style.display =
      (profile && profile.is_admin) ? "inline-block" : "none";
  }
}

// ===== POSTS =====
async function addPost() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Please log in to post.");

  const contentEl = document.getElementById("content");
  if (!contentEl) return;

  const content = contentEl.value.trim();
  if (!content) return;

  const profile = await getMyProfile(session);

  const { error } = await client.from("posts").insert([{
    user_id: session.user.id,
    name: profile?.display_name || profile?.username || "User",
    content,
    avatar_url: profile?.avatar_url || null
  }]);

  if (error) return alert(error.message);

  contentEl.value = "";
  loadPosts();
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
    container.innerHTML = `<p>Error loading posts</p>`;
    return;
  }

  (data || []).forEach(p => {
    container.innerHTML += `
      <div class="post" style="display:flex;gap:10px;margin-bottom:15px;">
        <img src="${p.avatar_url || ''}" 
             style="width:40px;height:40px;border-radius:50%;background:#eee;">
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <p>${escapeHtml(p.content)}</p>
        </div>
      </div>
    `;
  });
}

// ===== ADMIN =====
async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Admin must be logged in.");

  const title = prompt("Announcement title:");
  if (!title) return;
  const body = prompt("Announcement message:");
  if (!body) return;

  const res = await fetch("/.netlify/functions/announce", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ title, body })
  });

  if (!res.ok) return alert("Failed to announce.");
  alert("Announcement posted!");
}

// ===== INIT =====
async function init() {
  console.log("INIT RUNNING");

  const { data: sess } = await client.auth.getSession();
  let session = sess.session;
  let profile = session ? await getMyProfile(session) : null;

  renderAuthArea(session, profile);
  enforcePostingRules(session, profile);
  loadPosts();

  client.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    profile = session ? await getMyProfile(session) : null;

    renderAuthArea(session, profile);
    enforcePostingRules(session, profile);
    loadPosts();
  });
}

document.addEventListener("DOMContentLoaded", init);