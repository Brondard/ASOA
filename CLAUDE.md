# ASOA Antibes — app du club (contexte projet)

App du club de course à pied / trail / triathlon ASOA Antibes (~100 à 200 adhérents).
Remplace un fonctionnement actuel par Facebook + un vieux site. Interlocuteur : un adhérent
qui développe l'app pour le club, pas un développeur pro à plein temps — **répondre en français**,
expliquer les choix, et privilégier ce qui se maintient facilement.

## Stack

- **React 18 + Vite 7**, JavaScript (pas de TypeScript), pas de framework CSS : un seul `src/styles.css`.
- **Supabase** : auth e-mail/mot de passe, Postgres avec RLS, Storage pour les photos de profil, Edge Function Deno pour les notifications push.
- **PWA** (vite-plugin-pwa, `injectManifest`, service worker maison `src/sw.js`) : installable, notifications push Web Push/VAPID.
- Déploiement visé : Vercel ou Netlify (`npm run build` → `dist`).

## Commandes

```bash
npm run dev          # mode démo si pas de .env
npm run build        # build PWA -> dist/
npm run build:demo   # build d'un seul fichier HTML -> dist-demo/ (démo hors ligne, assets inlinés)
```

## Architecture

```
src/
  main.jsx, App.jsx      Routage par hash : #/seances #/courses/<id> #/challenge #/membres/<id> #/profil
                         #/coachs (coachs seulement) #/confidentialite (accessible même déconnecté)
  store.jsx              Contexte unique : charge TOUT au démarrage, expose { me, profiles, sessions,
                         races, results, attendance, registrations, isAdmin, run, setAttendance,
                         setRegistration, notify, reload }
  api/index.js           Choisit demoApi ou supabaseApi selon la présence des variables .env
  api/supabaseApi.js     Vraie base. Toutes les requêtes passent par ici, jamais depuis un écran.
  api/demoApi.js         Même interface, en mémoire (mode démo)
  api/demoData.js        Jeu de données fictif (noms inventés)
  screens/               Sessions, Races, Challenge, Members, Coaches (rôles + validation des inscrits),
                         Privacy (page RGPD, export, suppression de compte, écran « en attente »), Login
  lib/                   format (dates/temps), challenge, events (épreuves/formats), records, badges, vma, push
  ui.jsx                 Icônes SVG inline, Avatar, Sheet, Field, PageHead, Logo, ConfirmDelete
  assets/                logo.png (bandeau détouré) + logo-square.jpg
supabase/
  schema.sql             Installation complète (idempotent)
  upgrade-v2/v3/v4.sql   Migrations successives, à lancer dans l'ordre sur une base existante
  cron-rappels.sql       pg_cron + pg_net -> appelle la fonction notify tous les jours
  functions/notify/      Edge Function d'envoi des notifications push
  emails/                Modèles d'e-mails Supabase, générés par build.py
```

