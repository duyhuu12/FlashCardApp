import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

interface WaterWaveNodeProps {
  percent: number; // 0 - 100
  nodeColor: string;
  shadowColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isUnlocked: boolean;
  isCheckpoint?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
}

export function WaterWaveNode({
  percent,
  nodeColor,
  shadowColor,
  iconName,
  isUnlocked,
  isCheckpoint = false,
  isActive = false,
  isCompleted = false,
}: WaterWaveNodeProps) {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  const showWaveAnimation = !isCompleted && isUnlocked;

  useEffect(() => {
    if (!showWaveAnimation) return;

    const loop1 = Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const loop2 = Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop1.start();
    loop2.start();

    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [showWaveAnimation, waveAnim1, waveAnim2]);

  const rotate1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const rotate2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  // Calculate liquid fill level for active / in-progress node
  const liquidPercent = isCompleted
    ? 100
    : isActive
      ? Math.max(45, Math.min(80, percent || 50))
      : Math.max(0, Math.min(100, percent));

  return (
    <View style={[styles.nodeShadow, { backgroundColor: shadowColor }]}>
      <View style={styles.nodeContainer}>
        {/* Completed Lesson: Solid Filled Node */}
        {isCompleted ? (
          <View style={[styles.solidFill, { backgroundColor: nodeColor }]} />
        ) : (
          <>
            {/* Base Background for Unfilled portion */}
            <View
              style={[
                styles.baseBg,
                { backgroundColor: isUnlocked ? `${nodeColor}33` : "#D8E0E8" },
              ]}
            />

            {/* Liquid Water Layer for Active / In-Progress Lesson */}
            {isUnlocked && liquidPercent > 0 && (
              <View
                style={[
                  styles.liquidFill,
                  {
                    height: `${liquidPercent}%`,
                    backgroundColor: nodeColor,
                  },
                ]}
              >
                {/* Dynamic Wave Surface Crests */}
                {showWaveAnimation && (
                  <>
                    <Animated.View
                      style={[
                        styles.waveCrest,
                        {
                          backgroundColor: nodeColor,
                          transform: [{ rotate: rotate1 }],
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.waveCrestSecondary,
                        {
                          backgroundColor: "rgba(255, 255, 255, 0.42)",
                          transform: [{ rotate: rotate2 }],
                        },
                      ]}
                    />
                  </>
                )}
              </View>
            )}
          </>
        )}

        {/* Icon Overlay */}
        <View style={styles.iconWrapper}>
          <Ionicons
            name={iconName}
            size={isCheckpoint ? 31 : 29}
            color="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}

const NODE_WIDTH = 84;
const NODE_HEIGHT = 76;
const WAVE_SIZE = 140;

const styles = StyleSheet.create({
  nodeShadow: {
    width: NODE_WIDTH,
    height: NODE_HEIGHT + 8,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 5,
  },
  nodeContainer: {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  solidFill: {
    ...StyleSheet.absoluteFillObject,
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
  },
  liquidFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "visible",
  },
  waveCrest: {
    position: "absolute",
    top: -WAVE_SIZE + 16,
    left: (NODE_WIDTH - WAVE_SIZE) / 2,
    width: WAVE_SIZE,
    height: WAVE_SIZE,
    borderRadius: WAVE_SIZE * 0.41,
  },
  waveCrestSecondary: {
    position: "absolute",
    top: -WAVE_SIZE + 20,
    left: (NODE_WIDTH - WAVE_SIZE) / 2,
    width: WAVE_SIZE,
    height: WAVE_SIZE,
    borderRadius: WAVE_SIZE * 0.43,
  },
  iconWrapper: {
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
});
