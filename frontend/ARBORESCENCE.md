# Arborescence du projet AvricolTrack

Projet mobile et web Expo Router.

```text
AvricolTrack/
├── app/                              # Ecrans et routes Expo Router
│   ├── _layout.tsx                   # Layout racine
│   ├── index.tsx                     # Route d'accueil
│   ├── modal.tsx                     # Ecran modal
│   ├── (auth)/                       # Routes d'authentification
│   │   ├── _layout.tsx
│   │   ├── forgot-password.tsx
│   │   ├── login.tsx
│   │   ├── onboarding.tsx
│   │   └── register.tsx
│   ├── (tabs)/                       # Navigation principale par onglets
│   │   ├── _layout.tsx
│   │   ├── index.tsx                 # Tableau de bord
│   │   ├── alertes.tsx
│   │   ├── explore.tsx
│   │   ├── menu.tsx
│   │   ├── rapports.tsx
│   │   └── saisie.tsx
│   ├── assets/images/                # Images utilisees par l'application
│   │   ├── android-icon-background.png
│   │   ├── android-icon-foreground.png
│   │   ├── android-icon-monochrome.png
│   │   ├── favicon.png
│   │   ├── icon.png
│   │   ├── partial-react-logo.png
│   │   ├── react-logo.png
│   │   ├── react-logo@2x.png
│   │   ├── react-logo@3x.png
│   │   └── splash-icon.png
│   ├── bandes/
│   │   ├── index.tsx                 # Liste des bandes
│   │   └── [id].tsx                  # Detail d'une bande
│   ├── parametres/index.tsx
│   ├── personnel/index.tsx
│   ├── stocks/
│   │   ├── index.tsx
│   │   └── mouvement.tsx
│   └── sync/
│       ├── index.tsx
│       └── conflit.tsx
├── components/                       # Composants reutilisables
│   ├── external-link.tsx
│   ├── haptic-tab.tsx
│   ├── hello-wave.tsx
│   ├── parallax-scroll-view.tsx
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ui/
│       ├── BottomNav.tsx
│       ├── Card.tsx
│       ├── collapsible.tsx
│       ├── FormField.tsx
│       ├── icon-symbol.ios.tsx
│       ├── icon-symbol.tsx
│       ├── PrimaryButton.tsx
│       ├── ScreenShell.tsx
│       ├── SelectField.tsx
│       ├── StatCard.tsx
│       ├── SubScreenHeader.tsx
│       └── TopBar.tsx
├── constants/                        # Theme et design system
│   ├── design-system.ts
│   └── theme.ts
├── hooks/                            # Hooks React personnalises
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
├── scripts/
│   └── reset-project.js
├── app.json                          # Configuration Expo
├── expo-env.d.ts                     # Types d'environnement Expo
├── tsconfig.json                     # Configuration TypeScript
├── eslint.config.js                  # Configuration ESLint
├── package.json                      # Scripts et dependances
├── package-lock.json
├── README.md                         # Documentation generale
├── GUIDE_DEVELOPPEUR.md              # Guide de developpement
├── AGENTS.md                         # Instructions pour les agents
└── CLAUDE.md                         # Instructions complementaires
```

## Organisation rapide

- `app/` contient les ecrans et les routes basees sur les fichiers.
- `components/` contient les composants d'interface reutilisables.
- `constants/` contient les couleurs, polices et regles visuelles.
- `hooks/` contient les hooks React partages.
- `app/assets/images/` contient les images locales du projet.

Les dossiers `node_modules/`, `.expo/` et `dist/` sont generes localement et ne sont pas detailles ici.
