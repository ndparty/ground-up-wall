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
    <div style="padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto;">
      <h2 style="color: #ef3340;">Admin Panel</h2>
      <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
        {adminLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style="display: block; padding: 1.25rem; border: 1px solid #ddd; border-radius: 8px; text-decoration: none; color: inherit; background: #fafafa;"
          >
            <strong style="color: #ef3340;">{link.title}</strong>
            <p style="margin: 0.5rem 0 0; font-size: 0.9rem; color: #555;">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
});
