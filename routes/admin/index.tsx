import { define } from "../../utils.ts";

const adminLinks = [
  { href: "/admin/users", title: "User Management", desc: "Moderator and Display Wall accounts" },
  {
    href: "/admin/parameters",
    title: "System Parameters",
    desc: "Train, upload, and moderation settings",
  },
  { href: "/admin/audit-log", title: "Audit Log", desc: "Read-only action history" },
  {
    href: "/admin/display-override",
    title: "Display Override",
    desc: "Blank, placeholder, or resume display",
  },
];

export default define.page(function AdminIndexPage() {
  return (
    <div class="page page--moderate">
      <h2 class="heading-brand">Admin Panel</h2>
      <div class="admin-grid">
        {adminLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            class="admin-card"
          >
            <strong class="admin-card__title">{link.title}</strong>
            <p class="admin-card__desc">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
});
