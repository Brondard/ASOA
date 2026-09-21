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

## 3. Mettre en ligne (gratuit)

1. Pousse le dossier sur GitHub (le `.env` est ignoré, c'est voulu).
2. Sur **Vercel** ou **Netlify** : *Import project* depuis GitHub. Build : `npm run build`, dossier : `dist`.
3. Ajoute les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les réglages du projet.
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

## Règle du challenge

Chaque course **terminée** rapporte sa distance en km (triathlon = nage + vélo + course, à saisir dans « Distance »).
Les abandons (DNF) ne comptent pas. Égalité : le nombre de podiums départage, puis le nombre de courses.

## Structure

```
supabase/schema.sql      tables, sécurité, stockage des photos
src/config.js            réglages du club
src/api/                 supabaseApi (vraie base) / demoApi (données fictives)
src/screens/             Séances, Résultats, Challenge, Trombi, Profil, Connexion
src/lib/                 formats de temps/dates, calcul du challenge
```
