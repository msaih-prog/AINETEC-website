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

const VALID_SCORES = [
  "Strongly Accept", "Accept", "Weakly Accept",
  "Weakly Reject", "Reject", "Strongly Reject",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ succes: false, message: "Méthode non autorisée." }, 405);

  try {
    const { token, assignmentId, score, commentaire } = await req.json();
    if (!token || !assignmentId || !score || !commentaire) {
      return json({ succes: false, message: "Champs manquants." }, 400);
    }
    if (!VALID_SCORES.includes(score)) {
      return json({ succes: false, message: "Score invalide." }, 400);
    }
    if (String(commentaire).trim().length < 20) {
      return json({ succes: false, message: "Le commentaire est trop court (20 caractères minimum)." }, 400);
    }

    const { data: reviewer, error: reviewerError } = await supabaseAdmin
      .from("reviewers")
      .select("id")
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
    if (config && config.review_session_ouverte === false) {
      return json({ succes: false, message: "La période de review est terminée." });
    }

    const { data: assignment, error: aError } = await supabaseAdmin
      .from("assignments")
      .select("id, reviewer_id, statut")
      .eq("id", assignmentId)
      .maybeSingle();
    if (aError) throw aError;
    if (!assignment || assignment.reviewer_id !== reviewer.id) {
      return json({ succes: false, message: "Cette review ne vous appartient pas." }, 403);
    }
    if (assignment.statut === "Review reçue") {
      return json({ succes: false, message: "Une review a déjà été soumise pour ce papier." });
    }

    const { error: updateError } = await supabaseAdmin
      .from("assignments")
      .update({
        score,
        commentaire,
        statut: "Review reçue",
        date_reponse: new Date().toISOString(),
      })
      .eq("id", assignmentId);
    if (updateError) throw updateError;

    return json({ succes: true });
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
