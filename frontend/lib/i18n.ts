import { useCallback } from 'react';
import { usePreferences } from './app-preferences';

const messages = {
  fr: {
    home: 'Accueil', entry: 'Saisie', alerts: 'Alertes', reports: 'Rapports', menu: 'Menu', movements: 'Mouvements',
    synced: 'Synchronisé', notSynced: 'Non synchronisé', activeFarm: 'Aucune ferme active',
    ownerDashboard: 'TABLEAU DE BORD PROPRIÉTAIRE', today: "Aujourd'hui", sevenDays: '7 jours',
    thirtyDays: '30 jours', custom: 'Personnalisé', staff: 'Effectif', subjects: 'sujets',
    eggsProduced: 'Œufs produits', units: 'unités', mortality: 'Mortalité', eggStock: "Stock d'œufs",
    trays: 'alvéoles', foodStock: "Stock d'aliment", loading: 'Chargement des données...', offlineData: 'Données locales',
    'error.loading_data': 'Impossible de charger les données pour le moment.',
  },
  en: {
    home: 'Home', entry: 'Entry', alerts: 'Alerts', reports: 'Reports', menu: 'Menu', movements: 'Movements',
    synced: 'Synced', notSynced: 'Not synced', activeFarm: 'No active farm',
    ownerDashboard: 'OWNER DASHBOARD', today: 'Today', sevenDays: '7 days',
    thirtyDays: '30 days', custom: 'Custom', staff: 'Flock size', subjects: 'birds',
    eggsProduced: 'Eggs produced', units: 'units', mortality: 'Mortality', eggStock: 'Egg stock',
    trays: 'trays', foodStock: 'Feed stock', loading: 'Loading data...', offlineData: 'Local data',
    'error.loading_data': 'Unable to load data right now.',
  },
} as const;

export type MessageKey = keyof typeof messages.fr;

export function useI18n() {
  const { language } = usePreferences();
  const t = useCallback((key: MessageKey) => messages[language][key], [language]);
  return { language, t };
}