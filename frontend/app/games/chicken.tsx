import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { api } from '@/lib/api';
import { getItem, setItem } from '@/lib/storage';

const { width } = Dimensions.get('window');
const GAME_WIDTH = width - Spacing.containerPadding * 2;
const GAME_HEIGHT = 420;
const CHICKEN_SIZE = 30;
const BOARD_ROWS = 7;
const ROAD_ROWS = 5;
const ROW_HEIGHT = GAME_HEIGHT / BOARD_ROWS;
const ROAD_TOP = ROW_HEIGHT;
const LANE_HEIGHT = ROW_HEIGHT;
const SAFE_SLOT_WIDTH = GAME_WIDTH / 7;
const SAFE_BLOCK_WIDTH = SAFE_SLOT_WIDTH - 8;
const getSafeZoneBlocks = (zone: number): number[] => {
  const seed = Math.abs(zone * 7919 + 17);
  const middle = 2 + (seed % 3);
  return [0, 1, middle, 5, 6];
};

type GameState = 'menu' | 'playing' | 'gameOver' | 'paused';
type LeaderboardEntry = {
  rank: number;
  user_name: string;
  score: number;
  distance: number;
  survival_time: number;
  played_at: string;
};
type VehicleType = 'car' | 'truck' | 'bike';
type Vehicle = {
  id: number;
  row: number;
  x: number;
  width: number;
  height: number;
  speed: number;
  type: VehicleType;
  direction: 1 | -1;
  stopped?: boolean;
};
const getRowTop = (row: number) => row * ROW_HEIGHT + (ROW_HEIGHT - CHICKEN_SIZE) / 2;

const getSafeStartX = (zone: number): number => {
  const freeSlot = Array.from({ length: 7 }, (_, slot) => slot).find((slot) => !getSafeZoneBlocks(zone).includes(slot)) ?? 0;
  return Math.min(GAME_WIDTH - CHICKEN_SIZE, freeSlot * SAFE_SLOT_WIDTH + (SAFE_SLOT_WIDTH - CHICKEN_SIZE) / 2);
};

const INITIAL_SAFE_X = getSafeStartX(0);

const isBlockedSafeSpot = (x: number, zone: number): boolean => getSafeZoneBlocks(zone).some((slot) => {
  const blockLeft = slot * SAFE_SLOT_WIDTH + 4;
  return x + CHICKEN_SIZE > blockLeft && x < blockLeft + SAFE_BLOCK_WIDTH;
});

const VEHICLE_META: Record<VehicleType, { width: number; height: number; baseSpeed: number; color: string }> = {
  car: { width: 52, height: 26, baseSpeed: 2.2, color: '#f97316' },
  truck: { width: 72, height: 30, baseSpeed: 1.7, color: '#ef4444' },
  bike: { width: 40, height: 22, baseSpeed: 3.1, color: '#22c55e' },
};

type GameAudio = { context: AudioContext; background: OscillatorNode; gain: GainNode };

const startGameAudio = (): GameAudio | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.value = 0.025;
  gain.connect(context.destination);
  const background = context.createOscillator();
  background.type = 'triangle';
  background.frequency.value = 196;
  background.connect(gain);
  background.start();
  return { context, background, gain };
};

const playGameTone = (audio: GameAudio | null, frequency: number, duration: number) => {
  if (!audio) return;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.06, audio.context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audio.context.destination);
  oscillator.start();
  oscillator.stop(audio.context.currentTime + duration);
};

const stopGameAudio = (audio: GameAudio | null) => {
  if (!audio) return;
  audio.background.stop();
  void audio.context.close();
};

