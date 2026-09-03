# Guide développeur — AvicoleTrack

Ce guide est fait pour te permettre de modifier le projet sans avoir à tout
relire ni tout redemander. Il explique où se trouve chaque chose, comment le
projet est organisé, et comment faire les modifications les plus courantes
étape par étape.

Le projet est un prototype **React Native / Expo**, avec des données
**mock (fausses données en mémoire)** — il n'y a pas de vrai serveur pour
l'instant. Tout est pensé pour qu'on puisse brancher un vrai backend plus
tard sans tout réécrire.

---

## 1. Démarrer le projet

```bash
npm install
npx expo start
```

Puis scanne le QR code avec l'app **Expo Go** sur ton téléphone (SDK 54), ou
tape `w` dans le terminal pour l'ouvrir dans un navigateur.

Comptes de test (le mot de passe n'est pas vérifié, mets n'importe quoi) :

- `paul@avicoletrack.cm` → profil aviculteur
- `chef@avicoletrack.cm` → profil chef d'entreprise (accès à plusieurs fermes)

---

## 2. Comment le projet est organisé

```
App.js                        → point d'entrée, charge la police puis lance l'app
src/
  theme/theme.js               → TOUTES les couleurs, tailles de texte, espacements
  data/mockData.js             → TOUTES les fausses données (fermes, bandes, rapports...)
  context/RapportsContext.js   → l'état global de l'app (partagé entre tous les écrans)
  components/UI.js             → les briques réutilisables (Card, Badge, champs...)
  screens/                     → un fichier par écran
  navigation/AppNavigator.js   → qui peut naviguer vers quel écran
```

**Règle d'or : si tu veux changer une couleur, une donnée ou un composant
partagé, tu ne le fais QU'À UN SEUL ENDROIT** (`theme.js`, `mockData.js` ou
`UI.js`), jamais directement dans chaque écran. Sinon il faudra changer 15
fichiers à chaque fois.

---

## 3. Le système de design (`theme.js`)

Tout le style de l'app vient de ce fichier. Exemple :

```js
export const colors = {
  primary: '#2E7D32',   // le vert principal (boutons, titres importants)
  secondary: '#795548',  // le brun (boutons secondaires)
  danger: '#BA1A1A',     // rouge (erreurs, alertes critiques)
  // ...
};
```

**Pour changer la couleur principale de toute l'app**, il suffit de changer
`colors.primary` dans ce fichier — tous les écrans qui utilisent
`colors.primary` (boutons, icônes, liens...) changeront automatiquement.

Ne jamais écrire une couleur "en dur" dans un écran (`'#2E7D32'`) — utiliser
`colors.primary` à la place, sinon le fichier `theme.js` ne sert plus à rien.

Il y a aussi `spacing(n)` pour les espacements (marges/paddings) et `radius`
pour les coins arrondis. But : garder un style cohérent partout.

---

## 4. Les données mock (`mockData.js`)

C'est ici que vivent toutes les fausses données. Exemple, une bande de
volailles :

```js
export const bandesInitiales = [
  {
    id: 'b1',
    fermeId: 'f1',
    nom: 'Bande A - Pondeuses',
    race: 'Lohmann Brown',
    batiment: 'Bâtiment 2',
    dateDebut: '2025-01-12',
    effectifInitial: 5000,
    statut: 'actif',
  },
  // ...
];
```

**Pour ajouter une nouvelle bande, une nouvelle ferme, un nouveau rapport,
etc., il suffit d'ajouter un objet dans le tableau correspondant.** Pas
besoin de toucher aux écrans, ils lisent tous ces données automatiquement.

Ce fichier contient aussi les fonctions de calcul (taux de ponte, détection
d'anomalies...) — si tu dois changer une formule ou un seuil d'alerte,
c'est ici et nulle part ailleurs.

---

## 5. L'état global (`RapportsContext.js`)

C'est la "mémoire" de l'application pendant qu'elle tourne (qui est
connecté, quels rapports ont été ajoutés, etc.). N'importe quel écran peut y
accéder avec :

```js
import { useRapports } from '../context/RapportsContext';

function MonEcran() {
  const { fermeCourante, bandesDeLaFerme, ajouterRapport } = useRapports();
  // ...
}
```

Les fonctions disponibles sont listées dans le fichier — si tu as besoin
d'une nouvelle fonction (ex: `supprimerBande`), c'est le seul fichier à
modifier pour que tous les écrans puissent l'utiliser.

⚠️ Ces données sont en mémoire : si on recharge l'app, tout revient à l'état
initial. C'est normal pour un prototype sans backend.

---

## 6. Les composants réutilisables (`UI.js`)

Avant de recréer un bouton, une carte ou un badge dans un écran, regarde si
`UI.js` en a déjà un — c'est presque toujours le cas.


| Composant                                                           | Usage                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `<Card>`                                                            | Carte blanche arrondie avec ombre (conteneur de base)     |
| `<StatCard icon="..." value="..." label="..." />`                   | Grande carte de statistique (tableau de bord)             |
| `<Badge label="Actif" tone="success" />`                            | Étiquette colorée (`success`/`warning`/`danger`/`info`) |
| `<BoxField label="..." value={...} onChangeText={...} unit="kg" />` | Champ de saisie numérique                                |
| `<SelectField label="..." value={...} onPress={...} />`             | Sélecteur (ouvre une liste au tap)                       |
| `<AlertBanner title="..." message="..." tone="warning" />`          | Bandeau d'alerte                                          |
| `<BackHeader title="..." onBack={...} />`                           | En-tête avec flèche retour                              |
| `<BrandHeader subtitle="Nom de la ferme" />`                        | En-tête avec logo + statut sync                          |
| `<DataRow label="..." value="..." />`                               | Ligne "label : valeur" dans une carte récap              |

