const SUPABASE_URL = "https://hcgcmcpxjkihkexqfaqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g81qsCs1GD2vPhtAO4Rovg_HDzsRw6D";
// Named "sb" (not "supabase") to avoid clashing with the global "supabase" object
// created by the CDN script itself, which would silently break init.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
