// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { StatCard } from '@/components/ui/StatCard';
import { formatEggStock, formatStockDisplay, getDashboard, getEggStockBreakdown, getFarmPermissionState, listDailyReports, listFarms, listFlocks, listNotifications, type DashboardSummary, type DailyReport, type Farm, type Flock, type Notification } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getItem } from '@/lib/storage';
import { usePreferences } from '@/lib/app-preferences';
import { loadNotificationPreferences, notificationPreferenceEnabled, type NotificationPreferences } from '@/lib/notification-preferences';

// Fonction utilitaire pour formater les nombres en français (ex: 4520 -> "4 520")
const formatNumber = (num: number | string): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Date dynamique au format JJ/MM/AAAA
const getTodayDate = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const getReportsInPeriod = (items: DailyReport[], startDate?: Date | null, endDate?: Date | null): DailyReport[] => {
  if (!items.length) return [];
  const lower = startDate ? new Date(`${startDate.toISOString().slice(0, 10)}T00:00:00`) : null;
  const upper = endDate ? new Date(`${endDate.toISOString().slice(0, 10)}T23:59:59`) : null;
  return items.filter((report) => {
    const reportDate = new Date(`${report.report_date}T00:00:00`);
    if (lower && reportDate < lower) return false;
    if (upper && reportDate > upper) return false;
    return true;
  });
};

const getLatestReportForFlock = (reports: DailyReport[], flockId: number): DailyReport | undefined => reports
  .filter((report) => report.flock_id === flockId)
  .sort((left, right) => right.report_date.localeCompare(left.report_date))[0];

