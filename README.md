# ASOA Antibes — application du club

Web app installable (PWA) : séances à venir, résultats de courses, challenge kilométrique, trombinoscope.
Deux rôles : **adhérent** (consulte) et **coach** (crée les séances, les courses et saisit les résultats).

Stack : React + Vite, Supabase (comptes, base de données, photos).

---

## 1. Essayer en local (mode démo)

```bash
npm install
npm run dev
```

Sans fichier `.env`, l'app tourne en **mode démo** avec des données fictives (boutons « Démo adhérent » / « Démo coach »).

## 2. Brancher Supabase

1. Supabase → ton projet → **SQL Editor** → New query → colle le contenu de `supabase/schema.sql` → **Run**.
2. **Authentication → URL Configuration** : mets l'adresse de ton site (ex. `https://asoa.vercel.app`) dans *Site URL*.
3. **Project Settings → API** : copie `Project URL` et la clé `anon public`.
4. Copie `.env.example` en `.env` et colle ces deux valeurs.
5. `npm run dev` → crée ton compte depuis l'écran de connexion.
6. Donne-toi les droits coach (SQL Editor) :

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'ton@email.fr');
```

Même commande pour chaque coach. Pour retirer les droits : `is_admin = false`.

> La clé `anon` peut être publique : la sécurité est assurée par les règles RLS du fichier SQL
> (lecture réservée aux membres connectés, écriture des séances/courses/résultats réservée aux coachs).

## 2 bis. Passer à la v2 (si tu avais déjà installé la v1)

Dans **SQL Editor**, lance `supabase/upgrade-v2.sql` (présences, inscriptions aux courses, abonnements aux notifications).
Tes données existantes ne sont pas touchées. Pour une installation neuve, `schema.sql` contient déjà tout.

## 2 ter. Notifications push

Trois morceaux : des clés de chiffrement, la fonction qui envoie, et le rappel quotidien.

**a. Générer les clés VAPID** (une seule fois, sur ton ordinateur) :

```bash
npx web-push generate-vapid-keys
```

Garde les deux clés. La **publique** va dans `.env` (et dans Vercel/Netlify) :

```
VITE_VAPID_PUBLIC_KEY=BExxxx...
```

**b. Déployer la fonction `notify`** :

```bash
npx supabase login
npx supabase link --project-ref <ID-DU-PROJET>
npx supabase functions deploy notify
npx supabase secrets set VAPID_PUBLIC_KEY=BExxxx... VAPID_PRIVATE_KEY=xxxx... \
  VAPID_SUBJECT=mailto:ton@email.fr CRON_SECRET=<un-mot-de-passe-au-hasard> APP_URL=https://ton-site.vercel.app
```

(L'ID du projet est dans l'URL du tableau de bord : `supabase.com/dashboard/project/<ID>`.)

**c. Rappels automatiques** : Database → Extensions → active `pg_cron` et `pg_net`,
puis ouvre `supabase/cron-rappels.sql`, remplace les 3 valeurs entre chevrons et lance-le.
Tous les jours à 18h : rappel aux inscrits des séances du lendemain, alerte aux coachs si le minimum n'est pas atteint,
rappel J-7 aux inscrits d'une course.

**Tester** : dans l'app, Profil → Notifications → Activer, puis « Tester ».

| Événement | Qui reçoit |
|---|---|
| Nouvelle séance publiée (case cochée) | Tout le monde sauf le coach |
| Séance modifiée (case cochée) | Inscrits « Je viens » / « Peut-être » |
| Séance annulée | Inscrits « Je viens » / « Peut-être » |
| Veille de séance, 18h | Inscrits « Je viens » |
| Minimum non atteint, veille 18h | Coachs |
| Nouvelle course à venir (case cochée) | Tout le monde |
| J-7 avant une course | Inscrits « J'y vais » |
| Bouton « Prévenir le club : résultats en ligne » | Tout le monde |

> **iPhone** : les notifications ne marchent que si l'app a été **ajoutée à l'écran d'accueil** (iOS 16.4 ou plus).
> L'app l'explique d'elle-même aux adhérents concernés.

## 2 quater. E-mails aux couleurs du club

**⚠️ À faire avant d'ouvrir l'app aux adhérents :** le service d'e-mail fourni par Supabase n'envoie qu'aux membres
de ton équipe Supabase, 2 e-mails par heure maximum. Et sur un projet gratuit créé après le 3 juin 2026,
les modèles ne sont modifiables qu'avec ton propre service d'envoi. Pour 100 à 200 adhérents, branche ton propre service d'envoi :
Authentication → **Emails → SMTP Settings**. [Brevo](https://www.brevo.com) (français, 300 e-mails/jour gratuits) ou
[Resend](https://resend.com) conviennent très bien. Mets « ASOA Antibes » comme nom d'expéditeur.

Puis, Authentication → **Emails → Templates**, pour chaque modèle : colle le sujet et le contenu du fichier correspondant.

| Modèle Supabase | Fichier | Sujet |
|---|---|---|
| Confirm signup | `supabase/emails/confirmation.html` | Bienvenue à l'ASOA : confirme ton adresse |
| Invite user | `supabase/emails/invite.html` | Tu es invité(e) sur l'app de l'ASOA |
| Reset password | `supabase/emails/reset-password.html` | ASOA : réinitialise ton mot de passe |
| Change email address | `supabase/emails/change-email.html` | ASOA : confirme ta nouvelle adresse |

Pour modifier les textes : édite `supabase/emails/build.py` puis `python3 supabase/emails/build.py`.

**Inviter des adhérents** (plutôt que d'attendre qu'ils s'inscrivent) : Authentication → Users → *Invite user*.
Ils reçoivent l'e-mail d'invitation, cliquent, et l'app leur demande de choisir un mot de passe.

## 3. Mettre en ligne (gratuit)

1. Pousse le dossier sur GitHub (le `.env` est ignoré, c'est voulu).
2. Sur **Vercel** ou **Netlify** : *Import project* depuis GitHub. Build : `npm run build`, dossier : `dist`.
3. Ajoute les variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_VAPID_PUBLIC_KEY` dans les réglages du projet.
4. Chaque `git push` redéploie automatiquement.

