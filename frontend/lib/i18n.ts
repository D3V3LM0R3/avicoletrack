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
    settings: 'Paramètres', profile: 'Profil', editProfile: 'Modifier le profil', fullName: 'Nom complet', save: 'Enregistrer',
    preferences: 'Préférences', stockDisplay: "Affichage du stock d'œufs", eggs: 'Œufs', traysLabel: 'Alvéoles', cartons: 'Cartons',
    theme: 'Thème', light: 'Clair', dark: 'Sombre', lowData: 'Mode faible data', notifications: 'Notifications', criticalAlerts: 'Alertes critiques (mortalité)',
    stockAlerts: 'Alertes de stock', productionAlerts: 'Alertes de production', dataSync: 'Données & Sync', lastSync: 'Dernière synchronisation',
    syncNow: 'Synchroniser maintenant', syncing: 'Synchronisation...', queue: "Voir la file d'attente", security: 'Sécurité', changePassword: 'Changer le mot de passe',
    helpSupport: 'Aide & Support', faq: 'FAQ & Tutoriels', contactSupport: 'Contacter le support', about: 'À propos', version: 'Version',
    terms: "Conditions d'utilisation", privacy: 'Politique de confidentialité', logout: 'Déconnexion', close: 'Fermer',
    offline: 'Hors ligne', syncRequired: 'Une connexion est requise. Vos données restent en sécurité.',
    profileUpdated: 'Profil mis à jour.', updateProfileError: 'Impossible de mettre à jour le profil.',
    faqOfflineQ: 'Comment saisir sans connexion ?', faqOfflineA: 'Vos saisies sont enregistrées localement puis synchronisées automatiquement au retour du réseau.',
    faqEggsQ: 'Comment convertir mes œufs en cartons ?', faqEggsA: "L'application convertit automatiquement : 30 œufs = 1 alvéole, 360 œufs = 1 carton.",
    faqFinanceQ: 'Qui peut voir mes données financières ?', faqFinanceA: 'Uniquement le propriétaire et les gestionnaires autorisés de votre ferme.',
  },
  en: {
    home: 'Home', entry: 'Entry', alerts: 'Alerts', reports: 'Reports', menu: 'Menu', movements: 'Movements',
    synced: 'Synced', notSynced: 'Not synced', activeFarm: 'No active farm',
    ownerDashboard: 'OWNER DASHBOARD', today: 'Today', sevenDays: '7 days',
    thirtyDays: '30 days', custom: 'Custom', staff: 'Flock size', subjects: 'birds',
    eggsProduced: 'Eggs produced', units: 'units', mortality: 'Mortality', eggStock: 'Egg stock',
    trays: 'trays', foodStock: 'Feed stock', loading: 'Loading data...', offlineData: 'Local data',
    'error.loading_data': 'Unable to load data right now.',
    settings: 'Settings', profile: 'Profile', editProfile: 'Edit profile', fullName: 'Full name', save: 'Save',
    preferences: 'Preferences', stockDisplay: 'Egg stock display', eggs: 'Eggs', traysLabel: 'Trays', cartons: 'Cartons',
    theme: 'Theme', light: 'Light', dark: 'Dark', lowData: 'Low-data mode', notifications: 'Notifications', criticalAlerts: 'Critical alerts (mortality)',
    stockAlerts: 'Stock alerts', productionAlerts: 'Production alerts', dataSync: 'Data & sync', lastSync: 'Last synchronization',
    syncNow: 'Synchronize now', syncing: 'Synchronizing...', queue: 'View queue', security: 'Security', changePassword: 'Change password',
    helpSupport: 'Help & support', faq: 'FAQ & tutorials', contactSupport: 'Contact support', about: 'About', version: 'Version',
    terms: 'Terms of use', privacy: 'Privacy policy', logout: 'Log out', close: 'Close',
    offline: 'Offline', syncRequired: 'A connection is required. Your data remains safe.',
    profileUpdated: 'Profile updated.', updateProfileError: 'Unable to update your profile.',
    faqOfflineQ: 'How do I enter data offline?', faqOfflineA: 'Your entries are saved locally and synchronized automatically when the connection returns.',
    faqEggsQ: 'How are eggs converted to cartons?', faqEggsA: 'The app converts automatically: 30 eggs = 1 tray, 360 eggs = 1 carton.',
    faqFinanceQ: 'Who can see my financial data?', faqFinanceA: 'Only the owner and authorized managers of your farm.',
  },
} as const;

export type MessageKey = keyof typeof messages.fr;

export function useI18n() {
  const { language } = usePreferences();
  const t = useCallback((key: MessageKey) => messages[language][key], [language]);
  return { language, t };
}