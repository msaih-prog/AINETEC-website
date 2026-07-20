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
    const assignmentId = url.searchParams.get("assignment");
    if (!token || !assignmentId) {
      return json({ succes: false, message: "Paramètres manquants." }, 400);
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
      .select("id, num_reviewer, statut, score, commentaire, reviewer_id, paper:papers(paper_id, titre)")
      .eq("id", assignmentId)
      .maybeSingle();
    if (aError) throw aError;
    if (!assignment || assignment.reviewer_id !== reviewer.id) {
      return json({ succes: false, message: "Cette review ne vous appartient pas." }, 403);
    }

    let pdfUrl: string | null = null;
    const paper = assignment.paper as unknown as { paper_id: string; titre: string };

    // Le papier peut avoir été uploadé en .pdf ou .docx : on cherche le fichier
    // qui existe réellement plutôt que de supposer une extension.
    const { data: files } = await supabaseAdmin.storage
      .from("papers")
      .list("", { search: paper.paper_id });
    const match = (files || []).find((f) =>
      f.name === `${paper.paper_id}.pdf` || f.name === `${paper.paper_id}.docx`
    );
    if (match) {
      // { download: match.name } force Content-Disposition: attachment côté navigateur,
      // quel que soit le format du fichier.
      const { data: signed } = await supabaseAdmin.storage
        .from("papers")
        .createSignedUrl(match.name, 60 * 30, { download: match.name });
      if (signed) pdfUrl = signed.signedUrl;
    }

    return json({
      succes: true,
      data: {
        paperID: paper.paper_id,
        titre: paper.titre,
        numReviewer: assignment.num_reviewer,
        statut: assignment.statut,
        score: assignment.score,
        commentaire: assignment.commentaire,
        pdfUrl,
      },
    });
  } catch (e) {
    return json({ succes: false, message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
