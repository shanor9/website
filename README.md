# Site Portfolio Shanor

Site portfolio minimaliste en theme sombre, avec interactions inspirees des jeux (style Teeworlds), fond etoile anime, effet de tir de grenade, et serpent autonome qui reagit a la souris.

## Etat Du Projet

Ce qui est implemente et fonctionnel:

- Layout one-page sombre et moderne
- Blocs de texte centres (Hero / Discord / Projects)
- Fond etoile anime + etoiles filantes
- Tee flottant + lance-grenade cliquable
- Projectile de grenade avec trajectoire courbe depuis le canon
- Carte profil Discord avec avatar perso + bouton d'invitation
- Liste de projets avec boutons animes
- Mouvement irregulier des panneaux au survol (effet "nuage")
- Serpent en corps continu (pas en petits ronds)
- Serpent fuyant quand la souris s'approche
- Support `prefers-reduced-motion`
- Favicon + meta social preview (`og:` + Twitter cards)
- Outillage lint/format configure (ESLint + Prettier)
- Build automatique de `js/app.direct.js` depuis les modules source
- Smoke test e2e Playwright sur les interactions principales
- Fonctionne dans les deux cas:
  - en `file://` (ouverture directe)
  - en `http(s)://` (mode module)

## Contenu Actuel

- Pseudo: `Shanor`
- Bio: `Leader of Clan Ombre, there are projects in progress.`
- Bloc Discord:
  - Nom: `shanor`
  - Handle: `@shanor.`
  - Bouton serveur: `Join ZCatch Community` -> `https://discord.gg/7YV9u5r5BZ`
- Projets affiches:
  - Ranked ZCatch
  - AI that plays DDNet
  - Hitworld

## Direction Visuelle

- Ambiance: sombre, sobre, accents chauds
- Typo: `Space Grotesk`
- Couleurs centralisees dans `css/tokens.css`
- Scene en couches:
  - ciel/fond (`.sky`)
  - canvas serpent (`#snake-layer`)
  - contenu principal (`.layout`)
  - couche FX grenade (`#fx-layer`)

## Architecture (Separation Clean)

JavaScript est separe par responsabilite:

- `application/`: logique applicative/domaine
  - simulation du serpent
  - physique de la grenade
- `presentation/`: rendu et controleurs UI navigateur
  - dessin canvas
  - gestion des evenements DOM
  - rendu des projectiles
- `infrastructure/`: utilitaires plateforme
  - detection reduced motion
- `app.js`: bootstrap/composition en mode module
- `app.direct.js`: fallback autonome pour ouverture directe `file://`

CSS est modulaire:

- `tokens`, `base`, `layout`, `background`, `animations`, `responsive`, `accessibility`
- composants dans `css/components/*`

## Structure Du Depot

```text
.
├── index.html
├── styles.css
├── assets/
│   ├── discord-avatar.png
│   ├── favicon.svg
│   ├── grenade.png
│   ├── lancegrenade_sober.svg
│   ├── og-image.png
│   └── tee_sober.svg
├── css/
│   ├── accessibility.css
│   ├── animations.css
│   ├── background.css
│   ├── base.css
│   ├── layout.css
│   ├── responsive.css
│   ├── tokens.css
│   └── components/
│       ├── actions.css
│       ├── discord.css
│       ├── hero.css
│       └── projects.css
└── js/
    ├── app.js
    ├── app.direct.js
    ├── infrastructure/browser/motion.js
    ├── application/
    │   ├── grenade/GrenadeArc.js
    │   └── snake/SnakeSimulation.js
    └── presentation/
        ├── hero/GrenadeLauncherController.js
        └── snake/SnakeCanvasController.js
```

## Details Des Interactions

### 1) Fond Etoile

- Plusieurs couches d'etoiles avec opacites et rythmes differents
- Etoiles filantes declenchees en boucle avec delais decales
- 100% CSS (pas besoin de JS)

### 2) Mouvement Des Panneaux

- Chaque panneau a son animation irreguliere au hover
- Animation active uniquement au survol (desktop)
- Keyframes differents pour eviter un rendu trop uniforme

