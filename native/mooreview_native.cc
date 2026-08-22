#include <napi.h>
#include <map>
#include <string>
#include <cmath>

#ifdef __linux__
#include <dlfcn.h>
#endif

#include "hal_plugin.h"

static std::map<int, double> g_channels;

/* --- legacy serial/io shim --- */
static void* g_so = nullptr;
typedef int (*io_init_fn)(const char*);
typedef int (*io_read_fn)(int, double*);
typedef int (*io_write_fn)(int, double);
typedef void (*io_shutdown_fn)();

static io_init_fn p_init = nullptr;
static io_read_fn p_read = nullptr;
static io_write_fn p_write = nullptr;
static io_shutdown_fn p_shutdown = nullptr;

/* --- HAL session --- */
struct HalSession {
  void* plugin = nullptr;
  bool usePlugin = false;
  std::map<std::string, double> sim;
  std::map<int, unsigned long long> cnt;
  std::map<int, double> cntFreq;
  std::string pluginPath;
};

static std::map<int, HalSession> g_halSessions;
static int g_nextHalHandle = 1;

typedef int (*hal_init_fn)(const char*);
typedef void (*hal_shutdown_fn)();
typedef int (*hal_read_fn)(mooreview_hal_kind, int, double*);
typedef int (*hal_write_fn)(mooreview_hal_kind, int, double);
typedef int (*hal_counter_fn)(int, unsigned long long*, double*);

static hal_init_fn hal_p_init = nullptr;
static hal_shutdown_fn hal_p_shutdown = nullptr;
static hal_read_fn hal_p_read = nullptr;
static hal_write_fn hal_p_write = nullptr;
static hal_counter_fn hal_p_counter = nullptr;

static std::string pinKey(int kind, int index) {
  const char* p = "X";
  switch (kind) {
    case MV_HAL_DI: p = "DI"; break;
    case MV_HAL_DO: p = "DO"; break;
    case MV_HAL_AI: p = "AI"; break;
    case MV_HAL_AO: p = "AO"; break;
    case MV_HAL_CNT: p = "CNT"; break;
  }
  return std::string(p) + std::to_string(index);
}

static bool loadHalPlugin(HalSession& s, const std::string& lib, const std::string& cfg) {
#ifdef __linux__
  if (lib.empty()) return false;
  s.plugin = dlopen(lib.c_str(), RTLD_LAZY);
  if (!s.plugin) return false;
  hal_p_init = (hal_init_fn)dlsym(s.plugin, "mooreview_hal_init");
  hal_p_shutdown = (hal_shutdown_fn)dlsym(s.plugin, "mooreview_hal_shutdown");
  hal_p_read = (hal_read_fn)dlsym(s.plugin, "mooreview_hal_read");
  hal_p_write = (hal_write_fn)dlsym(s.plugin, "mooreview_hal_write");
  hal_p_counter = (hal_counter_fn)dlsym(s.plugin, "mooreview_hal_counter_read");
  if (!hal_p_read || !hal_p_write) return false;
  if (hal_p_init && hal_p_init(cfg.c_str()) != 0) return false;
  s.usePlugin = true;
  s.pluginPath = lib;
  return true;
#else
  (void)s; (void)lib; (void)cfg;
  return false;
#endif
}

Napi::Value HalOpen(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string lib = info.Length() > 0 ? info[0].As<Napi::String>().Utf8Value() : "";
  std::string cfg = info.Length() > 1 ? info[1].As<Napi::String>().Utf8Value() : "{}";

  HalSession session;
  if (!loadHalPlugin(session, lib, cfg)) {
    session.usePlugin = false;
    session.pluginPath = lib;
  }

  int handle = g_nextHalHandle++;
  g_halSessions[handle] = session;
  return Napi::Number::New(env, handle);
}

Napi::Value HalClose(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int handle = info[0].As<Napi::Number>().Int32Value();
  auto it = g_halSessions.find(handle);
  if (it != g_halSessions.end()) {
#ifdef __linux__
    if (it->second.usePlugin && hal_p_shutdown) hal_p_shutdown();
    if (it->second.plugin) dlclose(it->second.plugin);
#endif
    g_halSessions.erase(it);
  }
  hal_p_init = nullptr;
  hal_p_shutdown = nullptr;
  hal_p_read = nullptr;
  hal_p_write = nullptr;
  hal_p_counter = nullptr;
  return env.Undefined();
}

Napi::Value HalRead(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int handle = info[0].As<Napi::Number>().Int32Value();
  int kind = info[1].As<Napi::Number>().Int32Value();
  int index = info[2].As<Napi::Number>().Int32Value();
  auto it = g_halSessions.find(handle);
  if (it == g_halSessions.end()) return Napi::Number::New(env, 0);

  HalSession& s = it->second;
  double v = 0;
  if (s.usePlugin && hal_p_read) {
    if (hal_p_read((mooreview_hal_kind)kind, index, &v) != 0) v = 0;
  } else {
    auto key = pinKey(kind, index);
    auto sit = s.sim.find(key);
    v = sit != s.sim.end() ? sit->second : 0.0;
    if (kind == MV_HAL_CNT) {
      auto cit = s.cnt.find(index);
      v = cit != s.cnt.end() ? (double)cit->second : 0.0;
    }
  }
  return Napi::Number::New(env, v);
}

