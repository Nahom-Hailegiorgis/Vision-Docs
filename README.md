# Vision-Docs

> 📱 MVP 1.0 Complete | 🔊 Spatial Audio Feedback | 📸 Real-time Object Detection

**Vision** is an assistive mobile app designed to help visually impaired users navigate their environment. Using the device’s rear camera and object recognition, it detects obstacles and gives **audio cues** based on their **type, height, and distance**.

---

## 🎯 Project Goals

- Help users detect and recognize nearby obstacles in real time
- Use Google Vision API to identify objects in the camera frame
- Generate **3D audio cues**:
  - 🔊 Louder for closer objects
  - 🧊 Quieter for farther ones
  - 🎵 Different tones for obstacle height/type (e.g. ceiling vs backpack)

---

## 🎥 MVP 1.0 Demo

👉 [Watch the video demo](#)  
_https://drive.google.com/drive/u/2/folders/1Xikn3wVwp_KvkbVzWfj6FmeFWxJ9daFt

---

## 🧠 How It Works (Simplified)

1. **User presses "Snapshot" button**
2. A single image is captured by the rear camera
3. The image is sent to the **Google Vision API**
4. Identified objects are:
   - Categorized by height/location (high, mid, low, flat)
   - Filtered by **proximity threshold**
5. **Unique sounds** play depending on:
   - Obstacle height
   - Type
   - Distance (volume modulation)

---

## 🔨 Current Features

- Rear-camera snapshot system
- Google Vision API integration
- Object category + height recognition
- Distance-aware sound feedback
- Differentiated sounds for multiple obstacles per frame

---

## 🚧 In Progress (Upcoming Upgrades)

- Continuous detection mode
- Real-time obstacle tracking
- Adaptive sound generation with spatial awareness
- Smarter distance estimation (depth sensing)
- Custom audio profiles per user

---

## 💡 Use Cases

- Navigation aid for people with visual impairments
- Obstacle detection in low-light environments
- Educational or accessibility-enhancing tool

---

## 🛑 Code Availability

The source code is private during early-stage development.  
If you're interested in contributing, collaborating, or learning more, feel free to [contact me](#).

---

## 📅 Development Log (Optional)

Check `timeline.md` for week-by-week progress and updates.  
→ _Coming soon._

---

## 🧠 Tech Stack

| Purpose            | Tool/Library        |
|--------------------|---------------------|
| Object Detection   | Google Cloud Vision |
| Audio Feedback     | Custom Sound Engine |
| App Platform       | React Native (Expo) |
| Device Input       | Mobile Camera API   |

---

## 📫 Contact

📧 Email: [nahomh1847@gmail.com]  
🔗 LinkedIn: [Your LinkedIn Profile](https://www.linkedin.com/in/nahom-hailegiorgis/)

---
