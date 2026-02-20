exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return { statusCode: 401, body: "Missing auth token" };

    // 1) Get user from token (using anon key)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${token}`
      }
    });
    if (!userRes.ok) return { statusCode: 401, body: "Invalid token" };
    const user = await userRes.json();

    // 2) Check admin flag (using service role)
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_admin`, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      }
    });
    const prof = await profRes.json();
    if (!prof?.[0]?.is_admin) return { statusCode: 403, body: "Not admin" };

    // 3) Update announcement
    const { title, body } = JSON.parse(event.body || "{}");

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/announcements?id=eq.1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ title: title || "Announcement", body: body || "" })
    });

    if (!updateRes.ok) return { statusCode: 500, body: await updateRes.text() };

    return { statusCode: 200, body: "OK" };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};