### Conventions
- **Deux API interchangeables** : toute nouvelle méthode ajoutée à `supabaseApi` doit l'être aussi à `demoApi`, sinon le mode démo casse.
- `run(fn, message)` du store = exécute, recharge les données, affiche un toast d'erreur ou de succès.
- `setAttendance` / `setRegistration` sont optimistes (état local d'abord, puis écriture).
- Pas de `window.confirm` (bloqué dans certains contextes) : `<ConfirmDelete>` en deux temps.
- Les libellés sont en français dans le code, les noms de variables en anglais.
- Commentaires en français, utiles seulement quand le « pourquoi » n'est pas évident.

## Modèle de données

| Table | Rôle |
|---|---|
| `profiles` | 1 par compte : prénom, nom, photo, ville, disciplines[], `is_admin`, `vma`, `approved` (validé par un coach) |
| `sessions` | séances : date/heure, discipline, titre, description, lieu (+lat/lng), `min_participants`, `cancelled`, `cancel_reason` |
| `session_attendance` | (session, membre) → `yes` / `maybe` / `no` |
| `races` | courses ET épreuves : `parent_id` non nul = c'est un **format** d'une épreuve. Une épreuve porte les infos communes, ses formats portent `format` + `distance_km` |
| `race_registrations` | (course, membre) → `going` / `interested`. Toujours sur un **format**, jamais sur l'épreuve |
| `results` | (course, membre) : `time_seconds` (null = abandon), `rank_overall`, `finishers`, `podium` 1-3 |
| `push_subscriptions` | 1 par appareil abonné aux notifications |

**RLS** : lecture réservée aux comptes validés (`is_member()` = `approved` ou coach) ; un compte en attente
ne voit que son propre profil. Écriture séances/courses/résultats réservée aux `is_admin` ;
chacun gère son profil, ses présences, ses inscriptions et ses abonnements push.
Un trigger empêche un adhérent de changer `is_admin` ou `approved` depuis l'app (mais pas depuis le dashboard Supabase).

**Validation des inscrits** : nouveau compte = `approved = false` → écran « en attente », aucune donnée chargée.
Côté client, `store.profiles` ne contient que les membres validés, `store.pending` les comptes à valider
(affichés seulement dans l'onglet Coachs, avec une pastille). Refuser = supprimer le compte (RPC `refuse_member`).

**Suppression de compte** : RPC `delete_my_account` (supprime `auth.users`, tout le reste suit en cascade) ;
la photo est retirée du Storage par l'app juste avant. Refusé pour le dernier coach.

**Rôles** : seulement deux, adhérent et coach (`is_admin`). Pas de distinction coach/admin, c'est voulu.
Un coach nomme ou retire les autres coachs depuis l'onglet **Coachs** (`#/coachs`, visible des seuls coachs, `api.setCoach`).
Il ne peut pas se retirer lui-même, ce qui garantit qu'il reste toujours au moins un coach.
Le tout premier coach se nomme en SQL : `update profiles set is_admin = true where id = (select id from auth.users where email = '…')`.

## Règles métier

- **Challenge** : somme des km des courses **terminées** de la saison (1er sept → 31 août). Abandons exclus.
  Égalité départagée par les podiums puis le nombre de courses. Filtrable par discipline. Triathlon = distance totale nage+vélo+course.
  Bonus podium possible via `CHALLENGE.podiumBonusKm` dans `src/config.js` (à 0 aujourd'hui).
- **Records perso** : meilleur temps sur 5/10/21,1/42,2 km, uniquement discipline `running` (fourchettes dans `lib/records.js`).
  Un résultat qui bat un record précédent affiche « RP ».
- **Badges** : 16 badges calculés à la volée dans `lib/badges.js` (aucune donnée stockée).
- **VMA** : saisie par l'adhérent ou par un coach ; allures dérivées à 100/95/90/75 % (`lib/vma.js`).
- **Saisie groupée des temps** : dès le jour de la course, le coach voit les inscrits sans résultat et saisit tout d'un coup.
  « Pas couru » sur un inscrit « J'y vais » supprime son inscription.
- **Notifications** : types `session_new`, `session_updated`, `session_cancelled`, `race_new`, `results`, `test`,
  plus `daily` déclenché par pg_cron (rappel veille de séance, alerte minimum non atteint, rappel J-7 avant une course).

## État de l'infrastructure (au 24 septembre 2026)

- Base Supabase en place (région Paris, eu-west-3) ; migrations v2 et v3 passées, **v4 (VMA) et v5 (validation + RGPD) à lancer**
  si ce n'est pas déjà fait. `isMember()` du store laisse passer tout le monde tant que la colonne `approved` n'existe pas.
- **E-mails désactivés.** Un essai avec Brevo a échoué et le SMTP a été désactivé. Dans Supabase,
  « Confirm email » est décoché pour que les inscriptions marchent sans e-mail.
  Blocage : le club a bien le domaine `asoa-antibes.fr` (site IONOS MyWebsite), mais les accès DNS et
  une boîte mail sur ce domaine manquent. Il faut les demander au bureau. Tant qu'il n'y a pas d'e-mail :
  pas de « mot de passe oublié », et n'importe qui peut créer un compte.
- **Notifications push pas encore déployées** (Edge Function `notify` + clés VAPID + cron à faire).
- Pas encore mis en ligne ni présenté aux gérants du club au moment d'écrire ces lignes.

## Pièges connus

- Supabase renvoie **1000 lignes max** par requête : passer par le helper `fetchAll` de `supabaseApi.js` pour toute table qui grossit.
- `saveRace` / `saveSession` font un **upsert** : pour une modification partielle, utiliser `updateSession` (sinon les colonnes NOT NULL manquantes font échouer l'insert).
- Le client Supabase est créé **paresseusement** (`sb()`), sinon le build démo plante faute de variables d'environnement.
- Le champ temps utilise `maskTime` : l'utilisateur tape des chiffres, les « : » se placent tout seuls (clavier numérique sur mobile).
- Les modèles d'e-mails sont **générés** : modifier `supabase/emails/build.py`, pas les `.html`.
- iOS : les notifications ne marchent que si l'app est ajoutée à l'écran d'accueil (l'app le dit d'elle-même).

## Pistes discutées, pas encore faites

Fil d'actualité du club, covoiturage vers les courses, ajout au calendrier, page publique de présentation
pour recruter, photos par course, intégration Strava, km-effort en trail (distance + D+/100),
adhérents sans compte saisis par le coach, séances récurrentes, résultats proposés par l'adhérent,
suppression par un coach d'un adhérent qui a quitté le club.
Écartés (réponse de l'utilisateur, 24/09/2026) : fil d'actu et photos (le club utilise Instagram),
gestion des adhésions, appel aux séances (le « je viens » sert d'ordre d'idée).

## Style de travail attendu

Vérifier le résultat avant de livrer (build + parcours testé), signaler ce qui n'a pas pu être testé,
expliquer les choix faits à la place de l'utilisateur, et rester sur des solutions simples : ce projet
sera maintenu par une seule personne bénévole.
