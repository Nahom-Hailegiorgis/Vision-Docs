// App.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import { GOOGLE_VISION_API_KEY } from "@env";

const THEME_COLORS = {
  background: "#121212", // Dark background
  panel: "#1e1e1e", // Slightly lighter panel
  primary: "#4CAF50", // Main action (e.g. buttons)
  secondary: "#9E9E9E", // Muted or subtext
  accent: "#FFC107", // Highlights, icons, accents
  text: "#FFFFFF", // Primary text
  detailText: "#B0BEC5", // Label/confidence info
  error: "#F44336", // Error text or icons
  success: "#00E676", // Success indicators (like %)
};

const OBSTACLE_MAP = {
  stairs: ["stairs", "staircase", "step"],
  wall: ["wall", "door", "window", "partition"],
  low: [
    "shoe",
    "bed",
    "floor",
    "box",
    "backpack",
    "bottle",
    "cabinet",
    "dresser",
    "chest of drawers",
    "rug",
    "mat",
    "robot vacuum",
    "dog",
    "cat",
    "toy",
    "bag",
    "table",
  ],
  head: [
    "lamp",
    "fan",
    "ceiling fan",
    "tv",
    "doorframe",
    "shelf",
    "cabinetry",
    "lighting",
    "mirror",
    "hanger",
    "clothing",
    "curtain rod",
    "window blind",
  ],
  ceiling: ["ceiling", "ceiling light", "light fixture", "chandelier"],
};

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);
  const [obstacleLabel, setObstacleLabel] = useState("");

  // New state for dropdown and labels
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [labelAnnotations, setLabelAnnotations] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const dropdownWidth = useRef(new Animated.Value(0)).current;

  // Map obstacle "types" to filenames and Audio.Sound instances
  const SOUND_FILES = {
    stairs: require("./assets/sounds/whistle.wav"),
    wall: require("./assets/sounds/thud.wav"),
    low: require("./assets/sounds/click.wav"),
    head: require("./assets/sounds/beep.wav"),
    ceiling: require("./assets/sounds/swoosh.wav"),
    default: require("./assets/sounds/beep.wav"),
  };
  const soundMapRef = useRef({});

  // Permission hook
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // 1) Request permission & preload all sounds
  useEffect(() => {
    if (permission === null) return;

    setHasPermission(permission.granted);
    if (!permission.granted) requestPermission();

    // Preload each sound into our map
    (async () => {
      const map = {};
      for (const [type, file] of Object.entries(SOUND_FILES)) {
        const sound = new Audio.Sound();
        await sound.loadAsync(file);
        map[type] = sound;
      }
      soundMapRef.current = map;
    })();
  }, [permission]);

  // Toggle dropdown animation
  const toggleDropdown = () => {
    const targetWidth = isDropdownOpen ? 0 : 300;
    setIsDropdownOpen(!isDropdownOpen);

    Animated.timing(dropdownWidth, {
      toValue: targetWidth,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Calculate confidence score based on detection quality
  const calculateConfidenceScore = (objs, labels, volumeUsed) => {
    if (objs.length === 0 && labels.length === 0) return 0;

    // Base score from label confidence
    const avgLabelConfidence =
      labels.length > 0
        ? labels.reduce((sum, label) => sum + (label.score || 0), 0) /
          labels.length
        : 0;

    // Object detection bonus (if objects were found)
    const objectBonus = objs.length > 0 ? 0.15 : 0;

    // Volume scaling bonus (indicates proper distance calculation)
    const volumeBonus = volumeUsed > 0.1 && volumeUsed < 1.0 ? 0.1 : 0;

    // Final score calculation
    const finalScore = Math.min(
      (avgLabelConfidence + objectBonus + volumeBonus) * 100,
      100
    );
    return Math.round(finalScore);
  };

  // 2) Classification logic
  function classify(objs = [], labels = []) {
    const objectNames = objs.map((obj) => obj.name.toLowerCase());
    const labelNames = labels.map((label) => label.description.toLowerCase());

    // Combine both sets of names
    const allNames = [...objectNames, ...labelNames];

    for (const [type, keywords] of Object.entries(OBSTACLE_MAP)) {
      if (allNames.some((name) => keywords.some((kw) => name.includes(kw)))) {
        return type;
      }
    }

    return "default";
  }

  // 3) Detect & play
  const detectObstacle = async () => {
    if (!cameraRef.current) return;
    setLoading(true);

    try {
      // snap + base64
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipMetadata: true,
        base64: true,
      });

      // ask for both localization & labels
      const body = {
        requests: [
          {
            image: { content: photo.base64 },
            features: [
              { type: "OBJECT_LOCALIZATION", maxResults: 5 },
              { type: "LABEL_DETECTION", maxResults: 10 },
            ],
          },
        ],
      };

      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      const resp = json.responses?.[0] || {};
      const objs = resp.localizedObjectAnnotations || [];
      const labels = resp.labelAnnotations || [];

      // Update label annotations for dropdown
      setLabelAnnotations(labels);

      let volumeUsed = 1.0;

      // Check if we have ANY detection (objects OR labels)
      if (objs.length === 0 && labels.length === 0) {
        // Truly nothing detected
        console.log("No obstacle detected");
        setObstacleLabel("");
      } else if (objs.length === 0 && labels.length > 0) {
        // Labels detected but no localized objects - still play sound based on labels
        const type = classify(objs, labels);
        const labelNames = labels
          .slice(0, 3)
          .map((label) => label.description)
          .join(", ");

        setObstacleLabel(`${type.toUpperCase()}: ${labelNames}`);

        console.log("== LABELS DETECTED (NO OBJECTS) ==");
        console.log(
          "Label Annotations:",
          labels.map((label) => label.description)
        );
        console.log("Classified Type:", type);
        console.log(
          "Playing sound:",
          SOUND_FILES[type] ? `${type}.wav` : "default.wav"
        );

        const sound = soundMapRef.current[type] || soundMapRef.current.default;
        volumeUsed = 0.8; // Default volume for label-only detections

        await sound.stopAsync();
        await sound.setIsMutedAsync(false);
        await sound.setVolumeAsync(volumeUsed);
        await sound.playAsync();
      } else {
        // Objects detected - use existing logic
        const type = classify(objs, labels);

        setObstacleLabel(
          `${type.toUpperCase()}: ${objs.map((obj) => obj.name).join(", ")}`
        );

        console.log("== OBSTACLE DETECTED ==");
        console.log(
          "Localized Objects:",
          objs.map((obj) => obj.name)
        );
        console.log(
          "Label Annotations:",
          labels.map((label) => label.description)
        );
        console.log("Classified Type:", type);
        console.log(
          "Playing sound:",
          SOUND_FILES[type] ? `${type}.wav` : "default.wav"
        );

        const sound = soundMapRef.current[type] || soundMapRef.current.default;

        const boundingBox = objs[0].boundingPoly.normalizedVertices;
        if (boundingBox.length >= 4) {
          const width = Math.abs(boundingBox[2].x - boundingBox[0].x);
          const height = Math.abs(boundingBox[2].y - boundingBox[0].y);
          const area = width * height;
          const rawVolume = Math.sqrt(area) * 1.5;
          volumeUsed = Math.min(Math.max(rawVolume, 0.1), 1.0);

          console.log("Object area:", area.toFixed(4));
          console.log("Volume based on distance:", volumeUsed.toFixed(2));
        }

        await sound.stopAsync(); // STOP any current playback
        await sound.setIsMutedAsync(false); // ENSURE sound is unmuted
        await sound.setVolumeAsync(volumeUsed); // SET volume BEFORE playing
        await sound.playAsync(); // PLAY fresh
      }

      // Calculate and update confidence score
      const confidence = calculateConfidenceScore(objs, labels, volumeUsed);
      setConfidenceScore(confidence);
    } catch (err) {
      console.error("Detection error", err);
      setConfidenceScore(0);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View
        style={[styles.center, { backgroundColor: THEME_COLORS.background }]}
      >
        <Text style={[styles.text, { color: THEME_COLORS.text }]}>
          Requesting camera access…
        </Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View
        style={[styles.center, { backgroundColor: THEME_COLORS.background }]}
      >
        <Text style={[styles.text, { color: THEME_COLORS.error }]}>
          No access to camera
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: THEME_COLORS.background }]}
    >
      {/* Obstacle Label Display - Always visible */}
      <View
        style={[
          styles.labelContainer,
          { backgroundColor: THEME_COLORS.panel + "CC" },
        ]}
      >
        <Text style={[styles.labelText, { color: THEME_COLORS.text }]}>
          {obstacleLabel || "No obstacles detected"}
        </Text>

        {/* Horizontal Dropdown Panel - Under obstacle text */}
        <View style={styles.dropdownContainer}>
          {/* Left Arrow */}
          <TouchableOpacity
            style={[
              styles.arrowButton,
              { backgroundColor: THEME_COLORS.accent },
            ]}
            onPress={toggleDropdown}
          >
            <Text
              style={[styles.arrowText, { color: THEME_COLORS.background }]}
            >
              {isDropdownOpen ? "◄" : "►"}
            </Text>
          </TouchableOpacity>

          {/* Animated Horizontal Scroll Panel */}
          <Animated.View
            style={[
              styles.dropdownPanel,
              {
                width: dropdownWidth,
                backgroundColor: THEME_COLORS.panel,
              },
            ]}
          >
            <ScrollView
              horizontal
              style={styles.dropdownScroll}
              showsHorizontalScrollIndicator={false}
            >
              {labelAnnotations.map((label, index) => (
                <View key={index} style={styles.labelChip}>
                  <Text
                    style={[
                      styles.labelItem,
                      { color: THEME_COLORS.detailText },
                    ]}
                  >
                    {label.description}
                  </Text>
                  <Text
                    style={[
                      styles.confidenceChip,
                      { color: THEME_COLORS.success },
                    ]}
                  >
                    {(label.score * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
              {labelAnnotations.length === 0 && (
                <View style={styles.labelChip}>
                  <Text
                    style={[
                      styles.noLabelsText,
                      { color: THEME_COLORS.secondary },
                    ]}
                  >
                    No labels yet
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>

          {/* Right Arrow (when open) */}
          {isDropdownOpen && (
            <TouchableOpacity
              style={[
                styles.arrowButton,
                { backgroundColor: THEME_COLORS.accent },
              ]}
              onPress={toggleDropdown}
            >
              <Text
                style={[styles.arrowText, { color: THEME_COLORS.background }]}
              >
                ◄
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <CameraView ref={cameraRef} style={styles.camera} cameraRatio="16:9" />

      {/* Button and Confidence Score Container */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: THEME_COLORS.primary }]}
          onPress={detectObstacle}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={THEME_COLORS.text} />
          ) : (
            <Text style={[styles.buttonText, { color: THEME_COLORS.text }]}>
              Scan for Obstacles
            </Text>
          )}
        </TouchableOpacity>

        {/* Confidence Score Display */}
        {confidenceScore > 0 && (
          <Text
            style={[styles.confidenceText, { color: THEME_COLORS.success }]}
          >
            Confidence: {confidenceScore}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
  },

  // Label container styles
  labelContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 999,
    minHeight: 50,
  },
  labelText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },

  // Horizontal dropdown styles
  dropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  arrowText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  dropdownPanel: {
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    opacity: 0.95,
    marginHorizontal: 4,
  },
  dropdownScroll: {
    flex: 1,
    paddingHorizontal: 8,
  },
  labelChip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 24,
  },
  labelItem: {
    fontSize: 11,
    fontWeight: "500",
    marginRight: 4,
  },
  confidenceChip: {
    fontSize: 10,
    fontWeight: "600",
  },
  noLabelsText: {
    fontSize: 11,
    fontStyle: "italic",
  },

  // Bottom container for button and confidence
  bottomContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 997,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
});
