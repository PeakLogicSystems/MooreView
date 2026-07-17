#include "mv_bc.h"
#include "mv_tags.h"
#include "mv_config.h"
#include <string.h>

enum Op : uint8_t {
  OP_PUSH_F32 = 0x01,
  OP_PUSH_I16 = 0x02,
  OP_PUSH_TAG = 0x03,
  OP_NOT = 0x10,
  OP_NEG = 0x11,
  OP_AND = 0x20,
  OP_OR = 0x21,
  OP_ADD = 0x22,
  OP_SUB = 0x23,
  OP_MUL = 0x24,
  OP_DIV = 0x25,
  OP_MOD = 0x26,
  OP_GT = 0x30,
  OP_LT = 0x31,
  OP_EQ = 0x32,
  OP_GE = 0x33,
  OP_LE = 0x34,
  OP_NE = 0x35,
  OP_CALL = 0x40,
  OP_ACTION = 0x80,
  OP_STORE_TAG = 0x81,
  OP_JMP_IFNOT = 0x90,
  OP_JMP = 0x91,
  OP_END = 0xff,
};

enum MetaFlag : uint8_t {
  META_PRESET = 0x01,
  META_MODE = 0x02,
  META_PID = 0x04,
};

static const char* MODE_STR[] = { "TON", "TOF", "TP", "CTU", "CTD", "PI", "MOV", "GPM" };

static uint8_t g_bcStore[MV_BC_MAX];
static uint16_t g_bcLen = 0;
static uint16_t g_codeOff = 0;
static uint16_t g_codeLen = 0;
static uint16_t g_tagCount = 0;
static char g_tagNames[MV_MAX_TAGS][16];
static bool g_hasBc = false;

#define MV_MAX_ONESHOT 32
static char g_oneShotIds[MV_MAX_ONESHOT][16];
static bool g_oneShotFired[MV_MAX_ONESHOT];
static uint8_t g_oneShotCount = 0;

static double g_stack[16];
static int g_sp = 0;

void mvBcOneShotReset() {
  g_oneShotCount = 0;
  memset(g_oneShotIds, 0, sizeof(g_oneShotIds));
  memset(g_oneShotFired, 0, sizeof(g_oneShotFired));
}

void mvBcClear() {
  g_hasBc = false;
  g_bcLen = 0;
  g_codeOff = 0;
  g_codeLen = 0;
  g_tagCount = 0;
}

bool mvBcHasProgram() { return g_hasBc; }
size_t mvBcBytes() { return g_bcLen; }
uint16_t mvBcTagCount() { return g_tagCount; }
uint16_t mvBcCodeBytes() { return g_codeLen; }
uint16_t mvBcDataBytes() { return g_codeOff; }
uint16_t mvBcMaxBytes() { return MV_BC_MAX; }

static uint16_t rdU16(size_t off) {
  return (uint16_t)g_bcStore[off] | ((uint16_t)g_bcStore[off + 1] << 8);
}

static int16_t rdI16(size_t off) {
  return (int16_t)rdU16(off);
}

static float rdF32(size_t off) {
  float f;
  memcpy(&f, &g_bcStore[off], 4);
  return f;
}

static uint32_t rdU32(size_t off) {
  return (uint32_t)g_bcStore[off]
    | ((uint32_t)g_bcStore[off + 1] << 8)
    | ((uint32_t)g_bcStore[off + 2] << 16)
    | ((uint32_t)g_bcStore[off + 3] << 24);
}

static void bcErr(char* err, size_t errLen, const char* msg) {
  if (err && errLen) {
    strncpy(err, msg, errLen - 1);
    err[errLen - 1] = '\0';
  }
}

static const char* tagName(uint16_t idx) {
  if (idx >= g_tagCount) return "";
  return g_tagNames[idx];
}

static double tagAsNum(const char* name) {
  MvTag* t = mvFindTag(name);
  if (!t) return 0.0;
  if (t->kind == MV_REAL || t->kind == MV_PID || t->kind == MV_AVG) return mvGetReal(name);
  if (t->kind == MV_INT || t->kind == MV_COUNTER) return mvGetInt(name);
  return mvGetBool(name) ? 1.0 : 0.0;
}

