/**
 * Physical I/O map — duplex lift station on LilyGO T-ETH Parc ST + SM-I-010.
 */
module.exports = {
  title: 'Duplex lift station — Parc ST (SM-I-010)',
  program: 'logic/37_duplex_lift_station_parc_st.st',
  platform: 'lilygo-t-eth-elite-parc-st',
  digitalInputs: [
    { tag: 'I1', terminal: 'SM-I-010 IN1', role: 'OFF float → LVL_OFF' },
    { tag: 'I2', terminal: 'SM-I-010 IN2', role: 'Lead float → LVL_LEAD' },
    { tag: 'I3', terminal: 'SM-I-010 IN3', role: 'Lag float → LVL_LAG' },
    { tag: 'I4', terminal: 'SM-I-010 IN4', role: 'High level alarm → LVL_HIGH' },
  ],
  relays: [
    { tag: 'R1', terminal: 'SM-I-010 REL1', role: 'Pump 1 contactor' },
    { tag: 'R2', terminal: 'SM-I-010 REL2', role: 'Pump 2 contactor' },
    { tag: 'R3', terminal: 'SM-I-010 REL3', role: 'Station alarm' },
    { tag: 'R4', terminal: 'SM-I-010 REL4', role: 'Spare' },
  ],
  analogs: [
    { tag: 'I1_RAW / AI1', gpio: 32, role: 'Motor 1 ØA CT 0–1 V → 0–50 A' },
    { tag: 'I2_RAW / AI2', gpio: 33, role: 'Motor 1 ØB CT' },
    { tag: 'I3_RAW / AI3', gpio: 34, role: 'Motor 1 ØC CT' },
    { tag: 'I4_RAW / AI4', gpio: 35, role: 'Motor 2 ØA CT' },
    { tag: 'I5_RAW / AI5', gpio: 36, role: 'Motor 2 ØB CT' },
    { tag: 'I6_RAW / AI6', gpio: 37, role: 'Motor 2 ØC CT' },
    { tag: 'I7_RAW / AI7', gpio: 38, role: 'Spare CT' },
  ],
};
