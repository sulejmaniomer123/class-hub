alert("script loaded");
// ====== Supabase ======
const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Convert "username" into an email so Supabase Auth works
function usernameToEmail(username) {
  return `${username.toLowerCase()}@classhub.local`;
}

// ====== Auth UI (Login/Signup in navbar) ======
function renderAuthArea(session, profile) {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  // Not logged in
  if (!session) {
    authArea.innerHTML = `
      <button onclick="showLogin()">Login</button>
      <button onclick="showSignup()">Sign Up</button>
    `;
    return;
  }

  // Logged in
  authArea.innerHTML = `
    <span style="margin-right:10px;">${session.user.email}</span>
    <button onclick="logout()">Logout</button>
  `;

  // Admin check
  const announceBtn = document.getElementById("announceBtn");
  if (announceBtn) {
    announceBtn.style.display =
      (profile && profile.is_admin) ? "inline-block" : "none";
  }
}
// ====== Profile load ======
async function getMyProfile(session) {
  if (!session?.user?.id) return null;
  const { data } = await client.from("profiles").select("*").eq("id", session.user.id).single();
  return data || null;
}

// ====== Wall: require login to post ======
async function enforcePostingRules(session, profile) {
  const postBtn = document.getElementById("postBtn");
  const content = document.getElementById("content");
  const hint = document.getElementById("loginHint");
  const announceBtn = document.getElementById("announceBtn");

  if (!postBtn || !content) return;

  const loggedIn = !!session;

  if (!loggedIn) {
    postBtn.disabled = true;
    content.disabled = true;
    if (hint) hint.style.display = "block";
  } else {
    postBtn.disabled = false;
    content.disabled = false;
    if (hint) hint.style.display = "none";
  }

  // Show Admin-only announce button
  if (announceBtn) {
    announceBtn.style.display = (profile && profile.is_admin) ? "inline-block" : "none";
  }
}

// ====== Posts ======
async function addPost() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Please log in to post.");

  const contentEl = document.getElementById("content");
  const postsEl = document.getElementById("posts");
  if (!contentEl || !postsEl) return;

  const content = contentEl.value.trim();
  if (!content) return;

  // Get profile for name/pfp
  const profile = await getMyProfile(session);

  const { error } = await client.from("posts").insert([{
  user_id: session.user.id,
  name: profile?.display_name || profile?.username || "User",
  content,
  avatar_url: profile?.avatar_url || null
}]);

  if (error) return alert("Post error: " + error.message);

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
    container.innerHTML = `<div class="post"><strong>Error</strong><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  (data || []).forEach(p => {
container.innerHTML += `
  <div class="post" style="display:flex;gap:10px;align-items:flex-start;">
    <img src="${p.avatar_url || ''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;">
    <div>
      <strong>${escapeHtml(p.name || "User")}</strong>
      <p>${escapeHtml(p.content || "")}</p>
    </div>
  </div>
`;

// ====== Admin announce (uses your Netlify function) ======
async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Admin must be logged in.");

  const title = prompt("Announcement title:", "Announcement");
  if (title === null) return;
  const body = prompt("Announcement message:");
  if (body === null) return;

  const res = await fetch("/.netlify/functions/announce", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ title, body })
  });

  if (!res.ok) return alert("Failed: " + await res.text());
  alert("Announcement posted!");
}

// ====== Init ======
document.addEventListener("DOMContentLoaded", init);
  const { data: sess } = await client.auth.getSession();
  let session = sess.session;
  let profile = await getMyProfile(session);

  renderAuthArea(session, profile);
  enforcePostingRules(session, profile);

  // Posts page only
  loadPosts();

  // Update UI on login/logout
  client.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    profile = await getMyProfile(session);
    renderAuthArea(session, profile);
    enforcePostingRules(session, profile);
    loadPosts();
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

init();
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

  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (data) {
    displayInput.value = data.display_name;
    if (data.avatar_url) avatarImg.src = data.avatar_url;
  }
}

async function saveProfile() {
  const displayName = document.getElementById("displayName").value.trim();
  const file = document.getElementById("avatarFile").files[0];

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

    const { data: publicUrl } = client
      .storage
      .from("avatars")
      .getPublicUrl(filePath);

    avatarUrl = publicUrl.publicUrl;
  }

  const updates = { display_name: displayName };
  if (avatarUrl) updates.avatar_url = avatarUrl;

  const { error } = await client
    .from("profiles")
    .update(updates)
    .eq("id", session.user.id);

  if (error) return alert("Update error: " + error.message);

  alert("Profile updated!");
  loadAccountPage();
}

loadAccountPage();