static double tagAsNumIdx(uint16_t idx) {
  return tagAsNum(tagName(idx));
}

static void push(double v) {
  if (g_sp < 16) g_stack[g_sp++] = v;
}

static double pop() {
  if (g_sp <= 0) return 0;
  return g_stack[--g_sp];
}

static bool oneShotConsumeIdx(uint16_t idx) {
  const char* id = tagName(idx);
  if (!id[0]) return false;
  int slot = -1;
  for (uint8_t i = 0; i < g_oneShotCount; i++) {
    if (strcmp(g_oneShotIds[i], id) == 0) {
      slot = (int)i;
      break;
    }
  }
  if (slot < 0) {
    if (g_oneShotCount >= MV_MAX_ONESHOT) return false;
    slot = (int)g_oneShotCount++;
    strncpy(g_oneShotIds[slot], id, 15);
    g_oneShotIds[slot][15] = '\0';
  }
  if (g_oneShotFired[slot]) return false;
  g_oneShotFired[slot] = true;
  return true;
}

static double evalBuiltin(uint8_t id) {
  switch (id) {
    case 0: { uint16_t t = (uint16_t)pop(); return mvGetBool(tagName(t)) ? 1.0 : 0.0; }
    case 1: { uint16_t t = (uint16_t)pop(); return mvGetBool(tagName(t)) ? 0.0 : 1.0; }
    case 2: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->tmrDone) ? 1.0 : 0.0; }
    case 3: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->tmrRunning) ? 1.0 : 0.0; }
    case 4: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->ctrDone) ? 1.0 : 0.0; }
    case 5: { uint16_t t = (uint16_t)pop(); return mvGetInt(tagName(t)); }
    case 6: { uint16_t t = (uint16_t)pop(); return mvGetReal(tagName(t)); }
    case 7: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->kind == MV_PID) ? x->err : 0.0; }
    case 8: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->kind == MV_PID && x->pidEnabled) ? 1.0 : 0.0; }
    case 9: { uint16_t t = (uint16_t)pop(); return mvGetReal(tagName(t)); }
    case 10: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->kind == MV_AVG && x->avgReady) ? 1.0 : 0.0; }
    case 11: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->kind == MV_AVG) ? x->avgCount : 0.0; }
    case 12: {
      double hi = pop();
      double lo = pop();
      uint16_t t = (uint16_t)pop();
      double v = tagAsNumIdx(t);
      return (v >= lo && v <= hi) ? 1.0 : 0.0;
    }
    case 13: { uint16_t t = (uint16_t)pop(); return oneShotConsumeIdx(t) ? 1.0 : 0.0; }
    case 14: { uint16_t t = (uint16_t)pop(); return mvGetReal(tagName(t)); }
    case 15: { uint16_t t = (uint16_t)pop(); MvTag* x = mvFindTag(tagName(t)); return (x && x->kind == MV_FLOW && x->flowReady) ? 1.0 : 0.0; }
    default: return 0.0;
  }
}

static void setAnalogFromExpr(const char* tag, double val) {
  MvTag* t = mvFindTag(tag);
  if (t && (t->kind == MV_INT || t->kind == MV_BOOL)) mvSetInt(tag, (int)val);
  else mvSetReal(tag, (float)val);
}

