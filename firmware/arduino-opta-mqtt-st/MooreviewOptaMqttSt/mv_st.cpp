#include "mv_st.h"
#include "mv_bc.h"
#include "mv_base64.h"
#include "mv_tags.h"
#include "mv_expansions.h"
#include "mv_config.h"
#include "mv_debug.h"
#include "mv_version.h"
#include <string.h>

static char g_progErr[128];
static char g_programName[64];
static bool g_hasProgram = false;
static uint8_t g_bcDecode[MV_BC_MAX];

void mvOneShotReset() { mvBcOneShotReset(); }

const char* mvLastProgramError() { return g_progErr; }

const char* mvProgramName() { return g_programName; }

const char* mvProgramShortName() {
  if (!g_programName[0]) return "";
  const char* slash = strrchr(g_programName, '/');
  const char* bslash = strrchr(g_programName, '\\');
  const char* base = g_programName;
  if (slash && slash + 1 > base) base = slash + 1;
  if (bslash && bslash + 1 > base) base = bslash + 1;
  return base;
}

bool mvProgramClear() {
  g_hasProgram = false;
  g_progErr[0] = 0;
  g_programName[0] = 0;
  mvBcClear();
  return true;
}

bool mvProgramLoad(JsonObject root) {
  g_progErr[0] = 0;
  g_programName[0] = '\0';
  if (root["programName"].is<const char*>()) {
    strncpy(g_programName, root["programName"].as<const char*>(), sizeof(g_programName) - 1);
    g_programName[sizeof(g_programName) - 1] = '\0';
  }

  char protoErr[96];
  const int clientProto = root["protocolVersion"] | 0;
  const char* clientVer = root["clientVersion"] | "";
  if (!mvCheckClientProtocol(clientProto, clientVer, protoErr, sizeof(protoErr))) {
    strncpy(g_progErr, protoErr, sizeof(g_progErr) - 1);
    return false;
  }

  const char* bc = root["bc"];
  if (!bc || !bc[0]) {
    strncpy(g_progErr, "missing bc", sizeof(g_progErr) - 1);
    return false;
  }
  const size_t decoded = mvBase64Decode(bc, g_bcDecode, sizeof(g_bcDecode));
  if (!decoded) {
    strncpy(g_progErr, "bc decode failed", sizeof(g_progErr) - 1);
    return false;
  }
  if (!mvBcLoad(g_bcDecode, decoded, g_progErr, sizeof(g_progErr))) {
    return false;
  }
  g_hasProgram = true;
  MV_LOG2("program loaded code=", (int)mvBcCodeBytes());
  MV_LOG2("program data=", (int)mvBcDataBytes());
  MV_LOG2("program tags=", (int)mvBcTagCount());
  return true;
}

bool mvProgramValid() { return g_hasProgram && mvBcHasProgram(); }

void mvExecuteScan(uint32_t dtMs) {
  mvExpUpdate();
  mvReadPhysicalInputs();
  mvExpReadInputs();
  if (g_hasProgram) mvBcRunProgram();
  mvUpdateTimers(dtMs);
  mvUpdateCounters();
  mvUpdateFlowMeters();
  mvUpdatePids(dtMs);
  mvUpdateAverages();
  mvWritePhysicalOutputs();
  mvExpWriteOutputs();
}
