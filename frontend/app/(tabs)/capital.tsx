// app/(tabs)/capital.tsx
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', currencyDisplay: 'code', minimumFractionDigits: 0 }).format(value).replace('XOF', 'FCFA');
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

type FinancialSummary = {
  period: string;
  total_capital: number;
  total_revenue: number;
  total_cost: number;
  net_profit: number;
  margin_percentage: number;
  farms: {
    farm_id: number;
    farm_name: string;
    capital: number;
    revenue: number;
    cost: number;
    profit: number;
    margin_percentage: number;
  }[];
  comparison?: {
    highest_productivity?: { farm_name: string; eggs: number };
    highest_mortality?: { farm_name: string; mortality: number };
  };
};

type MarketPrices = {
  [key: string]: {
    price: number;
    price_low?: number;
    price_mid?: number;
    price_high?: number;
    unit: string;
    date: string;
    source: string;
  };
};

type ProfitTrend = {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
};

export default function CapitalScreen() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1d' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null);
  const [marketPrices, setMarketPrices] = useState<MarketPrices>({});
  const [profitTrends, setProfitTrends] = useState<ProfitTrend[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [financial, prices, trends] = await Promise.all([
        api.get(`/analytics/owner/financial-summary?period=${period}`),
        api.get('/analytics/owner/market-prices'),
        api.get('/analytics/owner/profit-trends?months=6')
      ]);

      setFinancialData(financial.data);
      setMarketPrices(prices.data);
      setProfitTrends(trends.data.trends);
    } catch (err) {
      console.error('Error loading capital dashboard:', err);
      setError(t('error.loading_data'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <ScreenShell activeTab="capital">
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header with period selector */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Capital & Résultats</Text>
          <View style={styles.periodSelector}>
            {(['1d', '7d', '30d', '90d', 'year', 'all'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodButton, period === p && styles.periodButtonActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
                  {p === '1d' ? 'Jour' : p === '7d' ? 'Semaine' : p === '30d' ? 'Mois' : p === '90d' ? '90j' : p === 'year' ? 'An' : 'Tout'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading && <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && financialData && (
          <>
            {/* Financial Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="trending-up" size={20} color={Colors.primary} />
                  <Text style={styles.cardLabel}>Capital investi</Text>
                </View>
                <Text style={[styles.cardValue, styles.capital]}>
                  {formatCurrency(financialData.total_capital)}
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="shopping-cart" size={20} color={Colors.tertiary} />
                  <Text style={styles.cardLabel}>Revenu</Text>
                </View>
                <Text style={[styles.cardValue, styles.revenue]}>
                  {formatCurrency(financialData.total_revenue)}
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="money-off" size={20} color={Colors.error} />
                  <Text style={styles.cardLabel}>Coûts</Text>
                </View>
                <Text style={[styles.cardValue, styles.cost]}>
                  {formatCurrency(financialData.total_cost)}
                </Text>
              </View>

              <View style={[styles.card, styles.cardProfit]}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="attach-money" size={20} color={Colors.surface} />
                  <Text style={[styles.cardLabel, styles.cardLabelWhite]}>Résultat net</Text>
                </View>
                <Text style={[styles.cardValue, styles.profitValue]}>
                  {formatCurrency(financialData.net_profit)}
                </Text>
                <Text style={styles.marginText}>
                  Marge: {formatPercent(financialData.margin_percentage)}
                </Text>
              </View>
            </View>

            {/* Market Prices Section */}
            {Object.keys(marketPrices).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prix du marché</Text>
                <View style={styles.pricesGrid}>
                  {Object.entries(marketPrices).map(([product, data]) => (
                    <View key={product} style={styles.priceCard}>
                      <Text style={styles.priceProduct}>{product}</Text>
                      <Text style={styles.priceValue}>{formatCurrency(data.price_mid ?? data.price)}</Text>
                      <Text style={styles.priceUnit}>{data.unit}</Text>
                      <Text style={styles.priceDate}>Bas {formatCurrency(data.price_low ?? data.price)} • Haut {formatCurrency(data.price_high ?? data.price)}</Text>
                      <Text style={styles.priceDate}>
                        {new Date(data.date).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Profit Trends Chart */}
            {profitTrends.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tendance du résultat</Text>
                <View style={styles.trendsContainer}>
                  {profitTrends.map((trend) => (
                    <View key={trend.month} style={styles.trendRow}>
                      <Text style={styles.trendMonth}>{trend.month}</Text>
                      <View style={styles.trendBars}>
                        {/* Revenue bar */}
                        <View style={styles.barContainer}>
                          <View
                            style={[
                              styles.bar,
                              styles.barRevenue,
                              { width: `${Math.min(100, (trend.revenue / 10000) * 100)}%` }
                            ]}
                          />
                        </View>
                        {/* Cost bar */}
                        <View style={styles.barContainer}>
                          <View
                            style={[
                              styles.bar,
                              styles.barCost,
                              { width: `${Math.min(100, (trend.cost / 10000) * 100)}%` }
                            ]}
                          />
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.trendProfit,
                          trend.profit >= 0 ? styles.trendProfitPositive : styles.trendProfitNegative
                        ]}
                      >
                        {formatCurrency(trend.profit)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Farm Comparison */}
            {financialData.farms.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comparaison des fermes</Text>
                {financialData.farms.map((farm, idx) => (
                  <View key={farm.farm_id} style={styles.farmCard}>
                    <View style={styles.farmHeader}>
                      <Text style={styles.farmName}>
                        {idx === 0 ? '🏆 ' : idx === financialData.farms.length - 1 ? '📉 ' : ''}
                        {farm.farm_name}
                      </Text>
                      <Text
                        style={[
                          styles.farmProfit,
                          farm.profit >= 0 ? styles.profitPositive : styles.profitNegative
                        ]}
                      >
                        {formatCurrency(farm.profit)}
                      </Text>
                    </View>
                    <View style={styles.farmStats}>
                      <View style={styles.farmStat}>
                        <Text style={styles.statLabel}>Capital</Text>
                        <Text style={styles.statValue}>{formatCurrency(farm.capital)}</Text>
                      </View>
                      <View style={styles.farmStat}>
                        <Text style={styles.statLabel}>Revenu</Text>
                        <Text style={styles.statValue}>{formatCurrency(farm.revenue)}</Text>
                      </View>
                      <View style={styles.farmStat}>
                        <Text style={styles.statLabel}>Coûts</Text>
                        <Text style={styles.statValue}>{formatCurrency(farm.cost)}</Text>
                      </View>
                      <View style={styles.farmStat}>
                        <Text style={styles.statLabel}>Marge</Text>
                        <Text style={[styles.statValue, farm.margin_percentage >= 0 ? { color: Colors.success } : { color: Colors.error }]}>
                          {formatPercent(farm.margin_percentage)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {financialData.comparison && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Points de comparaison</Text>
                {financialData.comparison.highest_productivity && <Text style={styles.comparisonText}>Production la plus élevée : {financialData.comparison.highest_productivity.farm_name} ({financialData.comparison.highest_productivity.eggs} œufs)</Text>}
                {financialData.comparison.highest_mortality && <Text style={styles.comparisonText}>Mortalité la plus élevée : {financialData.comparison.highest_mortality.farm_name} ({financialData.comparison.highest_mortality.mortality})</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.containerPadding,
    gap: Spacing.lg,
  },
  headerSection: {
    gap: Spacing.md,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.onBackground,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: Colors.onPrimary,
  },
  errorText: {
    ...Typography.bodyMedium,
    color: Colors.error,
    textAlign: 'center',
  },
  summaryGrid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  cardProfit: {
    backgroundColor: Colors.primary,
    borderLeftColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardLabel: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
  },
  cardLabelWhite: {
    color: Colors.onPrimary,
  },
  cardValue: {
    ...Typography.headlineSmall,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  capital: {
    color: Colors.primary,
  },
  revenue: {
    color: Colors.tertiary,
  },
  cost: {
    color: Colors.error,
  },
  profitValue: {
    color: Colors.onPrimary,
  },
  marginText: {
    ...Typography.labelSmall,
    color: Colors.inverseOnSurface,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.titleMedium,
    color: Colors.onBackground,
  },
  pricesGrid: {
    gap: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priceCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.xs,
  },
  priceProduct: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
  },
  priceValue: {
    ...Typography.titleSmall,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  priceUnit: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
  },
  priceDate: {
    ...Typography.labelSmall,
    color: Colors.outline,
    marginTop: Spacing.xs,
  },
  comparisonText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.md, borderRadius: Radius.md },
  trendsContainer: {
    gap: Spacing.sm,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  trendMonth: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    minWidth: 50,
  },
  trendBars: {
    flex: 1,
    gap: Spacing.xs,
  },
  barContainer: {
    height: 6,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xs,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: Radius.xs,
  },
  barRevenue: {
    backgroundColor: Colors.tertiary,
  },
  barCost: {
    backgroundColor: Colors.error,
  },
  trendProfit: {
    ...Typography.labelSmall,
    minWidth: 80,
    textAlign: 'right',
  },
  trendProfitPositive: {
    color: Colors.success,
  },
  trendProfitNegative: {
    color: Colors.error,
  },
  farmCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadow.xs,
    marginBottom: Spacing.md,
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  farmName: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    flex: 1,
  },
  farmProfit: {
    ...Typography.titleSmall,
    fontWeight: '600',
  },
  profitPositive: {
    color: Colors.success,
  },
  profitNegative: {
    color: Colors.error,
  },
  farmStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  farmStat: {
    flex: 1,
    minWidth: 100,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.titleSmall,
    color: Colors.primary,
  },
});
