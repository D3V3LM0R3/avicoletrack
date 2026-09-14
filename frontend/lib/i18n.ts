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
    alertTitle: 'Alertes', activeToProcess: 'à traiter', all: 'Toutes', production: 'Production', stock: 'Stock', health: 'Sanitaire', loadingAlerts: 'Chargement des alertes…',
    fetchingNotifications: 'Récupération des notifications depuis le backend.', noActiveAlerts: 'Aucune alerte active', alertsWillAppear: 'Tout va bien pour le moment. Les nouvelles alertes apparaîtront ici.', details: 'Voir les détails',
    critical: 'Critique', attention: 'Attention', info: 'Info', affectedValue: 'Valeur concernée', thresholdExceeded: 'Seuil dépassé', recommendation: 'Recommandation', linkedReport: 'Voir le rapport lié', markRead: 'Marquer comme lue',
    capitalResults: 'Capital & Résultats', day: 'Jour', week: 'Semaine', month: 'Mois', year: 'An', allTime: 'Tout', investedCapital: 'Capital investi', revenue: 'Revenu', costs: 'Coûts', netResult: 'Résultat net', margin: 'Marge', marketPrices: 'Prix du marché', resultTrend: 'Tendance du résultat', farmComparison: 'Comparaison des fermes', comparisonPoints: 'Points de comparaison',
    highestProduction: 'Production la plus élevée', highestMortality: 'Mortalité la plus élevée', lower: 'Bas', higher: 'Haut', confirmed: 'Confirmé', cancelled: 'Annulé', pending: 'En attente',
    reportsTitle: 'Rapports', entries: 'Saisies', events: 'Événements', search: 'Rechercher...', selected: 'sélectionné(s)', selectAll: 'Tout sélectionner', export: 'Exporter', noPermission: "Vous n’avez pas l’autorisation de consulter ce rapport.",
    operations: 'Exploitation', analysis: 'Analyse', communication: 'Communication', entertainment: 'Divertissement', system: 'Système', flocks: 'Bandes', inventory: 'Stocks & Inventaire', stockMovements: 'Mouvements de stock', farmsResults: 'Fermes & résultats', personnel: 'Personnel', multiFarmAnalysis: 'Analyse multi-fermes', eventsReminders: 'Événements & rappels', marketPricesMenu: 'Prix du marché', auditHistory: 'Audit & Historique', messages: 'Messages', miniGames: 'Mini-jeux', syncCenter: 'Centre de synchronisation', upToDate: 'À jour', waiting: 'En attente', enterprise: 'Entreprise', owner: 'Propriétaire', manager: 'Gestionnaire', worker: 'Éleveur',
    fieldStaff: 'Effectif', feed: 'Aliments', water: 'Eau', createdBy: 'Créé par', createdAt: 'Créé le', noObservation: 'Aucune observation.', notify: 'Notifier', event: 'Événement', movement: 'Mouvement', select: 'Sélectionner', exportOptions: "Options d’export", send: 'Envoyer', cancel: 'Annuler', reportMessage: 'Message à envoyer', notifyFarm: 'Notifier la ferme',
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
    alertTitle: 'Alerts', activeToProcess: 'to process', all: 'All', production: 'Production', stock: 'Stock', health: 'Health', loadingAlerts: 'Loading alerts…',
    fetchingNotifications: 'Retrieving notifications from the backend.', noActiveAlerts: 'No active alerts', alertsWillAppear: 'Everything looks good for now. New alerts will appear here.', details: 'View details',
    critical: 'Critical', attention: 'Attention', info: 'Info', affectedValue: 'Affected value', thresholdExceeded: 'Threshold exceeded', recommendation: 'Recommendation', linkedReport: 'View linked report', markRead: 'Mark as read',
    capitalResults: 'Capital & Results', day: 'Day', week: 'Week', month: 'Month', year: 'Year', allTime: 'All time', investedCapital: 'Invested capital', revenue: 'Revenue', costs: 'Costs', netResult: 'Net result', margin: 'Margin', marketPrices: 'Market prices', resultTrend: 'Result trend', farmComparison: 'Farm comparison', comparisonPoints: 'Comparison points',
    highestProduction: 'Highest production', highestMortality: 'Highest mortality', lower: 'Low', higher: 'High', confirmed: 'Confirmed', cancelled: 'Cancelled', pending: 'Pending',
    reportsTitle: 'Reports', entries: 'Entries', events: 'Events', search: 'Search...', selected: 'selected', selectAll: 'Select all', export: 'Export', noPermission: 'You are not authorized to view this report.',
    operations: 'Operations', analysis: 'Analysis', communication: 'Communication', entertainment: 'Entertainment', system: 'System', flocks: 'Flocks', inventory: 'Inventory', stockMovements: 'Stock movements', farmsResults: 'Farms & results', personnel: 'Personnel', multiFarmAnalysis: 'Multi-farm analysis', eventsReminders: 'Events & reminders', marketPricesMenu: 'Market prices', auditHistory: 'Audit & history', messages: 'Messages', miniGames: 'Mini-games', syncCenter: 'Sync center', upToDate: 'Up to date', waiting: 'Pending', enterprise: 'Enterprise', owner: 'Owner', manager: 'Manager', worker: 'Worker',
    fieldStaff: 'Staff', feed: 'Feed', water: 'Water', createdBy: 'Created by', createdAt: 'Created at', noObservation: 'No observation.', notify: 'Notify', event: 'Event', movement: 'Movement', select: 'Select', exportOptions: 'Export options', send: 'Send', cancel: 'Cancel', reportMessage: 'Message to send', notifyFarm: 'Notify farm',
  },
} as const;

export type MessageKey = keyof typeof messages.fr;

export function useI18n() {
  const { language } = usePreferences();
  const t = useCallback((key: MessageKey) => messages[language][key], [language]);
  return { language, t };
}