export default function ChickenCrossingScreen() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [cameraOffset, setCameraOffset] = useState(0);
  const [vehicleRenderTick, setVehicleRenderTick] = useState(0);
  const audioRef = useRef<GameAudio | null>(null);

  const chickenY = useRef(new Animated.Value(getRowTop(BOARD_ROWS - 1))).current;
  const chickenX = useRef(new Animated.Value(INITIAL_SAFE_X)).current;
  const vehiclesRef = useRef<Vehicle[]>([]);
  const scoreRef = useRef(0);
  const distanceRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef(false);
  const nextVehicleIdRef = useRef(1);
  const chickenXRef = useRef(INITIAL_SAFE_X);
  const gameOverRef = useRef(false);
  const pathIndexRef = useRef(BOARD_ROWS - 1);
  const zoneRef = useRef(0);
  const scoreTickRef = useRef(0);
  const safeZoneScoreRef = useRef(0);

  const clearLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearLoop();
    stopGameAudio(audioRef.current);
    audioRef.current = null;
  }, [clearLoop]);

  const spawnVehicle = useCallback((lane: number, direction: 1 | -1, forcedType?: VehicleType): Vehicle => {
    const type = forcedType ?? ((['car', 'truck', 'bike'] as VehicleType[])[Math.floor(Math.random() * 3)]);
    const meta = VEHICLE_META[type];
    const speed = meta.baseSpeed * (1.15 + Math.min(1.8, safeZoneScoreRef.current / 1500));
    return {
      id: nextVehicleIdRef.current++,
      row: lane + 1,
      x: direction === 1 ? -meta.width - 12 : GAME_WIDTH + 12,
      width: meta.width,
      height: meta.height,
      speed,
      type,
      direction,
      stopped: false,
    };
  }, []);

  const loadGameData = useCallback(async () => {
    try {
      setLoading(true);
      const bestResponse = await api.get('/games/personal-best?game_type=chicken_crossing');
      setPersonalBest(bestResponse.data.personal_best ?? 0);
      const leaderboardResponse = await api.get('/games/leaderboard?game_type=chicken_crossing');
      setLeaderboard(((leaderboardResponse.data.entries ?? []) as LeaderboardEntry[]).sort((left, right) => left.score - right.score).slice(-50));
    } catch {
      console.error('Error loading game data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGameData();
    }, [loadGameData])
  );

  const chickenPositionRef = useRef(getRowTop(BOARD_ROWS - 1));

  useEffect(() => {
    const subscription = chickenY.addListener(({ value }) => {
      chickenPositionRef.current = value;
    });
    return () => chickenY.removeListener(subscription);
  }, [chickenY]);

  const checkCollision = useCallback(() => {
    const chickenTop = chickenPositionRef.current;
    const chickenBottom = chickenTop + CHICKEN_SIZE;
    const chickenLeft = chickenXRef.current;
    const chickenRight = chickenLeft + CHICKEN_SIZE;
    const currentRow = pathIndexRef.current;
    if (currentRow <= 0 || currentRow >= BOARD_ROWS - 1) return false;

    for (const vehicle of vehiclesRef.current) {
      if (vehicle.row !== currentRow) continue;
      const laneTop = ROAD_TOP + (vehicle.row - 1) * LANE_HEIGHT;
      const laneBottom = laneTop + LANE_HEIGHT;
      const sameLane = chickenTop < laneBottom && chickenBottom > laneTop;
      if (!sameLane) continue;

      const vehicleLeft = vehicle.x;
      const vehicleRight = vehicle.x + vehicle.width;
      const overlaps = chickenRight > vehicleLeft && chickenLeft < vehicleRight;
      if (overlaps) {
        return true;
      }
    }

    return false;
  }, []);

  const syncScores = useCallback(async () => {
    try {
      setSyncing(true);
      const localScores = await getItem('local_game_scores');
      if (!localScores) return;
      const scores = JSON.parse(localScores) as (Record<string, unknown> & { synced?: boolean })[];
      const unsynced = scores.filter((s: any) => !s.synced);
      for (const score of unsynced) {
        try {
          await api.post('/games/scores', {
            game_type: String(score.game_type),
            score: Math.max(0, Math.floor(Number(score.score) || 0)),
            distance: Math.max(0, Math.floor(Number(score.distance) || 0)),
            survival_time: Math.max(0, Math.floor(Number(score.survival_time) || 0)),
            difficulty_level: Math.max(1, Math.floor(Number(score.difficulty_level) || 1)),
          });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('not high enough')) throw error;
        }
        score.synced = true;
        await setItem('local_game_scores', JSON.stringify(scores));
      }
      await loadGameData();
    } catch {
      console.error('Error syncing scores');
    } finally {
      setSyncing(false);
    }
  }, [loadGameData]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncScores();
    });
    return unsubscribe;
  }, [syncScores]);

  const endGame = useCallback(async () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    playingRef.current = false;
    clearLoop();
    setGameState('gameOver');
    playGameTone(audioRef.current, 110, 0.35);
    setIsNewBest(scoreRef.current > personalBest);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

    const survivalTime = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);

    const localScores = await getItem('local_game_scores');
    const scores = localScores ? JSON.parse(localScores) : [];
    scores.push({
      game_type: 'chicken_crossing',
      score: scoreRef.current,
      distance: distanceRef.current,
      survival_time: survivalTime,
      difficulty_level: Math.max(1, Math.ceil(Math.max(1, scoreRef.current / 80))),
      synced: false,
      played_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    await setItem('local_game_scores', JSON.stringify(scores));
    setLeaderboard((entries) => [...entries, { rank: 0, user_name: 'Vous', score: scoreRef.current, distance: distanceRef.current, survival_time: survivalTime, played_at: new Date().toISOString() }].sort((left, right) => left.score - right.score).slice(-50).map((entry, index) => ({ ...entry, rank: index + 1 })));
    setPersonalBest((best) => Math.max(best, scoreRef.current));
    await syncScores();
    stopGameAudio(audioRef.current);
    audioRef.current = null;
  }, [clearLoop, personalBest, syncScores]);

  const resetGame = useCallback(() => {
    playingRef.current = false;
    gameOverRef.current = false;
    setIsNewBest(false);
    clearLoop();
    stopGameAudio(audioRef.current);
    audioRef.current = null;
    setGameState('menu');
    vehiclesRef.current = [];
    scoreTickRef.current = 0;
    safeZoneScoreRef.current = 0;
    pathIndexRef.current = BOARD_ROWS - 1;
    zoneRef.current = 0;
    setCameraOffset(0);
    chickenXRef.current = INITIAL_SAFE_X;
    chickenX.setValue(INITIAL_SAFE_X);
    Animated.timing(chickenY, {
      toValue: getRowTop(BOARD_ROWS - 1),
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, [clearLoop, chickenX, chickenY]);

  const updateGame = useCallback(() => {
    if (!playingRef.current) return;

    const nextVehicles = vehiclesRef.current.map((vehicle, index, allVehicles) => {
      const meeting = allVehicles.some((other, otherIndex) => {
        if (index === otherIndex || other.row !== vehicle.row || other.direction === vehicle.direction) return false;
        const gap = vehicle.direction === 1 ? other.x - (vehicle.x + vehicle.width) : vehicle.x - (other.x + other.width);
        return gap >= -4 && gap <= 8;
      });
      return { ...vehicle, stopped: meeting, x: meeting ? vehicle.x : vehicle.x + vehicle.direction * vehicle.speed } as Vehicle;
    });

    const activeVehicles = nextVehicles.filter(
      (vehicle) => vehicle.direction === 1 ? vehicle.x < GAME_WIDTH + vehicle.width + 30 : vehicle.x > -vehicle.width - 30
    );

    const vehicleTarget = Math.min(18, 5 + Math.floor(distanceRef.current / 30));
    while (activeVehicles.length < vehicleTarget) {
      const lane = Math.floor(Math.random() * ROAD_ROWS);
      const direction: 1 | -1 = lane % 2 === 0 ? 1 : -1;
      activeVehicles.push(spawnVehicle(lane, direction));
    }

    vehiclesRef.current = activeVehicles;
    setVehicleRenderTick((tick) => tick + 1);
    scoreTickRef.current += 1;
    scoreRef.current = safeZoneScoreRef.current;
    setScore(scoreRef.current);

    if (checkCollision()) {
      void endGame();
    }
  }, [checkCollision, endGame, spawnVehicle]);

  const startGame = useCallback(() => {
    playingRef.current = true;
    gameOverRef.current = false;
    setIsNewBest(false);
    setGameState('playing');
    stopGameAudio(audioRef.current);
    try {
      audioRef.current = startGameAudio();
    } catch {
      audioRef.current = null;
    }
    scoreRef.current = 0;
    scoreTickRef.current = 0;
    safeZoneScoreRef.current = 0;
    distanceRef.current = 0;
    pathIndexRef.current = BOARD_ROWS - 1;
    zoneRef.current = 0;
    setCameraOffset(0);
    chickenXRef.current = INITIAL_SAFE_X;
    chickenX.setValue(INITIAL_SAFE_X);
    setScore(0);
    startTimeRef.current = Date.now();

    vehiclesRef.current = Array.from({ length: 5 }, (_, index) => {
      const lane = index % ROAD_ROWS;
      const direction: 1 | -1 = lane % 2 === 0 ? 1 : -1;
      return spawnVehicle(lane, direction);
    });

    Animated.timing(chickenY, {
      toValue: getRowTop(BOARD_ROWS - 1),
      duration: 0,
      useNativeDriver: false,
    }).start();

    clearLoop();
    loopRef.current = setInterval(() => {
      if (playingRef.current) {
        updateGame();
      }
    }, 30);
  }, [chickenX, chickenY, clearLoop, spawnVehicle, updateGame]);

  const moveChicken = useCallback((direction: 'up' | 'down') => {
    if (!playingRef.current) return;

    const nextIndex = pathIndexRef.current + (direction === 'up' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= BOARD_ROWS) return;
    const nextSafe = nextIndex === 0 || nextIndex === BOARD_ROWS - 1;
    if (nextSafe && isBlockedSafeSpot(chickenXRef.current, zoneRef.current + (nextIndex === 0 ? 1 : 0))) return;
    const reachedSafeZone = nextIndex === 0;
    if (reachedSafeZone) {
      distanceRef.current += 10;
      safeZoneScoreRef.current += 100 + distanceRef.current;
      scoreRef.current = safeZoneScoreRef.current;
      setScore(scoreRef.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playGameTone(audioRef.current, 660, 0.18);
      zoneRef.current += 1;
      pathIndexRef.current = BOARD_ROWS - 1;
      chickenXRef.current = getSafeStartX(zoneRef.current);
      chickenX.setValue(chickenXRef.current);
      setCameraOffset(0);
      Animated.timing(chickenY, { toValue: getRowTop(BOARD_ROWS - 1), duration: 120, useNativeDriver: false }).start();
      return;
    }
    pathIndexRef.current = nextIndex;
    const targetY = getRowTop(nextIndex);
    playGameTone(audioRef.current, 520, 0.08);
    setCameraOffset(Math.max(0, targetY - 220));

    Animated.timing(chickenY, {
      toValue: targetY,
      duration: 120,
      useNativeDriver: false,
    }).start(() => {
      if (checkCollision()) {
        void endGame();
      }
    });
  }, [checkCollision, chickenX, chickenY, endGame]);

  const moveChickenHorizontal = useCallback((direction: 'left' | 'right') => {
    if (!playingRef.current) return;
    const nextX = Math.max(0, Math.min(GAME_WIDTH - CHICKEN_SIZE, chickenXRef.current + (direction === 'left' ? -42 : 42)));
    const currentRow = pathIndexRef.current;
    if ((currentRow === 0 || currentRow === BOARD_ROWS - 1) && isBlockedSafeSpot(nextX, zoneRef.current)) return;
    chickenXRef.current = nextX;
    playGameTone(audioRef.current, 440, 0.08);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(chickenX, { toValue: nextX, duration: 100, useNativeDriver: false }).start(() => {
      if (checkCollision()) void endGame();
    });
  }, [checkCollision, chickenX, endGame]);

  const visibleRows = Array.from({ length: BOARD_ROWS }, (_, row) => row);
  const filteredLeaderboard = leaderboard.filter((entry) => {
    const query = leaderboardSearch.trim().toLowerCase();
    return !query || `${entry.user_name} ${entry.score} ${entry.distance} ${entry.survival_time}`.toLowerCase().includes(query);
  });

  return (
    <View style={styles.container}>
      {gameState === 'menu' && (
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <MaterialIcons name="flutter-dash" size={48} color={Colors.primary} />
              <Text style={styles.gameTitle}>Chicken Crossing</Text>
            </View>
          </View>

          <View style={styles.menuSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Meilleur score</Text>
              <Text style={styles.infoBigNumber}>{personalBest}</Text>
            </View>

            <PrimaryButton label="Jouer" onPress={startGame} icon="play-arrow" style={{ marginBottom: Spacing.lg }} />

            <Text style={styles.highscoreHeading}>Meilleurs scores</Text>
            {leaderboard.slice(0, 5).map((entry) => <View key={`${entry.rank}-${entry.played_at}`} style={styles.highscoreRow}><Text style={styles.playerName}>{entry.user_name}</Text><Text style={styles.playerScore}>{entry.score} pts</Text></View>)}

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowLeaderboard(true)}>
              <MaterialIcons name="leaderboard" size={20} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>Classement</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
            ) : syncing ? (
              <View style={styles.syncingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.syncingText}>Synchronisation…</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {gameState === 'playing' && (
        <View style={styles.gameContainer}>
          <View style={styles.scoreBar}>
            <View><Text style={styles.scoreLabel}>CHECKPOINTS</Text><Text style={styles.scoreText}>{score} pts</Text></View>
            <TouchableOpacity onPress={() => {
              playingRef.current = false;
              setGameState('paused');
            }}>
              <MaterialIcons name="pause" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.gameArea}>
            <View style={[styles.gameWorld, { height: GAME_HEIGHT, transform: [{ translateY: -cameraOffset }] }]}> 
              {visibleRows.map((row) => (
                <React.Fragment key={`row-${row}`}>
                  {(row === 0 || row === BOARD_ROWS - 1) && <View style={[styles.safeZone, { top: row * ROW_HEIGHT }]}>{getSafeZoneBlocks(zoneRef.current + (row === 0 ? 1 : 0)).map((slot) => <View key={slot} style={[styles.safeBlock, { left: slot * SAFE_SLOT_WIDTH + 4, width: SAFE_BLOCK_WIDTH }]} />)}</View>}
                  {row > 0 && row < BOARD_ROWS - 1 && <View style={[styles.laneLine, { top: row * ROW_HEIGHT }]} />}
                </React.Fragment>
              ))}

              {vehicleRenderTick >= 0 && vehiclesRef.current.map((vehicle) => (
              <View
                key={vehicle.id}
                style={[
                  styles.vehicle,
                  {
                    left: vehicle.x,
                    top: vehicle.row * ROW_HEIGHT + (ROW_HEIGHT - vehicle.height) / 2,
                    width: vehicle.width,
                    height: vehicle.height,
                    backgroundColor: VEHICLE_META[vehicle.type].color,
                  },
                ]}
              >
                <MaterialIcons
                  name={vehicle.type === 'bike' ? 'two-wheeler' : vehicle.type === 'truck' ? 'local-shipping' : 'directions-car'}
                  size={vehicle.type === 'bike' ? 18 : 26}
                  color="#fff"
                />
              </View>
              ))}

              <Animated.View
              style={[
                styles.chicken,
                {
                  left: chickenX,
                  top: chickenY,
                },
              ]}
            >
              <Text style={styles.chickenEmoji}>🐔</Text>
              </Animated.View>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => moveChickenHorizontal('left')}>
              <MaterialIcons name="keyboard-arrow-left" size={30} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => moveChicken('up')}>
              <MaterialIcons name="keyboard-arrow-up" size={30} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => moveChicken('down')}>
              <MaterialIcons name="keyboard-arrow-down" size={30} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => moveChickenHorizontal('right')}>
              <MaterialIcons name="keyboard-arrow-right" size={30} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {gameState === 'gameOver' && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Partie terminée</Text>
          <View style={styles.finalScoreCard}>
            <Text style={styles.finalScoreLabel}>Score final</Text>
            <Text style={styles.finalScoreValue}>{scoreRef.current}</Text>
            <Text style={styles.finalScoreSubtext}>Distance: {distanceRef.current} m</Text>
          </View>

          {isNewBest && (
            <View style={styles.newBestCard}>
              <MaterialIcons name="star" size={24} color={Colors.primary} />
              <Text style={styles.newBestText}>Nouveau meilleur score !</Text>
            </View>
          )}

          <PrimaryButton label="Voir le classement" onPress={() => setShowLeaderboard(true)} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.highscoreHeading}>Meilleurs scores</Text>
          {leaderboard.slice(0, 5).map((entry) => <View key={`${entry.rank}-${entry.played_at}`} style={styles.highscoreRow}><Text style={styles.playerName}>{entry.user_name}</Text><Text style={styles.playerScore}>{entry.score} pts</Text></View>)}
          <PrimaryButton label="Rejouer" onPress={startGame} style={{ marginTop: Spacing.lg, marginBottom: Spacing.lg }} />
          <TouchableOpacity style={styles.secondaryButton} onPress={resetGame}>
            <MaterialIcons name="home" size={20} color={Colors.primary} />
            <Text style={styles.secondaryButtonText}>Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {gameState === 'paused' && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseCard}>
              <Text style={styles.pauseTitle}>En pause</Text>
              <Text style={styles.pauseScore}>Score: {score}</Text>
              <PrimaryButton label="Reprendre" onPress={() => {
                playingRef.current = true;
                setGameState('playing');
                clearLoop();
                loopRef.current = setInterval(() => {
                  if (playingRef.current) {
                    updateGame();
                  }
                }, 30);
              }} style={{ marginBottom: Spacing.lg }} />
              <TouchableOpacity style={styles.secondaryButton} onPress={resetGame}>
                <MaterialIcons name="home" size={20} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal transparent animationType="slide" visible={showLeaderboard} onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Classement</Text>
              <TouchableOpacity onPress={() => setShowLeaderboard(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.leaderboardSearchBox}>
                <MaterialIcons name="search" size={19} color={Colors.outline} />
                <TextInput
                  style={styles.leaderboardSearchInput}
                  placeholder="Rechercher un joueur..."
                  placeholderTextColor={Colors.outline}
                  value={leaderboardSearch}
                  onChangeText={setLeaderboardSearch}
                />
                {leaderboardSearch.length > 0 && <TouchableOpacity onPress={() => setLeaderboardSearch('')} hitSlop={8}><MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} /></TouchableOpacity>}
              </View>
              {filteredLeaderboard.length === 0 ? (
                <Text style={styles.emptyText}>Aucun score pour l’instant</Text>
              ) : (
                filteredLeaderboard.map((entry) => (
                  <View key={`${entry.user_name}-${entry.played_at}`} style={styles.leaderboardRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{entry.rank}</Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{entry.user_name}</Text>
                      <Text style={styles.playerScore}>{entry.score} pts</Text>
                    </View>
                    <View style={styles.distanceBlock}><Text style={styles.distanceLabel}>Distance</Text><Text style={styles.playerDistance}>{entry.distance} m</Text></View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={() => setShowLeaderboard(false)}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { flex: 1 },
  header: { paddingTop: Spacing.lg, paddingHorizontal: Spacing.containerPadding, paddingBottom: Spacing.md, gap: Spacing.md },
  headerContent: { alignItems: 'center', gap: Spacing.md },
  gameTitle: { ...Typography.headlineLarge, color: Colors.primary },
  menuSection: { padding: Spacing.containerPadding, gap: Spacing.lg, justifyContent: 'center' },
  infoCard: { backgroundColor: Colors.primaryContainer, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  infoLabel: { ...Typography.labelMedium, color: Colors.onPrimaryContainer },
  infoBigNumber: { ...Typography.displayMedium, color: Colors.primary },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.lg, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.primary },
  secondaryButtonText: { ...Typography.labelLarge, color: Colors.primary },
  syncingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  syncingText: { ...Typography.labelSmall, color: Colors.onSurfaceVariant },
  gameContainer: { flex: 1, gap: Spacing.md, padding: Spacing.containerPadding },
  scoreBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceContainerLowest, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
  scoreLabel: { ...Typography.labelSmall, color: Colors.onSurfaceVariant },
  scoreText: { ...Typography.titleLarge, color: Colors.primary },
  gameArea: { width: GAME_WIDTH, height: GAME_HEIGHT, backgroundColor: '#d8d8d8', borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: Colors.primary },
  gameWorld: { position: 'absolute', width: GAME_WIDTH, height: GAME_HEIGHT },
  safeZone: { position: 'absolute', left: 0, right: 0, height: ROW_HEIGHT, backgroundColor: '#a7f3d0', flexDirection: 'row', alignItems: 'center' },
  safeBlock: { position: 'absolute', width: 30, height: 30, borderRadius: 4, backgroundColor: '#65a30d', opacity: 0.75 },
  laneLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
  chicken: { width: CHICKEN_SIZE, height: CHICKEN_SIZE, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  chickenEmoji: { fontSize: 28 },
  highscoreHeading: { ...Typography.titleMedium, color: Colors.onSurface, marginBottom: Spacing.sm },
  highscoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  vehicle: { position: 'absolute', borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  controls: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' },
  controlButton: { width: 70, height: 70, borderRadius: Radius.xl, backgroundColor: Colors.primaryContainer, justifyContent: 'center', alignItems: 'center' },
  gameOverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.containerPadding, gap: Spacing.lg },
  gameOverTitle: { ...Typography.displaySmall, color: Colors.error },
  finalScoreCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', width: '100%' },
  finalScoreLabel: { ...Typography.labelMedium, color: Colors.onSurfaceVariant },
  finalScoreValue: { ...Typography.displayLarge, color: Colors.primary },
  finalScoreSubtext: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: Spacing.sm },
  newBestCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primaryContainer, padding: Spacing.lg, borderRadius: Radius.lg, width: '100%' },
  newBestText: { ...Typography.titleMedium, color: Colors.primary },
  pauseOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  pauseCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.lg, width: '80%' },
  pauseTitle: { ...Typography.displaySmall, color: Colors.onSurface },
  pauseScore: { ...Typography.titleLarge, color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', width: '100%', backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: 10, paddingBottom: 24 },
  modalHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: Colors.outlineVariant, alignSelf: 'center', marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.containerPadding, marginBottom: Spacing.lg },
  modalTitle: { ...Typography.titleMedium, color: Colors.onSurface },
  modalScroll: { maxHeight: '80%' },
  modalContent: { paddingHorizontal: Spacing.containerPadding, gap: Spacing.md },
  emptyText: { ...Typography.bodyMedium, color: Colors.onSurfaceVariant, textAlign: 'center', paddingVertical: Spacing.lg },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceContainer, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
  leaderboardSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, paddingHorizontal: 12, backgroundColor: Colors.surfaceContainerLowest },
  leaderboardSearchInput: { flex: 1, color: Colors.onSurface, fontSize: 14 },
  rankBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  rankText: { ...Typography.labelSmall, color: Colors.onPrimary, fontWeight: '600' },
  playerInfo: { flex: 1 },
  playerName: { ...Typography.titleSmall, color: Colors.onSurface },
  playerScore: { ...Typography.labelSmall, color: Colors.primary },
  playerDistance: { ...Typography.labelMedium, color: Colors.onSurfaceVariant },
  distanceBlock: { alignItems: 'flex-end', minWidth: 64 },
  distanceLabel: { ...Typography.labelSmall, color: Colors.onSurfaceVariant },
  closeButton: { marginTop: Spacing.lg, marginHorizontal: Spacing.containerPadding, paddingVertical: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, alignItems: 'center' },
  closeButtonText: { color: Colors.onPrimary, fontWeight: '700' },
});