Exemple d'utilisation dans un écran :

```jsx
import { Card, Badge, DataRow } from '../components/UI';

<Card>
  <DataRow label="Effectif" value="4 850 sujets" />
  <DataRow label="Mortalité" value="12 poules" tone="danger" />
</Card>
```

---

## 7. Ajouter un nouvel écran — étapes concrètes

Exemple : on veut ajouter un écran "Contacts fournisseurs".

**Étape 1 — Créer le fichier** `src/screens/FournisseursScreen.js` :

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, type, spacing } from '../theme/theme';
import { BackHeader, Card } from '../components/UI';

export default function FournisseursScreen({ navigation }) {
  return (
    <View style={styles.screen}>
      <BackHeader title="Fournisseurs" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        <Card>
          <Text style={type.bodyMd}>Contenu à venir...</Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing(5) },
});
```

**Étape 2 — Le déclarer dans la navigation**, dans
`src/navigation/AppNavigator.js` :

```jsx
import FournisseursScreen from '../screens/FournisseursScreen';
// ...
<MenuStack.Screen name="Fournisseurs" component={FournisseursScreen} />
```

**Étape 3 — Ajouter un lien vers cet écran**, par exemple dans
`MenuScreen.js` (dans la liste `SECTIONS`) :

```js
{ icon: 'call-outline', label: 'Fournisseurs', screen: 'Fournisseurs' },
```

C'est tout — l'écran est maintenant accessible depuis le menu.

---

## 8. Comment la navigation est organisée

L'app a 5 onglets en bas (`Accueil`, `Saisie`, `Alertes`, `Rapports`,
`Menu`). Certains onglets contiennent plusieurs écrans empilés :

```
Accueil      → un seul écran (DashboardScreen)
Saisie       → BandesListe → BandeDetail → RapportJournalier → RapportConfirmation
Alertes      → un seul écran (AlertesScreen)
Rapports     → un seul écran (FinancesScreen)
Menu         → MenuHub → Stocks / Commandes / Personnel / Historique / SyncCenter / Parametres
```

Pour naviguer vers un écran du **même groupe** (ex: de `BandesListe` vers
`BandeDetail`) :

```js
navigation.navigate('BandeDetail', { bandeId: bande.id });
```

Pour naviguer vers un écran **d'un autre onglet**, ça marche aussi tant que
le nom existe quelque part dans l'arbre — React Navigation cherche
automatiquement. Si ça ne marche pas, il faut préciser :

```js
navigation.navigate('Menu', { screen: 'Parametres' });
```

---

## 9. Erreurs fréquentes à connaître

- **"écran introuvable" / rien ne se passe au clic** : le nom du `<XxxStack.Screen name="...">`
  dans `AppNavigator.js` ne correspond pas exactement au nom utilisé dans
  `navigation.navigate('...')`. Vérifie l'orthographe (sensible à la casse).
- **Couleur bizarre / undefined** : vérifie que la clé existe bien dans
  `colors` (`theme.js`). Une faute de frappe comme `colors.primaryDeeep`
  ne provoque pas d'erreur visible mais rend un style cassé.
- **Un écran plante au chargement** : c'est presque toujours parce qu'il
  essaie de lire une donnée qui n'existe pas encore (ex: `fermeCourante`
  vaut `null` juste après le lancement de l'app). Toujours vérifier avec
  `fermeCourante?.id` plutôt que `fermeCourante.id`.
- **Après une modification, rien ne change à l'écran** : sur le web/Expo Go,
  sauvegarder suffit normalement (rechargement à chaud). Sinon, secoue le
  téléphone (ou `r` dans le terminal) pour recharger manuellement.

---

## 10. Prochaines briques à construire (pas encore faites)

Si ton ami veut s'exercer, voici des tâches concrètes et safe pour
commencer, du plus simple au plus complexe :

1. **Changer une couleur ou un texte** — dans `theme.js` ou un écran, sans
   toucher à la logique. Bon premier pas pour se familiariser.
2. **Ajouter un champ au formulaire de saisie** (`RapportJournalierScreen.js`)
   — par exemple "température du bâtiment". Il faut : ajouter un `useState`,
   un `<BoxField>`, et l'inclure dans l'objet envoyé à `ajouterRapport(...)`.
3. **Le formulaire de création de bande** (actuellement un simple message
   "bientôt disponible" dans `BandesScreen.js`) — un bon exercice complet
   utilisant tout ce qui est expliqué ci-dessus.
4. **Brancher un vrai backend** — remplacer les `useState` de
   `RapportsContext.js` par des appels à une API. C'est le seul fichier à
   toucher pour ça, tous les écrans continueront de fonctionner pareil.

---

Si quelque chose n'est pas clair ou casse, ce n'est presque jamais un
problème de "compétence" — c'est souvent une histoire de fichier oublié
(pense toujours aux 3 endroits centraux : `theme.js`, `mockData.js`,
`AppNavigator.js`). Bon courage à ton ami !
