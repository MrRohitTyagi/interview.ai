/**
 * Seeded company → ATS board-token mapping. No ATS exposes a directory of
 * all its boards, so this list is the entry point for the direct-ATS
 * adapters. Unknown/renamed tokens 404 and are skipped quietly — adding a
 * company here is safe even if you're not sure which ATS it uses.
 */
export const ATS_BOARDS: Record<string, string[]> = {
  // boards-api.greenhouse.io/v1/boards/{token}/jobs
  greenhouse: [
    "stripe",
    "duolingo",
    "coinbase",
    "databricks",
    "gitlab",
    "figma",
    "cloudflare",
    "doordashusa",
    "twilio",
    "airbnb",
  ],
  // api.lever.co/v0/postings/{token}
  lever: ["netflix", "palantir", "plaid", "voleon", "attentive", "zoox"],
  // api.ashbyhq.com/posting-api/job-board/{token}
  ashby: ["openai", "linear", "ramp", "supabase", "replit", "vanta"],
  // api.smartrecruiters.com/v1/companies/{token}/postings
  smartrecruiters: ["Visa", "Bosch", "ServiceNow", "Square"],
  // {token}.recruitee.com/api/offers
  recruitee: ["gorillas", "hotjar", "mollie", "sendcloud"],
};
