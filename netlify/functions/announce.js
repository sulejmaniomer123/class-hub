exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { username, password, title, body } = JSON.parse(event.body || "{}");

    // Your admin credentials
    if (username !== "Admin" || password !== "Admin123") {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Call Supabase REST API directly (no extra packages needed)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/announcements?id=eq.1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        title: title || "Announcement",
        body: body || ""
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 500, body: txt };
    }

    return { statusCode: 200, body: "OK" };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
