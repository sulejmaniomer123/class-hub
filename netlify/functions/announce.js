async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("Admin must be logged in.");

  const profile = await getMyProfile(session);
  if (!profile?.is_admin) return alert("Not an admin.");

  const title = prompt("Announcement title:", "Announcement");
  if (title === null) return;

  const body = prompt("Announcement message:");
  if (body === null) return;

  const { error } = await client.from("announcements").insert([{
    user_id: session.user.id,
    title: title.trim(),
    body: body.trim()
  }]);

  if (error) return alert("Failed: " + error.message);

  alert("Announcement posted!");
  loadAnnouncement();
}