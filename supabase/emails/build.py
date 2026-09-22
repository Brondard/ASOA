# Génère les modèles d'e-mails Supabase aux couleurs de l'ASOA.
# Les {{ ... }} sont remplacés par Supabase au moment de l'envoi.
BASE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f2f1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f2f1;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <!-- En-tête noir + logo -->
    <tr><td style="background:#141112;border-radius:10px 10px 0 0;padding:28px 32px 24px;border-bottom:4px solid #d0152b;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#d0152b;padding:6px 14px 5px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;font-style:italic;letter-spacing:1px;color:#ffffff;line-height:1;">ASOA</td>
        <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#bdb4b5;">Antibes</td>
      </tr></table>
    </td></tr>

    <!-- Contenu -->
    <tr><td style="background:#ffffff;padding:36px 32px 12px;font-family:Arial,Helvetica,sans-serif;color:#161213;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#d0152b;">{kicker}</p>
      <h1 style="margin:0 0 18px;font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:30px;line-height:1.1;font-weight:bold;text-transform:uppercase;color:#161213;">{heading}</h1>
      {body}
    </td></tr>

    <!-- Bouton -->
    <tr><td style="background:#ffffff;padding:16px 32px 8px;" align="left">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#d0152b;border-radius:6px;">
          <a href="{url}" style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">{button}</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- Lien de secours -->
    <tr><td style="background:#ffffff;padding:20px 32px 32px;border-radius:0 0 10px 10px;font-family:Arial,Helvetica,sans-serif;">
      <p style="margin:0 0 6px;font-size:13px;color:#736a6b;">Le bouton ne marche pas ? Copie ce lien dans ton navigateur :</p>
      <p style="margin:0;font-size:12px;line-height:1.4;word-break:break-all;"><a href="{url}" style="color:#d0152b;">{url}</a></p>
      <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e7e0df;font-size:13px;line-height:1.5;color:#736a6b;">{footer}</p>
    </td></tr>

    <tr><td align="center" style="padding:20px 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9a9091;">
      ASOA Antibes · Course à pied · Trail · Triathlon
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""

P = 'style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3b3435;"'
HELLO = "Salut{{ if .Data.first_name }} {{ .Data.first_name }}{{ end }},"

TEMPLATES = {
    "confirmation": dict(
        subject="Bienvenue à l'ASOA : confirme ton adresse",
        title="Confirme ton adresse", preheader="Un clic pour activer ton compte et rejoindre le club dans l'app.",
        kicker="Bienvenue au club", heading="Plus qu'un clic avant le départ",
        body=f"""<p {P}>{HELLO}</p>
      <p {P}>Ton compte sur l'app de l'ASOA est presque prêt. Confirme ton adresse e-mail pour retrouver :</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
        <tr><td style="padding:4px 10px 4px 0;font-size:16px;color:#d0152b;font-weight:bold;">›</td><td style="padding:4px 0;font-size:15px;color:#3b3435;">les séances de la semaine, et dire si tu viens</td></tr>
        <tr><td style="padding:4px 10px 4px 0;font-size:16px;color:#d0152b;font-weight:bold;">›</td><td style="padding:4px 0;font-size:15px;color:#3b3435;">les courses du club et les résultats de tout le monde</td></tr>
        <tr><td style="padding:4px 10px 4px 0;font-size:16px;color:#d0152b;font-weight:bold;">›</td><td style="padding:4px 0;font-size:15px;color:#3b3435;">tes records, tes badges et le challenge kilométrique</td></tr>
      </table>""",
        button="Confirmer mon adresse", url="{{ .ConfirmationURL }}",
        footer="Tu n'as pas créé de compte ? Ignore simplement cet e-mail, rien ne sera activé.",
    ),
    "invite": dict(
        subject="Tu es invité(e) sur l'app de l'ASOA",
        title="Invitation", preheader="Le club t'a ouvert un compte : choisis ton mot de passe.",
        kicker="Invitation", heading="Le club t'attend dans l'app",
        body=f"""<p {P}>Salut,</p>
      <p {P}>Un coach de l'ASOA t'a créé un compte sur l'app du club. Séances, présences, résultats, challenge : tout est au même endroit.</p>
      <p {P}>Clique sur le bouton pour activer ton compte et choisir ton mot de passe.</p>""",
        button="Rejoindre l'app", url="{{ .ConfirmationURL }}",
        footer="Tu ne fais pas partie de l'ASOA ? Ignore cet e-mail.",
    ),
    "reset-password": dict(
        subject="ASOA : réinitialise ton mot de passe",
        title="Nouveau mot de passe", preheader="Le lien est valable une heure.",
        kicker="Mot de passe oublié", heading="On repart sur de bonnes bases",
        body=f"""<p {P}>Salut,</p>
      <p {P}>Tu as demandé à réinitialiser ton mot de passe pour <strong>{{{{ .Email }}}}</strong>. Clique sur le bouton pour en choisir un nouveau. Le lien est valable une heure.</p>""",
        button="Choisir un nouveau mot de passe", url="{{ .ConfirmationURL }}",
        footer="Ce n'est pas toi ? Ignore cet e-mail : ton mot de passe actuel reste valable.",
    ),
    "change-email": dict(
        subject="ASOA : confirme ta nouvelle adresse",
        title="Nouvelle adresse", preheader="Confirme le changement d'adresse de ton compte.",
        kicker="Changement d'adresse", heading="Confirme ta nouvelle adresse",
        body=f"""<p {P}>Salut,</p>
      <p {P}>Tu as demandé à remplacer <strong>{{{{ .Email }}}}</strong> par <strong>{{{{ .NewEmail }}}}</strong> pour te connecter à l'app de l'ASOA.</p>""",
        button="Confirmer le changement", url="{{ .ConfirmationURL }}",
        footer="Tu n'as rien demandé ? Ignore cet e-mail : ton adresse ne changera pas.",
    ),
}

for name, t in TEMPLATES.items():
    html = BASE
    for k in ("title", "preheader", "kicker", "heading", "body", "button", "url", "footer"):
        html = html.replace("{" + k + "}", t[k])
    open(f"{name}.html", "w").write(html)
    print(f"{name}.html  —  Sujet : {t['subject']}")
