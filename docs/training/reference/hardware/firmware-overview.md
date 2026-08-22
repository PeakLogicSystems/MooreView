# mooreVIEW Arduino ST Runtime

On-device **Structured Text interpreter** for Arduino Opta (and compatible Portenta H7 targets). mooreVIEW PC parses `.st` into a JSON AST; firmware loads and executes that AST on every scan cycle.

## Architecture

```
mooreVIEW PC                          Arduino Opta
─────────────                         ────────────
.st source  ──parse──►  AST JSON  ──HTTP/MQTT──►  mvProgramLoad()
tag metadata                              │      mvExecuteScan(dtMs)
                                            ▼
                                     tags + I/O + timers/PID/flow
```

| Component | Role |
|-----------|------|
| `src/engine/parser.js` | Parse ST → AST |
| `src/engine/astJson.js` | Serialize AST for device |
| `mv_st.cpp` | Load JSON program, evaluate expressions, run actions/if |
| `mv_tags.cpp` | BOOL/INT/REAL, timers, counters, PID, AVG, flow |
| `mv_io.cpp` / `mv_expansions.cpp` | Base + expansion I/O |
| `mv_http.cpp` | Native `EthernetServer` HTTP router |

## Firmware variants

| Folder | Transport | Use case |
|--------|-----------|----------|
| `arduino-opta-st/` | Ethernet HTTP | Single Opta, `opta_remote` driver |
| `arduino-opta-mqtt-st/` | MQTT + optional HTTP | Parc deploy via `mqtt_parc_opta` |
| `arduino-t-eth-a7670-modem-test/` | USB Serial AT | LilyGO T-ETH-ELITE-A7670X modem bring-up |

Both share the same `mv_st.cpp` interpreter (keep copies in sync when editing).

## Interpreter (`mv_st.cpp`)

**Program load:** `PUT /api/program` or MQTT `put_program` with body `{ source, ast, tagIds, tags }`.

**Scan cycle** (`mvExecuteScan`):

1. Read physical + expansion inputs  
2. Walk AST `body` — `if` / `action` statements  
3. Update timers, counters, flow meters, PID, averages  
4. Write physical outputs  

**Expression types:** `num`, `tag`, `call`, `un`, `bin` (AND/OR, compare, math).

**Actions:** TurnON/OFF, Counter*, TimerInput, Pid*, Avg*, Flow*.

**Calls:** TON, TOF, TP, CTU, CTD, ONE_SHOT, etc. (see `mv_st.cpp`).

## Deploy ST program

**HTTP:** mooreVIEW `OptaRemoteDriver.deployProgram()` → `PUT /api/program`.

**MQTT:** `put_program` command with same JSON body (`src/parc/mqttOptaProgram.js`).

**Start/stop:** `POST /api/runtime/start|stop` or MQTT `runtime_start|runtime_stop`.

## OTA (firmware update)

Runtime **program** deploy is separate from **firmware** OTA:

| | Program (ST) | Firmware (sketch) |
|---|--------------|-------------------|
| Payload | JSON AST | `.ota` file (LZSS + header) |
| Endpoint | `/api/program` | `/api/firmware` |
| Library | ArduinoJson | **Arduino_Portenta_OTA** |
| Reboot | No | Yes |

See `arduino-opta-st/README.md` for OTA usage.

## Building

1. Arduino IDE 2.x, board **Arduino Opta** (6.x core)  
2. Libraries: **ArduinoJson** 7.x, **EthernetWebServer**, **Arduino_Opta_Blueprint** (expansions)  
3. Opta WiFi: enables setup AP + ArduinoOTA  

Export binary: **Sketch → Export compiled Binary**, then run `lzss.py` + `bin2ota.py OPTA` to produce `.ota`, and POST that file to `/api/firmware`.