### 3) Tee + Lance-Grenade

- Tee charge depuis `assets/tee_sober.svg`
- Arme chargee depuis `assets/lancegrenade_sober.svg`
- Au clic sur l'arme:
  - creation d'une grenade image (`assets/grenade.png`)
  - animation de recul de l'arme
  - simulation de trajectoire (vx, vy, gravite, duree de vie)
  - suppression quand hors ecran ou expiree

### 4) Serpent

Simulation:

- Chaine de segments suivant la tete avec contrainte d'espacement
- Drift aleatoire + mecanisme anti-boucle pour un mouvement naturel
- Recentrage proche des bords de la fenetre
- Fuite de la souris:
  - si la souris est active et proche de la tete, le serpent tourne a l'oppose
  - vitesse augmentee en fonction de la proximite

Rendu:

- Corps unique continu lisse (courbes quadratiques)
- Contour sombre + coeur clair
- Tete circulaire + yeux orientes selon l'angle

## Accessibilite Et Responsive

- `prefers-reduced-motion: reduce` desactive animations/transitions
- Sur appareils non-hover, les effets de survol texte sont neutralises
- Ajustements mobile:
  - paddings de panneaux reduits
  - etoiles filantes plus courtes

## Modes D'Execution

`index.html` choisit automatiquement le runtime JS:

- Si protocole `file:` -> charge `js/app.direct.js`
- Sinon -> charge `js/app.js` en module

Ce comportement a ete ajoute pour garantir le fonctionnement en ouverture directe.

## Lancer Le Projet

### Option A: ouverture directe

Ouvrir `index.html` directement dans le navigateur.

### Option B: serveur local (recommande)

```bash
cd /home/shanor/Bureau/shanorpro
python3 -m http.server 8080
```

Puis ouvrir:

`http://localhost:8080`

## Personnalisation Rapide

### Textes et liens

Modifier `index.html`:

- titre/bio du hero
- nom/handle/statut Discord
- lien d'invitation Discord
- descriptions et liens des projets

### Avatar

Remplacer:

- `assets/discord-avatar.png`

Le rendu actuel affiche l'image complete dans un cercle avec:

- `object-fit: contain`
- position centree

### Visuels Tee / Arme / Grenade

Remplacer ces fichiers (en gardant les memes noms):

- `assets/tee_sober.svg`
- `assets/lancegrenade_sober.svg`
- `assets/grenade.png`

### Couleurs

Modifier les variables de theme dans:

- `css/tokens.css`

## Qualite Du Code

Etat actuel:

- Pas de logs de debug / TODO dans les sources
- Verifications syntaxe JS ok avec `node --check`
- Separation des responsabilites par dossiers respectee

Tradeoff connu:

- `js/app.direct.js` duplique la logique module pour supporter `file://`.
- C'est volontaire pour la portabilite, mais il faut maintenir les deux chemins synchronises.

## Outillage Dev Ajoute

Scripts npm disponibles:

- `npm run build:direct` : genere `js/app.direct.js` depuis `js/app.js` avec esbuild
- `npm run lint` : lint JS avec ESLint (config flat)
- `npm run lint:fix` : corrige automatiquement ce qui peut l'etre
- `npm run format` : formate le projet avec Prettier
- `npm run format:check` : verification du format sans ecriture
- `npm run serve` : lance un serveur local simple
- `npm run test:e2e` : lance les smoke tests Playwright

Fichiers de config:

- `package.json`
- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `playwright.config.mjs`
- `tests/smoke.spec.mjs`
- `scripts/build-direct.mjs`

## Git / Depot

Le projet est initialise avec Git.

- Branche par defaut: `main`
- Remote: `git@github.com:shanor9/website.git`

## Licence

Ce projet est sous `Ombre License v1.0`.
Voir le fichier `LICENSE`.

## Prochaines Ameliorations (Optionnel)

- Remplacer les liens projets placeholders par les vrais repos/demos
- Ajouter snapshots visuels Playwright pour detecter les regressions UI
- Ajouter CI GitHub Actions pour `lint + format:check + test:e2e`
