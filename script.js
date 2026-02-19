const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8"; // paste your anon key

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function addPost() {
  const name = document.getElementById("name").value.trim();
  const content = document.getElementById("content").value.trim();
  if (!name || !content) return;

  const { error } = await client.from("posts").insert([{ name, content }]);

  if (error) {
    alert("Error posting: " + error.message);
    return;
  }

  document.getElementById("content").value = "";
  loadPosts();
}

async function loadPosts() {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const container = document.getElementById("posts");
  if (!container) return;

  container.innerHTML = "";

  if (error) {
    container.innerHTML = `<div class="post"><strong>Error</strong><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }

  data.forEach(p => {
    container.innerHTML += `
      <div class="post">
        <strong>${escapeHtml(p.name)}</strong>
        <p>${escapeHtml(p.content)}</p>
      </div>
    `;
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

loadPosts();
async function loadAnnouncement() {
  const titleEl = document.getElementById("annTitle");
  const bodyEl = document.getElementById("annBody");
  if (!titleEl || !bodyEl) return;

  const { data, error } = await client
    .from("announcements")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    bodyEl.textContent = "Could not load announcement.";
    return;
  }

  titleEl.textContent = data.title;
  bodyEl.textContent = data.body;
}
loadAnnouncement();

async function adminAnnounce() {
  const username = prompt("Admin username:");
  if (username === null) return;

  const password = prompt("Admin password:");
  if (password === null) return;

  const title = prompt("Announcement title:", "Announcement");
  if (title === null) return;

  const body = prompt("Announcement message:");
  if (body === null) return;

  const res = await fetch("/.netlify/functions/announce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, title, body })
  });

  if (!res.ok) {
    alert("Failed: " + (await res.text()));
    return;
  }

  alert("Announcement posted!");
}