static void runAction(uint8_t id, uint16_t tagIdx, uint16_t inputIdx) {
  const char* tag = tagName(tagIdx);
  const char* inputTag = (inputIdx == 0xffff) ? nullptr : tagName(inputIdx);
  if (!tag[0]) return;
  switch (id) {
    case 0: mvSetBool(tag, true); break;
    case 1: mvSetBool(tag, false); break;
    case 2: { MvTag* t = mvEnsureTag(tag, MV_COUNTER); if (t) t->ctrReset = true; break; }
    case 3: { MvTag* t = mvEnsureTag(tag, MV_COUNTER); if (t) t->cuPulse = inputTag ? mvGetBool(inputTag) : true; break; }
    case 4: { MvTag* t = mvEnsureTag(tag, MV_COUNTER); if (t) t->cdPulse = inputTag ? mvGetBool(inputTag) : true; break; }
    case 5: { MvTag* t = mvEnsureTag(tag, MV_TIMER); if (t) t->tmrInput = inputTag ? mvGetBool(inputTag) : true; break; }
    case 6: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_PID); if (t) t->pv = (float)tagAsNum(inputTag); } break;
    case 7: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_PID); if (t) { t->sp = (float)tagAsNum(inputTag); t->preset = (uint32_t)t->sp; } } break;
    case 8: { MvTag* t = mvFindTag(tag); if (t && t->kind == MV_PID && inputTag) setAnalogFromExpr(inputTag, t->out); break; }
    case 9: { MvTag* t = mvEnsureTag(tag, MV_PID); if (t) t->pidEnabled = true; break; }
    case 10: { MvTag* t = mvEnsureTag(tag, MV_PID); if (t) { t->pidEnabled = false; t->integral = 0; t->prevPv = t->pv; } break; }
    case 11: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_AVG); if (t) t->avgPv = (float)tagAsNum(inputTag); } break;
    case 12: { MvTag* t = mvEnsureTag(tag, MV_AVG); if (t) t->avgReset = true; break; }
    case 13: { MvTag* t = mvFindTag(tag); if (t && t->kind == MV_AVG && inputTag) setAnalogFromExpr(inputTag, t->avgVal); break; }
    case 14: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_FLOW); if (t) { strncpy(t->flowCtrId, inputTag, 15); t->flowCtrId[15] = '\0'; } } break;
    case 15: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_FLOW); if (t) { strncpy(t->flowTmrId, inputTag, 15); t->flowTmrId[15] = '\0'; } } break;
    case 16: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_FLOW); if (t) { strncpy(t->flowKTagId, inputTag, 15); t->flowKTagId[15] = '\0'; } } break;
    case 17: if (inputTag) { MvTag* t = mvEnsureTag(tag, MV_FLOW); if (t) { strncpy(t->flowOutId, inputTag, 15); t->flowOutId[15] = '\0'; } } break;
    default: break;
  }
}

static MvTagKind kindFromByte(uint8_t t) {
  switch (t) {
    case 1: return MV_INT;
    case 2: return MV_REAL;
    case 3: return MV_TIMER;
    case 4: return MV_COUNTER;
    case 5: return MV_PID;
    case 6: return MV_AVG;
    case 7: return MV_FLOW;
    default: return MV_BOOL;
  }
}

static bool applyTagMeta(const char* id, uint8_t type, uint8_t flags, size_t& off) {
  MvTagKind kind = kindFromByte(type);
  MvTag* t = mvEnsureTag(id, kind);
  if (!t) return false;
  if (flags & META_PRESET) {
    t->preset = rdU32(off);
    off += 4;
  }
  if (flags & META_MODE) {
    uint8_t mid = g_bcStore[off++];
    if (mid < 8) mvSetTagMode(t, MODE_STR[mid]);
  }
  if (flags & META_PID) {
    t->kp = rdF32(off); off += 4;
    t->ki = rdF32(off); off += 4;
    t->kd = rdF32(off); off += 4;
    t->outMin = rdF32(off); off += 4;
    t->outMax = rdF32(off); off += 4;
  }
  if (kind == MV_COUNTER && strcmp(t->mode, "CTD") == 0 && t->count == 0 && t->preset > 0) {
    t->count = (int32_t)t->preset;
  }
  return true;
}

