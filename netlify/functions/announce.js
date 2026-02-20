async function adminAnnounce() {
  const { data: sess } = await client.auth.getSession();
  const session = sess.session;
  if (!session) return alert("You must be logged in.");

  const profile = await getMyProfile(session);
  if (!profile?.is_admin) return alert("Admins only.");

  const title = prompt("Announcement title:", "Announcement");
  if (title === null) return;
  const body = prompt("Announcement message:");
  if (body === null) return;

  const { error } = await client.from("announcements").insert([{
    title: title.trim(),
    body: body.trim(),
    created_by: session.user.id
  }]);

  if (error) return alert("Announcement error: " + error.message);
  alert("Announcement posted!");
  loadAnnouncement();
}