Les adhérents ouvrent le lien puis **« Ajouter à l'écran d'accueil »** (Safari : bouton Partager ; Chrome Android : menu ⋮).
L'app s'ouvre alors en plein écran comme une app native.

## 4. Play Store / App Store (optionnel)

- **Play Store** : [PWABuilder](https://www.pwabuilder.com) → colle l'URL du site → *Package for Android* → tu obtiens un `.aab` à déposer sur la Play Console (compte développeur : 25 $ une fois).
- **App Store** : PWABuilder génère aussi un projet iOS, mais il faut un Mac avec Xcode et un compte Apple Developer (99 $/an). Apple refuse parfois les apps qui ne sont « qu'un site web » : la PWA installée depuis Safari reste la voie la plus simple pour iPhone.

## Réglages courants

Tout est dans `src/config.js` :

| Réglage | Effet |
|---|---|
| `CHALLENGE.podiumBonusKm` | Bonus en km par podium catégorie (ex. `{1: 10, 2: 6, 3: 3}`). À 0, les podiums ne servent qu'à départager. |
| `CHALLENGE.seasonStartMonth` | Mois de début de saison (8 = septembre). |
| `USUAL_PLACES` | Lieux proposés quand on crée une séance. |
| `DISCIPLINES` | Libellés des disciplines. |

Couleurs et polices : variables en haut de `src/styles.css`.

## Saisie des temps après une course

Dès le jour de la course, le coach voit sur la page de la course un encadré « X inscrits sans résultat ».
Le bouton **« Saisir les temps des inscrits »** ouvre une ligne par inscrit (« J'y vais » cochés Classé, « Intéressé » cochés Pas couru) :
on tape les temps, on marque les abandons, et tout s'enregistre d'un coup. « Pas couru » retire l'inscription.

## Records perso et badges

Calculés automatiquement à partir des résultats, sans saisie en plus.

- **Records perso** : meilleur temps sur 5 km, 10 km, semi et marathon (courses « Course à pied » dont la distance tombe dans la bonne fourchette). Un temps qui bat un record précédent affiche **RP** dans le tableau de la course.
- **Badges** : liste dans `src/lib/badges.js`. Pour en ajouter un, copie une ligne et change le calcul.

## Règle du challenge

Chaque course **terminée** rapporte sa distance en km (triathlon = nage + vélo + course, à saisir dans « Distance »).
Les abandons (DNF) ne comptent pas. Égalité : le nombre de podiums départage, puis le nombre de courses.

## Structure

```
supabase/schema.sql      tables, sécurité, stockage des photos (installation complète)
supabase/upgrade-v2.sql  mise à jour v1 -> v2
supabase/cron-rappels.sql rappels quotidiens
supabase/functions/notify/ envoi des notifications push
supabase/emails/          modèles d'e-mails (confirmation, invitation, mot de passe…)
src/sw.js                service worker (hors ligne + réception des notifications)
src/config.js            réglages du club
src/api/                 supabaseApi (vraie base) / demoApi (données fictives)
src/screens/             Séances, Résultats, Challenge, Trombi, Profil, Connexion
src/lib/                 temps/dates, challenge, records, badges, notifications
```