Napi::Value HalWrite(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int handle = info[0].As<Napi::Number>().Int32Value();
  int kind = info[1].As<Napi::Number>().Int32Value();
  int index = info[2].As<Napi::Number>().Int32Value();
  double v = info[3].As<Napi::Number>().DoubleValue();
  auto it = g_halSessions.find(handle);
  if (it == g_halSessions.end()) return env.Undefined();

  HalSession& s = it->second;
  if (s.usePlugin && hal_p_write) {
    hal_p_write((mooreview_hal_kind)kind, index, v);
  } else {
    s.sim[pinKey(kind, index)] = v;
  }
  return env.Undefined();
}

Napi::Value HalCounterRead(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int handle = info[0].As<Napi::Number>().Int32Value();
  int index = info.Length() > 1 ? info[1].As<Napi::Number>().Int32Value() : 0;

  auto it = g_halSessions.find(handle);
  Napi::Object out = Napi::Object::New(env);
  unsigned long long count = 0;
  double freq = 0;

  if (it != g_halSessions.end()) {
    HalSession& s = it->second;
    if (s.usePlugin && hal_p_counter) {
      hal_p_counter(index, &count, &freq);
    } else {
      auto cit = s.cnt.find(index);
      count = cit != s.cnt.end() ? cit->second : 0;
      auto fit = s.cntFreq.find(index);
      freq = fit != s.cntFreq.end() ? fit->second : 0.0;
    }
  }
  out.Set("count", Napi::Number::New(env, (double)count));
  out.Set("freqHz", Napi::Number::New(env, freq));
  return out;
}

Napi::Value HalPluginName(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int handle = info[0].As<Napi::Number>().Int32Value();
  auto it = g_halSessions.find(handle);
  if (it == g_halSessions.end()) return Napi::String::New(env, "");
  return Napi::String::New(env, it->second.pluginPath);
}

Napi::Value SerialOpen(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "port, baud expected").ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, 1);
}

Napi::Value SerialClose(const Napi::CallbackInfo& info) {
  return info.Env().Undefined();
}

Napi::Value SerialRead(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int ch = info[1].As<Napi::Number>().Int32Value();
  auto it = g_channels.find(ch);
  double v = it != g_channels.end() ? it->second : 0.0;
  return Napi::Number::New(env, v);
}

Napi::Value SerialWrite(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int ch = info[1].As<Napi::Number>().Int32Value();
  double v = info[2].As<Napi::Number>().DoubleValue();
  g_channels[ch] = v;
  return env.Undefined();
}

Napi::Value IoInit(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string lib = info[0].As<Napi::String>().Utf8Value();
  std::string cfg = info[1].As<Napi::String>().Utf8Value();
  (void)cfg;
#ifdef __linux__
  if (!lib.empty()) {
    g_so = dlopen(lib.c_str(), RTLD_LAZY);
    if (!g_so) return Napi::Number::New(env, -1);
    p_init = (io_init_fn)dlsym(g_so, "io_init");
    p_read = (io_read_fn)dlsym(g_so, "io_read");
    p_write = (io_write_fn)dlsym(g_so, "io_write");
    p_shutdown = (io_shutdown_fn)dlsym(g_so, "io_shutdown");
    if (p_init && p_init(cfg.c_str()) != 0) return Napi::Number::New(env, -2);
  }
#endif
  return Napi::Number::New(env, 0);
}

Napi::Value IoRead(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int ch = info[0].As<Napi::Number>().Int32Value();
  double v = 0;
#ifdef __linux__
  if (p_read) {
    if (p_read(ch, &v) != 0) v = 0;
  } else
#endif
  {
    auto it = g_channels.find(ch);
    v = it != g_channels.end() ? it->second : 0.0;
  }
  return Napi::Number::New(env, v);
}

Napi::Value IoWrite(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int ch = info[0].As<Napi::Number>().Int32Value();
  double v = info[1].As<Napi::Number>().DoubleValue();
#ifdef __linux__
  if (p_write) p_write(ch, v);
  else
#endif
  g_channels[ch] = v;
  return env.Undefined();
}

Napi::Value IoShutdown(const Napi::CallbackInfo& info) {
#ifdef __linux__
  if (p_shutdown) p_shutdown();
  if (g_so) dlclose(g_so);
#endif
  g_so = nullptr;
  p_init = p_read = p_write = p_shutdown = nullptr;
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("serialOpen", Napi::Function::New(env, SerialOpen));
  exports.Set("serialClose", Napi::Function::New(env, SerialClose));
  exports.Set("serialRead", Napi::Function::New(env, SerialRead));
  exports.Set("serialWrite", Napi::Function::New(env, SerialWrite));
  exports.Set("ioInit", Napi::Function::New(env, IoInit));
  exports.Set("ioRead", Napi::Function::New(env, IoRead));
  exports.Set("ioWrite", Napi::Function::New(env, IoWrite));
  exports.Set("ioShutdown", Napi::Function::New(env, IoShutdown));
  exports.Set("halOpen", Napi::Function::New(env, HalOpen));
  exports.Set("halClose", Napi::Function::New(env, HalClose));
  exports.Set("halRead", Napi::Function::New(env, HalRead));
  exports.Set("halWrite", Napi::Function::New(env, HalWrite));
  exports.Set("halCounterRead", Napi::Function::New(env, HalCounterRead));
  exports.Set("halPluginName", Napi::Function::New(env, HalPluginName));
  return exports;
}

NODE_API_MODULE(mooreview_native, Init)
