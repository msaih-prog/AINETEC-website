import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ succes: false, message: "Token manquant." }, 400);

    const { data: reviewer, error: reviewerError } = await supabaseAdmin
      .from("reviewers")
      .select("id, nom, prenom, email")
      .eq("token", token)
      .maybeSingle();
    if (reviewerError) throw reviewerError;
    if (!reviewer) {
      return json({ succes: false, message: "Ce lien n'est pas valide." }, 404);
    }

    const { data: config } = await supabaseAdmin
      .from("config")
      .select("review_session_ouverte")
      .eq("id", 1)
      .single();
    const sessionOuverte = config?.review_session_ouverte ?? true;

    const { data: assignments, error: aError } = await supabaseAdmin
      .from("assignments")
      .select("id, num_reviewer, statut, paper:papers(paper_id, titre)")
      .eq("reviewer_id", reviewer.id)
      .order("num_reviewer");
    if (aError) throw aError;

    return json({
      succes: true,
      sessionOuverte,
      reviewer: { nom: reviewer.nom, prenom: reviewer.prenom },
      assignments: (assignments || []).map((a: any) => ({
        id: a.id,
        numReviewer: a.num_reviewer,
        statut: a.statut,
        paperID: a.paper.paper_id,
        titre: a.paper.titre,
      })),
    });
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