bool mvBcLoad(const uint8_t* data, size_t len, char* err, size_t errLen) {
  mvBcClear();
  if (!data || len < 10) {
    bcErr(err, errLen, "bc too short");
    return false;
  }
  if (data[0] != MV_BC_MAGIC_0 || data[1] != MV_BC_MAGIC_1 || data[2] != MV_BC_MAGIC_2 || data[3] != MV_BC_MAGIC_3) {
    bcErr(err, errLen, "bad bc magic");
    return false;
  }
  if (data[4] != 1) {
    bcErr(err, errLen, "bc version");
    return false;
  }
  const uint16_t tagCount = rdU16(6);
  const uint16_t codeLen = rdU16(8);
  if (tagCount > MV_MAX_TAGS) {
    bcErr(err, errLen, "too many tags");
    return false;
  }
  size_t off = 10;
  g_tagCount = tagCount;
  for (uint16_t i = 0; i < tagCount; i++) {
    if (off >= len) { bcErr(err, errLen, "truncated tags"); return false; }
    const uint8_t nlen = data[off++];
    if (nlen == 0 || nlen > 31 || off + nlen + 2 > len) { bcErr(err, errLen, "bad tag name"); return false; }
    memcpy(g_tagNames[i], &data[off], nlen);
    g_tagNames[i][nlen] = '\0';
    off += nlen;
    const uint8_t type = data[off++];
    const uint8_t flags = data[off++];
    if (!applyTagMeta(g_tagNames[i], type, flags, off)) { bcErr(err, errLen, "tag meta"); return false; }
  }
  if (off + codeLen > len || codeLen > MV_BC_MAX) {
    bcErr(err, errLen, "bad code len");
    return false;
  }
  if (len > MV_BC_MAX) {
    bcErr(err, errLen, "bc too large");
    return false;
  }
  memcpy(g_bcStore, data, len);
  g_bcLen = (uint16_t)len;
  g_codeOff = (uint16_t)off;
  g_codeLen = codeLen;
  g_hasBc = true;
  return true;
}

void mvBcRunProgram() {
  if (!g_hasBc || !g_codeLen) return;
  size_t ip = g_codeOff;
  const size_t end = g_codeOff + g_codeLen;
  g_sp = 0;
  while (ip < end) {
    const uint8_t op = g_bcStore[ip++];
    switch (op) {
      case OP_PUSH_F32:
        push(rdF32(ip));
        ip += 4;
        break;
      case OP_PUSH_I16:
        push(rdI16(ip));
        ip += 2;
        break;
      case OP_PUSH_TAG:
        push(rdU16(ip));
        ip += 2;
        break;
      case OP_NOT:
        push(pop() ? 0.0 : 1.0);
        break;
      case OP_NEG:
        push(-pop());
        break;
      case OP_AND: { double r = pop(); double l = pop(); push((l && r) ? 1.0 : 0.0); break; }
      case OP_OR: { double r = pop(); double l = pop(); push((l || r) ? 1.0 : 0.0); break; }
      case OP_ADD: { double r = pop(); push(pop() + r); break; }
      case OP_SUB: { double r = pop(); push(pop() - r); break; }
      case OP_MUL: { double r = pop(); push(pop() * r); break; }
      case OP_DIV: { double r = pop(); { double l = pop(); push(r == 0 ? 0 : l / r); } break; }
      case OP_MOD: { double r = pop(); { double l = pop(); push(r == 0 ? 0 : (double)((int)l % (int)r)); } break; }
      case OP_GT: { double r = pop(); push(pop() > r ? 1.0 : 0.0); break; }
      case OP_LT: { double r = pop(); push(pop() < r ? 1.0 : 0.0); break; }
      case OP_EQ: { double r = pop(); push(pop() == r ? 1.0 : 0.0); break; }
      case OP_GE: { double r = pop(); push(pop() >= r ? 1.0 : 0.0); break; }
      case OP_LE: { double r = pop(); push(pop() <= r ? 1.0 : 0.0); break; }
      case OP_NE: { double r = pop(); push(pop() != r ? 1.0 : 0.0); break; }
      case OP_CALL: {
        const uint8_t bid = g_bcStore[ip++];
        push(evalBuiltin(bid));
        break;
      }
      case OP_ACTION: {
        const uint8_t aid = g_bcStore[ip++];
        const uint16_t tag = rdU16(ip); ip += 2;
        const uint16_t input = rdU16(ip); ip += 2;
        runAction(aid, tag, input);
        break;
      }
      case OP_STORE_TAG: {
        const uint16_t tag = rdU16(ip); ip += 2;
        setAnalogFromExpr(tagName(tag), pop());
        break;
      }
      case OP_JMP_IFNOT: {
        const uint16_t rel = rdU16(ip);
        ip += 2;
        if (pop() == 0.0) ip += rel;
        break;
      }
      case OP_JMP: {
        const uint16_t rel = rdU16(ip);
        ip += 2;
        ip += rel;
        break;
      }
      case OP_END:
        return;
      default:
        return;
    }
  }
}