const getPeriodBounds = (periodKey: 'today' | '7d' | '30d' | 'custom', customStart?: Date | null, customEnd?: Date | null) => {
  const now = new Date();
  if (periodKey === 'custom') {
    return { start: customStart ? new Date(`${customStart.toISOString().slice(0, 10)}T00:00:00`) : null, end: customEnd ? new Date(`${customEnd.toISOString().slice(0, 10)}T23:59:59`) : null };
  }
  const start = new Date(now);
  if (periodKey === 'today') {
    start.setHours(0, 0, 0, 0);
    return { start, end: new Date(`${now.toISOString().slice(0, 10)}T23:59:59`) };
  }
  const days = periodKey === '7d' ? 7 : 30;
  start.setDate(now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${now.toISOString().slice(0, 10)}T23:59:59`);
  return { start, end };
};

type FarmStatus = 'critical' | 'attention' | 'okay';
type MetricStatus = FarmStatus;

const getFarmStatus = (farmId: number, reports: DailyReport[]): FarmStatus => {
  const farmReports = reports.filter((item) => item.farm_id === farmId);
  const totalMortality = farmReports.reduce((sum, item) => sum + (item.mortality || 0), 0);
  const totalBirds = farmReports.reduce((sum, item) => sum + (item.bird_count || 0), 0) || 1;
  if (!farmReports.length) return 'attention';
  if (totalMortality / totalBirds >= 0.05) return 'critical';
  if (totalMortality / totalBirds >= 0.02) return 'attention';
  return 'okay';
};

const getMetricStatus = (metric: 'hens' | 'eggs' | 'mortality' | 'stock' | 'food', value: number, flockBirdCount?: number): MetricStatus => {
  if (metric === 'hens') {
    if (!value || value <= 0) return 'critical';
    if (value < (flockBirdCount ? Math.max(10, flockBirdCount * 0.25) : 20)) return 'attention';
    return 'okay';
  }
  if (metric === 'eggs') {
    if (value <= 0) return 'critical';
    if (value < 25) return 'attention';
    return 'okay';
  }
  if (metric === 'mortality') {
    if (!value) return 'okay';
    if (value > 10 || (flockBirdCount && value / flockBirdCount >= 0.08)) return 'critical';
    if (value > 3 || (flockBirdCount && value / flockBirdCount >= 0.03)) return 'attention';
    return 'okay';
  }
  if (metric === 'stock') {
    if (value <= 100) return 'critical';
    if (value <= 300) return 'attention';
    return 'okay';
  }
  if (metric === 'food') {
    if (value <= 30) return 'critical';
    if (value <= 90) return 'attention';
    return 'okay';
  }
  return 'okay';
};

const STATUS_META: Record<MetricStatus, { label: string; color: string; backgroundColor: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  critical: { label: 'Critique', color: Colors.onErrorContainer, backgroundColor: Colors.errorContainer, icon: 'error' },
  attention: { label: 'Attention', color: Colors.onSecondaryContainer, backgroundColor: Colors.secondaryContainer, icon: 'warning' },
  okay: { label: 'Normal', color: Colors.onTertiaryFixed, backgroundColor: Colors.tertiaryFixed, icon: 'check-circle' },
};

const FARM_STATUS_META: Record<FarmStatus, { label: string; color: string; backgroundColor: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  critical: { label: 'Critique', color: Colors.onErrorContainer, backgroundColor: Colors.errorContainer, icon: 'error' },
  attention: { label: 'Attention', color: Colors.onSecondaryContainer, backgroundColor: Colors.secondaryContainer, icon: 'warning' },
  okay: { label: 'OK', color: Colors.onTertiaryFixed, backgroundColor: Colors.tertiaryFixed, icon: 'check-circle' },
};

export default function DashboardScreen() {
  const { t, language } = useI18n();
  const { stockDisplay } = usePreferences();
  const [period, setPeriod] = useState(t('today'));
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [role, setRole] = useState('OWNER');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [customPicker, setCustomPicker] = useState<'start' | 'end' | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [detailMetric, setDetailMetric] = useState<'hens' | 'eggs' | 'mortality' | 'stock' | 'food' | null>(null);
  const [canCreateEvent, setCanCreateEvent] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({ critical: true, stock: true, production: false });

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? farms[0] ?? null;
  const selectedFarmStats = summary?.farms_detail.find((farm) => farm.farm_id === selectedFarm?.id) ?? null;
  const periodKey = period === t('sevenDays') ? '7d' : period === t('thirtyDays') ? '30d' : period === t('custom') ? 'custom' : 'today';
  const selectedFarmFlocks = flocks.filter((flock) => flock.farm_id === selectedFarm?.id && !flock.archived);
  const periodBounds = getPeriodBounds(periodKey, customStart, customEnd);
  const selectedFarmReports = getReportsInPeriod(
    reports.filter((report) => report.farm_id === selectedFarm?.id),
    periodBounds.start,
    periodBounds.end,
  );
  const selectedFarmSummary = {
    hens: selectedFarmStats?.hens ?? selectedFarmFlocks.reduce((sum, flock) => sum + flock.bird_count, 0),
    eggs: selectedFarmStats?.eggs ?? selectedFarmFlocks.reduce((sum, flock) => sum + (getLatestReportForFlock(selectedFarmReports, flock.id)?.eggs_produced || 0), 0),
    mortality: selectedFarmStats?.mortality ?? selectedFarmFlocks.reduce((sum, flock) => sum + (getLatestReportForFlock(selectedFarmReports, flock.id)?.mortality || 0), 0),
    stock: selectedFarm?.egg_stock ?? 0,
    food: selectedFarm?.food_quantity ?? 0,
  };

  useFocusEffect(useCallback(() => {
    setIsLoading(true);
    Promise.all([
      getItem('user_data').then((raw) => { if (raw) setRole(JSON.parse(raw).role || 'OWNER'); }),
      getDashboard(periodKey, customStart?.toISOString().slice(0, 10), customEnd?.toISOString().slice(0, 10)).then(setSummary),
      listNotifications().then(setNotifications),
      loadNotificationPreferences().then(setNotificationPreferences),
      listFarms().then((items) => {
        setFarms(items);
        setSelectedFarmId((previous) => previous ?? items[0]?.id ?? null);
      }),
      listFlocks().then(setFlocks),
      listDailyReports().then((items) => { setReports(items); setLatestReport(items[0] || null); }),
    ]).catch(() => {}).finally(() => setIsLoading(false));
  }, [periodKey, customStart, customEnd]));

  const foodStock = summary?.food ?? farms.reduce((total, farm) => total + (farm.food_quantity ?? 0), 0);
  const metricLabel = detailMetric === 'hens' ? 'Sujets' : detailMetric === 'eggs' ? 'Œufs produits' : detailMetric === 'mortality' ? 'Mortalité' : detailMetric === 'stock' ? 'Stock d’œufs' : 'Aliments';

  useEffect(() => setPeriod(t('today')), [language, t]);

  useEffect(() => {
    if (!farms.length) {
      setCanCreateEvent(false);
      return;
    }
    Promise.all(farms.map(async (farm) => {
      const permissions = await getFarmPermissionState(farm.id);
      return [farm.id, { create_event: permissions.create_event }] as const;
    })).then((entries) => {
      const nextPermissions = Object.fromEntries(entries);
      setCanCreateEvent(role === 'OWNER' || farms.some((farm) => nextPermissions[farm.id]?.create_event));
    }).catch(() => {
      setCanCreateEvent(role === 'OWNER');
    });
  }, [farms, role]);

  return (
    <ScreenShell activeTab="index">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {role !== 'OWNER' ? (
          <>
            <Text style={styles.roleEyebrow}>{role === 'MANAGER' ? 'ESPACE GESTION' : 'ESPACE ÉLEVEUR'}</Text>
            <Text style={styles.roleTitle}>{role === 'MANAGER' ? 'Piloter les opérations' : 'Saisie rapide du jour'}</Text>
            <Text style={styles.roleDescription}>{role === 'MANAGER' ? 'Consultez les rapports, alertes et événements de vos fermes.' : 'Ajoutez uniquement l’information disponible, puis complétez plus tard.'}</Text>
            <TouchableOpacity style={styles.roleAction} onPress={() => router.push(role === 'MANAGER' ? '/(tabs)/rapports' : '/(tabs)/saisie')}><MaterialIcons name={role === 'MANAGER' ? 'assessment' : 'add-circle-outline'} size={24} color={Colors.onPrimary} /><Text style={styles.roleActionText}>{role === 'MANAGER' ? 'Voir les rapports' : 'Nouvelle mise à jour'}</Text></TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow}>
              {[t('today'), t('sevenDays'), t('thirtyDays'), t('custom')].map((option) => <TouchableOpacity key={option} style={[styles.periodChip, period === option && styles.periodChipActive]} onPress={() => { if (option === t('custom')) { setPeriod(option); setCustomPicker('start'); } else setPeriod(option); }}><Text style={[styles.periodChipText, period === option && styles.periodChipTextActive]}>{option}</Text></TouchableOpacity>)}
            </ScrollView>
            {customPicker && <DateTimePicker value={customPicker === 'start' ? (customStart || new Date()) : (customEnd || new Date())} mode="date" maximumDate={new Date()} onChange={(event: DateTimePickerEvent, selected?: Date) => { if (event.type === 'dismissed' || !selected) { setCustomPicker(null); return; } if (customPicker === 'start') { setCustomStart(selected); setCustomEnd(null); setCustomPicker('end'); } else { setCustomEnd(selected); setCustomPicker(null); } }} />}
            <View style={styles.roleStats}>
              <StatCard icon="pest-control" iconBg={Colors.secondaryContainer} iconColor={Colors.onSecondaryContainer} label="Effectif" value={formatNumber(selectedFarmSummary.hens || 0)} unit="sujets" style={styles.cardHalf} onPress={() => setDetailMetric('hens')} />
              <StatCard icon="warning" iconBg={Colors.errorContainer} iconColor={Colors.onErrorContainer} label="Mortalité" value={formatNumber(selectedFarmSummary.mortality || 0)} unit="sujets" style={styles.cardHalf} onPress={() => setDetailMetric('mortality')} />
              <StatCard icon="inventory-2" iconBg={Colors.primaryContainer} iconColor={Colors.onPrimaryContainer} label="Stock" value={formatStockDisplay(selectedFarmSummary.stock || 0, stockDisplay, selectedFarm?.cartons, selectedFarm?.alveoli)} unit="" style={styles.cardHalf} onPress={() => setDetailMetric('stock')} />
              <StatCard icon="restaurant" iconBg={Colors.secondaryContainer} iconColor={Colors.onSecondaryContainer} label="Aliments" value={formatNumber(selectedFarmSummary.food || 0)} unit={selectedFarm?.food_unit || 'kg'} style={styles.cardHalf} onPress={() => setDetailMetric('food')} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmPickerRow}>
              {farms.map((farm) => <TouchableOpacity key={farm.id} style={[styles.farmPickerItem, farm.id === selectedFarm?.id && styles.farmPickerItemActive]} onPress={() => setSelectedFarmId(farm.id)}><MaterialIcons name="home-work" size={18} color={farm.id === selectedFarm?.id ? Colors.onPrimary : Colors.primary} /><Text style={[styles.farmPickerText, farm.id === selectedFarm?.id && styles.farmPickerTextActive]}>{farm.name}</Text></TouchableOpacity>)}
            </ScrollView>

            {selectedFarm && (
              <View style={styles.farmSummary}>
                <View style={styles.farmSummaryHeader}><Text style={styles.farmSummaryTitle}>{selectedFarm.name}</Text><View style={[styles.statusBadge, { backgroundColor: FARM_STATUS_META[getFarmStatus(selectedFarm.id, reports)].backgroundColor }]}><MaterialIcons name={FARM_STATUS_META[getFarmStatus(selectedFarm.id, reports)].icon} size={14} color={FARM_STATUS_META[getFarmStatus(selectedFarm.id, reports)].color} /><Text style={[styles.statusText, { color: FARM_STATUS_META[getFarmStatus(selectedFarm.id, reports)].color }]}>{FARM_STATUS_META[getFarmStatus(selectedFarm.id, reports)].label}</Text></View></View>
                <Text style={styles.farmSummaryText}>{selectedFarm.location || 'Ferme active'}</Text>
                <Text style={styles.farmSummaryText}>{selectedFarmStats ? `${formatNumber(selectedFarmStats.eggs)} œufs • ${formatNumber(selectedFarmStats.hens)} sujets • Stock ${formatEggStock(selectedFarm.egg_stock ?? 0, selectedFarm.cartons, selectedFarm.alveoli)}` : `Stock ${formatEggStock(selectedFarm.egg_stock ?? 0, selectedFarm.cartons, selectedFarm.alveoli)}`}</Text>
                <Text style={styles.farmSummaryText}>Aliments: {formatNumber(selectedFarm.food_quantity ?? 0)} {selectedFarm.food_unit || 'kg'}</Text>
                <Text style={styles.farmSummaryText}>Mortalité: {selectedFarmStats ? formatNumber(selectedFarmStats.mortality) : '0'}</Text>
                <TouchableOpacity onPress={() => router.push(`/(tabs)/rapports?farmId=${selectedFarm.id}`)}><Text style={styles.seeAll}>Voir les rapports de cette ferme</Text></TouchableOpacity>
              </View>
            )}

            {role === 'WORKER' && <TouchableOpacity style={styles.historyLink} onPress={() => router.push('/(tabs)/rapports')}><Text style={styles.seeAll}>Voir mon historique</Text><MaterialIcons name="chevron-right" size={20} color={Colors.primary} /></TouchableOpacity>}
          </>
        ) : (
          <>
            <Text style={styles.ownerLabel}>{t('ownerDashboard')}</Text>
            {summary?.farms_detail?.map((farm) => { const farmRecord = farms.find((item) => item.id === farm.farm_id); return <View key={farm.farm_id} style={styles.farmSummary}><Text style={styles.farmSummaryTitle}>{farm.farm_name}</Text><Text style={styles.farmSummaryText}>{formatNumber(farm.eggs)} œufs • {formatNumber(farm.hens)} sujets • Stock {formatEggStock(farm.stock, farmRecord?.cartons, farmRecord?.alveoli)}</Text><Text style={styles.farmSummaryText}>Aliments: {formatNumber(farm.food ?? 0)} kg • Mortalité: {formatNumber(farm.mortality)}</Text><TouchableOpacity onPress={() => router.push(`/(tabs)/rapports?farmId=${farm.farm_id}`)}><Text style={styles.seeAll}>Voir les rapports de cette ferme</Text></TouchableOpacity></View>; })}
          </>
        )}
        {isLoading && <View style={styles.loadingRow}><ActivityIndicator color={Colors.primary} /><Text style={styles.loadingText}>{t('loading')}</Text></View>}
        {role !== 'OWNER' ? null : null}
        {role === 'OWNER' && <>
        <View style={styles.quickActionsRow}>
          {canCreateEvent && (
            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/evenements')}>
              <MaterialIcons name="event" size={24} color={Colors.primary} />
              <Text style={styles.quickActionText}>Créer un événement</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/stocks/mouvement')}>
            <MaterialIcons name="swap-horiz" size={24} color={Colors.primary} />
            <Text style={styles.quickActionText}>Mouvement de stock</Text>
          </TouchableOpacity>
        </View>

        {/* HEADER AVEC SÉLECTEUR DE FERME */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.farmSelector} onPress={() => router.push('/fermes')}>
              <MaterialIcons name="home-work" size={20} color={Colors.primary} />
              <Text style={styles.farmName}>{farms.find((farm) => farm.id === selectedFarmId)?.name || farms[0]?.name || t('activeFarm')}</Text>
              <MaterialIcons name="expand-more" size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.subtitle}>{t('today')} • {getTodayDate()}</Text>
          </View>
          
          {/* Indicateur de synchronisation */}
          <View style={styles.syncBadge}>
            <MaterialIcons name="cloud-done" size={16} color={Colors.primary} />
            <Text style={styles.syncText}>Synchronisé</Text>
          </View>
        </View>

        {/* SÉLECTEUR DE PÉRIODE */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow}>
          {[t('today'), t('sevenDays'), t('thirtyDays'), t('custom')].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
              onPress={() => {
                if (p === t('custom')) { setPeriod(p); setCustomPicker('start'); }
                else setPeriod(p);
              }}
            >
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {customPicker && <DateTimePicker value={customPicker === 'start' ? (customStart || new Date()) : (customEnd || new Date())} mode="date" maximumDate={new Date()} onChange={(event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === 'dismissed' || !selected) { setCustomPicker(null); return; }
          if (customPicker === 'start') { setCustomStart(selected); setCustomEnd(null); setCustomPicker('end'); }
          else { setCustomEnd(selected); setCustomPicker(null); }
        }} />}

        {/* GRILLE KPI (2 COLONNES) */}
        <View style={styles.grid}>
          <StatCard
            icon="pest-control"
            iconBg={Colors.secondaryContainer}
            iconColor={Colors.onSecondaryContainer}
            label={t('staff')}
            value={formatNumber(summary?.hens ?? 0)}
            unit={t('subjects')}
            style={styles.cardHalf}
            onPress={() => setDetailMetric('hens')}
          />
          <StatCard
            icon="egg"
            iconBg={Colors.tertiaryContainer}
            iconColor={Colors.onTertiaryContainer}
            badgeText={summary?.average_laying_percentage == null ? undefined : `${summary.average_laying_percentage.toFixed(0)}%`}
            badgeBg={Colors.tertiaryFixed}
            badgeColor={Colors.onTertiaryFixed}
            label={t('eggsProduced')}
            value={formatNumber(summary?.eggs ?? 0)}
            unit={t('units')}
            style={styles.cardHalf}
            onPress={() => setDetailMetric('eggs')}
          />
          <StatCard
            icon="warning"
            iconBg={Colors.errorContainer}
            iconColor={Colors.onErrorContainer}
            label={t('mortality')}
            value={formatNumber(summary?.mortality ?? 0)}
            unit={t('subjects')}
            valueColor={Colors.error}
            helper="+2 depuis hier"
            style={styles.cardHalf}
            onPress={() => setDetailMetric('mortality')}
          />
          <StatCard
            icon="inventory-2"
            iconBg={Colors.primaryContainer}
            iconColor={Colors.onPrimaryContainer}
            label={t('eggStock')}
            value={formatStockDisplay(summary?.stock ?? 0, stockDisplay, selectedFarm?.cartons, selectedFarm?.alveoli)}
            unit=""
            helper="~900 000 FCFA"
            style={styles.cardHalf}
            onPress={() => setDetailMetric('stock')}
          />
          <StatCard
            icon="restaurant"
            iconBg={Colors.secondaryContainer}
            iconColor={Colors.onSecondaryContainer}
            label={t('foodStock')}
            value={formatNumber(foodStock)}
            unit={farms[0]?.food_unit || 'kg'}
            style={styles.cardHalf}
            onPress={() => setDetailMetric('food')}
          />
        </View>

        <Modal visible={detailMetric !== null} transparent animationType="slide" onRequestClose={() => setDetailMetric(null)}>
          <View style={styles.modalOverlay}><View style={styles.detailModal}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{metricLabel} — {selectedFarm?.name || 'Ferme active'}</Text><TouchableOpacity onPress={() => setDetailMetric(null)}><MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} /></TouchableOpacity></View>
            {selectedFarm ? (
              <View style={styles.detailFarm}>
                <Text style={styles.farmSummaryTitle}>{selectedFarm.name}</Text>
                <Text style={styles.detailValue}>{detailMetric === 'food' ? `${formatNumber(selectedFarmSummary.food || 0)} ${selectedFarm.food_unit || 'kg'}` : detailMetric === 'stock' ? `${getEggStockBreakdown(selectedFarmSummary.stock || 0, selectedFarm?.cartons, selectedFarm?.alveoli).total} œufs` : detailMetric === 'eggs' ? formatNumber(selectedFarmSummary.eggs || 0) : detailMetric === 'mortality' ? formatNumber(selectedFarmSummary.mortality || 0) : formatNumber(selectedFarmSummary.hens || 0)}</Text>
                {(detailMetric === 'stock' || detailMetric === 'food') ? (
                  <View style={styles.detailFlockRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.farmSummaryText}>Unité de la ferme</Text>
                      <Text style={styles.farmSummaryText}>{detailMetric === 'stock' ? 'Détail du stock d’œufs' : 'Stock d’aliments'}</Text>
                      {detailMetric === 'stock' && (() => { const stock = getEggStockBreakdown(selectedFarmSummary.stock || 0, selectedFarm?.cartons, selectedFarm?.alveoli); return <Text style={styles.farmSummaryText}>{stock.cartons} carton(s) • {stock.alveoli} alvéole(s) • {stock.eggs} œuf(s) disponibles</Text>; })()}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_META[getMetricStatus(detailMetric, detailMetric === 'stock' ? selectedFarmSummary.stock : selectedFarmSummary.food)].backgroundColor }]}><MaterialIcons name={STATUS_META[getMetricStatus(detailMetric, detailMetric === 'stock' ? selectedFarmSummary.stock : selectedFarmSummary.food)].icon} size={12} color={STATUS_META[getMetricStatus(detailMetric, detailMetric === 'stock' ? selectedFarmSummary.stock : selectedFarmSummary.food)].color} /><Text style={[styles.statusPillText, { color: STATUS_META[getMetricStatus(detailMetric, detailMetric === 'stock' ? selectedFarmSummary.stock : selectedFarmSummary.food)].color }]}>{STATUS_META[getMetricStatus(detailMetric, detailMetric === 'stock' ? selectedFarmSummary.stock : selectedFarmSummary.food)].label}</Text></View>
                  </View>
                ) : selectedFarmFlocks.length ? selectedFarmFlocks.map((flock) => {
                  const latestReport = getLatestReportForFlock(selectedFarmReports, flock.id);
                  const value = detailMetric === 'hens' ? flock.bird_count : detailMetric === 'eggs' ? latestReport?.eggs_produced || 0 : latestReport?.mortality || 0;
                  const status = getMetricStatus(detailMetric || 'hens', value, flock.bird_count);
                  const statusMeta = STATUS_META[status];
                  return <View key={flock.id} style={styles.detailFlockRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.farmSummaryText}>{flock.name || `Bande ${flock.id}`}</Text>
                      <Text style={styles.farmSummaryText}>{detailMetric === 'hens' ? `${formatNumber(value)} sujets` : detailMetric === 'eggs' ? `${formatNumber(value)} œufs` : detailMetric === 'mortality' ? `${formatNumber(value)} morts` : detailMetric === 'stock' ? `${formatNumber(value)} œufs` : `${formatNumber(value)} ${selectedFarm.food_unit || 'kg'}`}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor }]}><MaterialIcons name={statusMeta.icon} size={12} color={statusMeta.color} /><Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text></View>
                  </View>;
                }) : <Text style={styles.farmSummaryText}>Aucune bande active pour cette ferme.</Text>}
              </View>
            ) : <Text style={styles.farmSummaryText}>Aucune ferme sélectionnée.</Text>}
            <TouchableOpacity style={styles.closeButton} onPress={() => setDetailMetric(null)}><Text style={styles.closeButtonText}>Fermer</Text></TouchableOpacity>
          </View></View>
        </Modal>

        {/* SECTION ALERTES RÉCENTES */}
          <View style={[styles.sectionCard, { backgroundColor: Colors.surfaceContainerLowest, borderColor: Colors.surfaceVariant }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alertes récentes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/alertes')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {notifications.filter((item) => !item.read_at && notificationPreferenceEnabled(item, notificationPreferences)).slice(0, 3).map((item) => (
            <View key={item.id} style={styles.alertItem}>
              <MaterialIcons name="notifications" size={20} color={Colors.warning} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.alertText}>{item.message}</Text>
                <Text style={styles.alertTime}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* SECTION DERNIÈRES SAISIES */}
        <View style={[styles.sectionCard, { backgroundColor: Colors.surfaceContainerLowest, borderColor: Colors.surfaceVariant }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dernières saisies</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/rapports')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.reportItem} onPress={() => router.push('/(tabs)/rapports')}><Text style={styles.reportText}>{latestReport ? `${formatNumber(latestReport.eggs_produced)} œufs • ${latestReport.report_date}` : 'Aucun rapport envoyé'}</Text><MaterialIcons name="chevron-right" size={20} color={Colors.primary} /></TouchableOpacity>
        </View>

        {/* BOUTON D'ACTION RAPIDE (Remplace le FAB) */}
        {canCreateEvent && (
          <TouchableOpacity
            style={styles.quickActionButton}
            activeOpacity={0.85}
            onPress={() => router.push('/evenements')}
          >
            <MaterialIcons name="add-circle-outline" size={24} color={Colors.onPrimary} />
            <Text style={styles.quickActionText}>Créer un événement ou rappel</Text>
          </TouchableOpacity>
        )}
        </>}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40, gap: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  farmSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  farmName: { ...Typography.headlineMd, fontSize: 18, color: Colors.onBackground },
  farmPickerRow: { gap: 8, paddingVertical: 2 },
  farmPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh },
  farmPickerItemActive: { backgroundColor: Colors.primary },
  farmPickerText: { color: Colors.onSurfaceVariant, fontWeight: '700', fontSize: 13 },
  farmPickerTextActive: { color: Colors.onPrimary },
  farmSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subtitle: { ...Typography.bodyMd, fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 4, marginLeft: 28 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  syncText: { ...Typography.labelLg, fontSize: 11, color: Colors.onPrimaryContainer },
  periodRow: { flexDirection: 'row', marginBottom: 4 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, marginRight: 8 },
  periodChipActive: { backgroundColor: Colors.primary },
  periodChipText: { ...Typography.labelLg, color: Colors.onSurfaceVariant },
  periodChipTextActive: { color: Colors.onPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gridGutter },
  cardHalf: { flexGrow: 1, flexBasis: '46%', minWidth: 135, minHeight: 148 },
  sectionCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceVariant, padding: 18, ...Shadow.card },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { ...Typography.headlineMd, fontSize: 16, color: Colors.onBackground },
  seeAll: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  alertItem: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Radius.DEFAULT, borderWidth: 1, marginBottom: 12 },
  alertTitle: { fontWeight: '700', fontSize: 13, color: Colors.onSurface, marginBottom: 4 },
  alertText: { fontSize: 12.5, color: Colors.onSurfaceVariant, lineHeight: 18 },
  alertTime: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 6, fontWeight: '700' },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  reportTitle: { fontWeight: '600', fontSize: 14, color: Colors.onSurface },
  reportText: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { ...Typography.labelLg, fontSize: 10, color: Colors.onPrimaryContainer },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  detailMetricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  detailFlockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6 },
  quickActionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  quickActionCard: { flex: 1, paddingVertical: 18, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Radius.md, ...Shadow.sm },
  quickActionText: { ...Typography.labelLg, fontSize: 16, color: Colors.onPrimary, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  roleEyebrow: { color: Colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 20 },
  roleTitle: { ...Typography.headlineLg, color: Colors.onSurface, marginTop: 8 },
  roleDescription: { color: Colors.onSurfaceVariant, lineHeight: 20, marginTop: 6 },
  roleAction: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.md, marginTop: 18 },
  roleActionText: { color: Colors.onPrimary, fontWeight: '800', fontSize: 16 },
  roleStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gridGutter, marginTop: 18 },
  historyLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  ownerLabel: { color: Colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 20 },
  farmSummary: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 16, marginTop: 12, gap: 6 },
  farmSummaryTitle: { color: Colors.onSurface, fontWeight: '800', fontSize: 16 },
  farmSummaryText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  detailModal: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.containerPadding, maxHeight: '80%' },
  detailFarm: { borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingVertical: 14, gap: 5 },
  detailValue: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  closeButton: { alignItems: 'center', paddingVertical: 14, marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.md },
  closeButtonText: { color: Colors.onPrimary, fontWeight: '800' },
});