import { define } from "../utils.ts";

export default define.page(function Home() {
  return (
    <div style="padding: 3rem 1.5rem; text-align: center; max-width: 600px; margin: 0 auto;">
      <img src="/logo.svg" alt="SG National Day" width="120" height="120" />
      <h2 style="color: #ef3340; margin-top: 1.5rem;">Welcome to Ground Up Wall</h2>
      <p>
        Share your National Day moments with our community photowall. More features coming soon!
      </p>
    </div>
  );
});
