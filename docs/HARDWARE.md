# Hardware / Electrical Schematic — one representative room

This is a **concept/simulation** design. It shows how a microcontroller would
sense the on/off state (and optionally the current draw) of one room's five
devices — 2 fans + 3 lights — in real life. Per the brief, one room is enough;
the other two rooms are identical.

It's provided as a buildable spec — a bill of materials, a pin-mapping table, a
connection (net) list, and the electrical reasoning — so you can reproduce it in
**Wokwi** (recommended, has a real ESP32 with Wi-Fi) or **Tinkercad** (Arduino
Uno; no Wi-Fi, but fine for the sensing concept) in a few minutes and understand
every wire.

> ⚠️ **Safety:** real fans and lights run on AC mains. You must never wire mains
> directly to a microcontroller. Real deployments isolate the high-voltage side
> with opto-isolators, rated relays with position feedback, or a clamp-style
> current transformer. In this concept each device is modelled by a **switch**
> that stands in for "device is energised", which is exactly what the simulator
> represents in software.

## What we're sensing

Two independent things, either or both of which you can build:

1. **On/off state (digital)** — one GPIO input per device reads whether that
   device is energised. This is the core requirement.
2. **Current draw (analog, optional)** — one hall-effect current sensor
   (ACS712) on the room's supply feed lets the ESP32 estimate total room
   current, from which watts are derived.

## Bill of materials (one room)

| Qty | Part | Purpose |
| --- | --- | --- |
| 1 | ESP32 dev board (or Arduino Uno) | Reads states, would POST them to the backend |
| 5 | SPST slide/toggle switch | Models each device's on/off state |
| 5 | 10 kΩ resistor | Pull-down on each input (defined LOW when off) |
| 5 | LED + 220 Ω resistor *(optional)* | Visual indicator that mirrors each switch |
| 1 | ACS712 current sensor module *(optional)* | Senses room current for the watt estimate |
| — | Breadboard + jumper wires | — |

## Pin mapping (ESP32)

Chosen to avoid the ESP32 strapping pins (0, 2, 12, 15) and the input-only pins
(34–39) for the switch inputs, since those input-only pins have no internal
pull resistors. The optional analog input uses an ADC1 pin (ADC2 is unavailable
while Wi-Fi is active).

| Device  | ESP32 GPIO | Direction | Notes |
| ------- | ---------- | --------- | ----- |
| Fan 1   | GPIO 32    | Digital in | external 10 kΩ pull-down |
| Fan 2   | GPIO 33    | Digital in | external 10 kΩ pull-down |
| Light 1 | GPIO 25    | Digital in | external 10 kΩ pull-down |
| Light 2 | GPIO 26    | Digital in | external 10 kΩ pull-down |
| Light 3 | GPIO 27    | Digital in | external 10 kΩ pull-down |
| Room current (ACS712 OUT) | GPIO 34 | Analog in (ADC1_CH6) | input-only pin is fine for analog |

*(On an Arduino Uno instead: use D2–D6 for the five switches and A0 for the
ACS712 output. The wiring logic is identical.)*

## Connection list (net list)

Each device switch is wired so that **closed = ON = logic HIGH**, which keeps the
firmware readable (`digitalRead(pin) == HIGH` means on).

Per device *(repeat for Fan 1/2 and Light 1/2/3 on their mapped GPIOs)*:

| From | To | Via |
| ---- | -- | --- |
| 3V3 rail | switch terminal A | — |
| switch terminal B | mapped GPIO | — |
| mapped GPIO | GND rail | 10 kΩ resistor (pull-down) |
| switch terminal B *(optional)* | LED anode | — |
| LED cathode | GND rail | 220 Ω resistor |

Optional current sensor:

| From | To | Via |
| ---- | -- | --- |
| ACS712 VCC | 5V (VIN) | — |
| ACS712 GND | GND rail | — |
| ACS712 OUT | GPIO 34 | — |
| room supply line | ACS712 IP+ / IP− | in series with the load side |

Power rails: ESP32 `3V3` → breadboard + rail; ESP32 `GND` → breadboard − rail.

## Electrical reasoning

- **Why a pull-down.** A bare GPIO input floats when the switch is open and reads
  random noise. Tying it to GND through 10 kΩ forces a clean LOW when the device
  is off, while a closed switch pulls it HIGH through a low-impedance path to
  3V3. 10 kΩ is large enough to keep the "on" current tiny (~0.33 mA) and small
  enough to beat input leakage. (You could instead enable the ESP32's internal
  pull-down and wire the switch to 3V3, dropping the external resistor — the
  external one is shown because it's explicit and simulator-friendly.)
- **Why closed = HIGH.** Mapping the energised state to HIGH means the firmware
  reads the same polarity as the real world, avoiding inverted logic bugs.
- **Analog range for the ACS712.** The ACS712 outputs ~2.5 V at 0 A and swings
  ±185 mV/A (5 A module). The ESP32 ADC reads 0–3.3 V, so a real build should
  scale/limit the signal (the ADC is also non-linear near the rails) — for this
  concept, note the assumption and treat the reading as proportional to current.

## From sensor to watts (optional path)

For AC you sample the ACS712 fast over a full mains cycle and compute the RMS
current, then:

```
watts = V_mains × I_rms
```

with `V_mains` assumed fixed (e.g. 220 V). This mirrors the software model, where
each device has a rated wattage (fan 60 W, light 15 W) and total draw is the sum
of what's on.

## How this maps to the software

In a real deployment the ESP32 loop would read the five GPIOs (and the ADC),
assemble the **same device record** the simulator produces —
`{ id, type, room, status, watts, lastChanged }` — and `POST` it to a backend
ingest endpoint. The backend, dashboard, and bot would be unchanged. In this
project the **simulator stands in for this hardware**, producing that identical
shape, which is why swapping in real sensors later requires no changes above the
device layer.

## Reproducing it in the simulator

1. Place an **ESP32** (Wokwi) or **Arduino Uno** (Tinkercad).
2. Add five slide switches; wire each per the connection list (3V3 → switch →
   GPIO, and GPIO → GND through 10 kΩ).
3. *(Optional)* add five LEDs with 220 Ω resistors tapped off each switch node to
   visualise state.
4. *(Optional)* add an ACS712 module: VCC→5V, GND→GND, OUT→GPIO 34.
5. Flash a short sketch that reads the five inputs each loop and prints/sends the
   state. Toggling a switch in the simulator flips that device — the same event
   the software simulator generates.
