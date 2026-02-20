
alert("script loaded");

console.log("SCRIPT LOADED");


const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


function usernameToEmail(username) {
  return `${username.toLowerCase()}@classhub.local`;
}

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
    <span style="margin-right:10px;">${session.user.email}</span>
    <button onclick="logout()">Logout</button>
  `;

  
  const announceBtn = document.getElementById("announceBtn");
  if (announceBtn) {
    announceBtn.style.display =
      (profile && profile.is_admin) ? "inline-block" : "none";
  }
}

async function getMyProfile(session) {
  if (!session?.user?.id) return null;
  const { data } = await client.from("profiles").select("*").eq("id", session.user.id).single();
  return data || null;
}

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

  if (announceBtn) {
    announceBtn.style.display = (profile && profile.is_admin) ? "inline-block" : "none";
  }
}

async function addPost() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Please log in to post.");

  const contentEl = document.getElementById("content");
  const postsEl = document.getElementById("posts");
  if (!contentEl || !postsEl) return;

  const content = contentEl.value.trim();
  if (!content) return;

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
    container.innerHTML = `
      <div class="post">
        <strong>Error</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
    return;
  }

  (data || []).forEach(p => {
    container.innerHTML += `
      <div class="post" style="display:flex;gap:10px;align-items:flex-start;">
        <img src="${p.avatar_url || ''}" 
             style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;">
        <div>
          <strong>${escapeHtml(p.name || "User")}</strong>
          <p>${escapeHtml(p.content || "")}</p>
        </div>
      </div>
    `;
  });
}

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


async function init() {
  console.log("INIT RUNNING");
  const { data: sess } = await client.auth.getSession();
  let session = sess.session;


  let profile = null;
  if (session) {
    profile = await getMyProfile(session);
  }

  renderAuthArea(session, profile);
  enforcePostingRules(session, profile);

  if (document.getElementById("posts")) {
    loadPosts();
  }

  client.auth.onAuthStateChange(async (_event, newSessionObj) => {
    session = newSessionObj;
    profile = session ? await getMyProfile(session) : null;

    renderAuthArea(session, profile);
    enforcePostingRules(session, profile);

    if (document.getElementById("posts")) {
      loadPosts();
    }
  });
}