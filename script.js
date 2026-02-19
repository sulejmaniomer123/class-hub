const SUPABASE_URL = "https://drlpgwtetqiwrkadjboo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybHBnd3RldHFpd3JrYWRqYm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY2MTAsImV4cCI6MjA4NzA5MjYxMH0.OlnpA_fzkJ5tJGRZrXwpMpULATtQWioLYwmXa0RQoj8";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function addPost() {
  const name = document.getElementById("name").value.trim();
  const content = document.getElementById("content").value.trim();
  if (!name || !content) return;

  const { error } = await client.from("posts").insert([
    { name, content }
  ]);

  if (error) {
    alert("Error: " + error.message);
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
    container.innerHTML = `<div class="post"><strong>Error</strong><p>${error.message}</p></div>`;
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
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

loadPosts();
