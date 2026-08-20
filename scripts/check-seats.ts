/**
 * Standalone trigger for the seat-check job, useful if you're not deploying
 * on Vercel (e.g. running your own cron via systemd timer / GitHub Actions
 * schedule / crontab) and just want to hit your deployed app's endpoint.
 *
 * Usage: APP_URL=https://your-app.vercel.app CRON_SECRET=xxx npx tsx scripts/check-seats.ts
 */
async function main() {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;

  if (!appUrl || !secret) {
    console.error("Set APP_URL and CRON_SECRET env vars.");
    process.exit(1);
  }

  const res = await fetch(`${appUrl}/api/cron/check-seats`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json();
  console.log(new Date().toISOString(), data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
