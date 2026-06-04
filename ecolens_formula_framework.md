# EcoLens System: Standardized Formula Framework

This document outlines the standardized, optimized formula framework designed specifically for the **EcoLens** system. It is engineered to accurately process data from OpenWeatherMap, eliminate double-counting, and guarantee that environmental disasters are never overlooked.

This logic can be directly integrated into the Backend service.

---

## Step 1: Calculate Base Risk Scores (Base Risk)

Compute the baseline risk levels for Temperature and $	ext{PM}_{2.5}$ based on biological safety thresholds. An exponential factor ensures risk scores spike drastically when safety thresholds are breached.

### 1. Fine Particulate Matter ($	ext{PM}_{2.5}$) Risk
Based on the WHO standard threshold of 25 $\mu	ext{g/m}^3$.

$$R_{PM2.5} = \left(\frac{PM_{2.5}}{25}\right)^{1.5}$$

### 2. Temperature Risk
Based on the biologically ideal temperature of 22°C.

$$R_{Temp} = \left(\frac{|T - 22|}{10}\right)^2$$

---

## Step 2: Calculate City Risk Score (CRS)

Combines the AQI amplification factor and a protection floor (Risk Floor) to calculate the composite score for a specific city.

$$CRS = \max \left[ \left( \max(R_{PM2.5}, R_{Temp}) \times (1 + 0.15 \times (AQI - 1)) \right), (AQI)^2 \right]$$

### Operational Logic
* **Amplification:** The system identifies the maximum risk between Temperature and $	ext{PM}_{2.5}$, then applies an amplification factor of up to 60% based on the overall AQI severity (scaled from 1 to 5).
* **Safety Floor:** If both $	ext{PM}_{2.5}$ and Temperature are perfectly safe ($R = 0$) but an alternative toxic gas leak drives the AQI up to 5, the outer $\max$ function activates, setting the safety floor to $5^2 = 25$ points. This prevents catastrophic edge cases from being ignored.

---

## Step 3: Calculate National Risk Index (NRI)

Aggregates the scores of 3 major/subordinate cities using the **Root Mean Square (RMS)** method instead of a standard arithmetic mean.

$$NRI = \sqrt{\frac{CRS_1^2 + CRS_2^2 + CRS_3^2}{3}}$$

### Why use RMS?
This method prioritizes extreme values (outliers). If two cities are perfectly safe (low scores) but one city is experiencing a severe wildfire or critical pollution (very high score), the NRI will still be pulled up to an alarm level. This ensures the 3D globe accurately reflects real-world environmental emergencies.

---

## UI Visualization on the EcoLens 3D Globe

Since this is an open-ended scale (unbounded growth), you can map the NRI to specific color gradients on the Frontend as follows:

| NRI (Eco Score) | Status | Globe Display Color (Polygon) | Visual Effects / Notes |
| :--- | :--- | :--- | :--- |
| **Under 1** | Ideal Safety | Light Green | Standard rendering |
| **1 to 4** | Low Risk | Dark Green | Standard rendering |
| **4 to 9** | Moderate Risk | Yellow / Orange | Standard rendering |
| **9 to 16** | Alarm / Alert | Red | High priority highlighting |
| **Over 16** | Environmental Disaster | Dark Red / Purple | Blinking / Pulsing animation effect |

---
*Document Version: 1.0.0* *Target System: EcoLens Backend & Frontend Integration* 